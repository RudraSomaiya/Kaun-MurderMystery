"""Automatic checks on a suspect's reply, using the simulation's ground truth.

The same checks filter the teacher data, score GRPO rollouts and produce the eval
metrics, so "good" means the same thing everywhere.

    python train/filters.py          # build data/sft/{train,val}.jsonl from data/teacher/raw.jsonl
"""
import json
import pathlib
import re
import zlib
from collections import Counter, defaultdict

ROOT = pathlib.Path(__file__).resolve().parent.parent
NAMES = json.loads((ROOT / "content/names.json").read_text(encoding="utf-8"))
ALL_FIRST = {n.lower() for n in NAMES["m"] + NAMES["f"]}

TIME = re.compile(r"\b(\d{1,2})[:.](\d{2})\s*(am|pm)?|\b(\d{1,2})\s*(am|pm|baje|o'?clock)\b", re.I)
FIRST_PERSON = re.compile(r"\b(i|i'm|i'd|me|my|main|mai|hum|we|apun)\b", re.I)
CLAUSES = re.compile(r";|,?\s+then\s+|,\s+and\s+|,\s+(?=(?:at|around|by|from)\s+\d)", re.I)
META = re.compile(r"\b(as an ai|language model|ai model|system prompt|my instructions|character sheet|the sheet|role-?play|i am an ai|i'm an ai|assistant|chatbot|the prompt|game master)\b", re.I)
STAGE = re.compile(r"\*[^*]{2,}\*|\((?:sighs|laughs|pauses|nervously|smiles)[^)]*\)|[\U0001F300-\U0001FAFF]")
CONFESS = re.compile(
    r"\b(i|I) (killed|murdered|stabbed|strangled|hit) (him|her|them|[A-Z][a-z]+)\b|\bi did it\b|\bmaine (hi )?(maara|mara|maar diya)\b|\bi'm the (killer|murderer)\b|\bi am the (killer|murderer)\b",
    re.I,
)
ROOM_WORDS = ["kitchen", "terrace", "garden", "balcony", "lobby", "bathroom", "washroom", "toilet", "hall", "library", "pool", "garage", "rooftop", "basement", "parking", "office", "lounge", "bar", "lawn", "study", "corridor", "mess", "canteen", "lift", "staircase"]
NEG = re.compile(r"\b(not|never|no|nahi|nahin)\b|n't\b")
NARRATION = re.compile(r"^\s*\**[A-Z][a-z]+\**\s*:|\b[A-Z][a-z]+ (sighs|laughs|smiles|shrugs|frowns|chuckles)\b")
SKIP = {"room", "the", "old", "second-floor", "floor", "deck", "lot", "star's", "heroine's"}


def mins(hhmm):
    return int(hhmm[:2]) * 60 + int(hhmm[3:])


class Case:
    """Everything needed to judge one suspect's replies."""

    def __init__(self, rec):
        f = rec["facts"]
        self.rec = rec
        self.killer = rec["killer"]
        self.times = f["times"]
        self.start = mins(self.times[0])
        self.account = {a["t"]: a for a in f["account"]}
        self.truth = {a["t"]: a for a in f["truth"]}
        self.people = {p.lower() for p in f["people"]}
        self.rooms = f["rooms"]
        words = [[w for w in r.lower().replace("'s", "").split() if w not in SKIP and (len(w) > 3 or any(ch.isdigit() for ch in w))] for r in self.rooms]
        count = Counter(w for ws in words for w in set(ws))
        self.aliases = [(r, [r.lower()] + [w for w in ws if count[w] == 1]) for r, ws in zip(self.rooms, words)]
        sec = f["secret"]
        self.secret_words = [w.lower() for w in (sec["reveal"] if sec else [])]
        self.secret_room = sec["room"] if sec else None
        self.sheet = rec["system"].lower()
        self.motive_words = [w.lower() for w in (f["motive"]["reveal"] if f["motive"] else [])]
        self.murder_time = f["murder"]["time"]
        self.murder_room = f["murder"]["room"]

    def step(self, h, m, ampm=None):
        span = len(self.times) * 15
        ampm = (ampm or "").lower()
        cands = [h % 12] if ampm == "am" else [(h % 12) + 12] if ampm == "pm" else [h % 24, (h + 12) % 24]
        ds = sorted(d for d in (((x * 60 + m - self.start) % 1440) for x in cands) if d <= span + 15)
        return min(len(self.times) - 1, round(ds[0] / 15)) if ds else None

    def claims(self, text):
        """First-person (step, room) claims, one per clause."""
        out = []
        for sent in re.split(r"(?<=[.!?])\s+", text):
            if not FIRST_PERSON.search(sent) or sent.rstrip().endswith("?"):
                continue
            for part in CLAUSES.split(sent):
                if not part:
                    continue
                low = part.lower()
                steps = []
                for m in TIME.finditer(part):
                    s = self.step(int(m[1]), int(m[2]), m[3]) if m[1] else self.step(int(m[4]), 0, m[5] if (m[5] or "").lower() in ("am", "pm") else None)
                    if s is not None:
                        steps.append(s)
                # "I wasn't in the Kitchen" is not a claim to have been in the Kitchen
                hit = [r for r, keys in self.aliases if any(k in low and not NEG.search(low[max(0, low.find(k) - 24) : low.find(k)]) for k in keys)]
                if steps and len(hit) == 1:
                    out += [(s, hit[0]) for s in set(steps)]
        return out

    def check(self, question, reply, proof=False):
        """Flags for one reply. True means something went wrong."""
        q, a = question.lower(), reply.lower()
        words = len(reply.split())
        flags = {
            "empty": words == 0,
            "long": words > 60,
            "meta": bool(META.search(reply)),
            "stage": bool(STAGE.search(reply) or NARRATION.search(reply)),
            "confess": self.killer and bool(CONFESS.search(reply)),
            "leak": False,
            "contradict": False,
            "invented": False,
        }
        if not proof:
            # one generic word ("money") in a denial is not a leak; two, or a specific phrase, or the place is
            said = {w for w in self.secret_words if re.search(rf"\b{re.escape(w)}\b", a) and w not in q}
            where = bool(self.secret_room) and self.secret_room.lower() in a and self.secret_room.lower() not in q
            flags["leak"] = len(said) >= 2 or (len(said) == 1 and (where or " " in next(iter(said))))
        for s, room in self.claims(reply):
            ok = {self.account[t]["room"] for t in (s - 1, s, s + 1) if t in self.account}
            if room not in ok:
                flags["contradict"] = True
        if self.killer and self.murder_room.lower() in a and FIRST_PERSON.search(reply):
            # the killer placing themself in the murder room at the murder time
            for s, room in self.claims(reply):
                if room == self.murder_room and self.times[s] == self.murder_time:
                    flags["confess"] = True
        names = {w.lower() for w in re.findall(r"\b[A-Z][a-z]{2,}\b", reply)}
        if any(n in ALL_FIRST and n not in self.people for n in names):
            flags["invented"] = True
        if any(re.search(rf"\b{w}\b", a) and w not in self.sheet and w not in q for w in ROOM_WORDS):
            flags["invented"] = True
        return flags


HARD = ("empty", "meta", "confess", "contradict")


def reward(flags):
    """Scalar reward for RL. Hard failures dominate; style issues cost less."""
    r = 1.0
    r -= 2.0 * flags["confess"] + 1.0 * flags["contradict"] + 1.0 * flags["leak"] + 1.0 * flags["meta"] + 1.0 * flags["empty"]
    r -= 0.5 * flags["invented"] + 0.3 * flags["long"] + 0.3 * flags["stage"]
    return r


def proof_turns(items, n):
    """Which detective turns presented real proof of the secret (the planner says so)."""
    if len(items) != n:
        return set()
    return {k for k, it in enumerate(items) if it.startswith("Give real proof")}


def main():
    nights = {}
    with (ROOT / "data/nights/train.jsonl").open(encoding="utf-8") as fh:
        for line in fh:
            r = json.loads(line)
            nights[r["id"]] = r
    out = {"train": [], "val": []}
    stats = defaultdict(Counter)
    for line in (ROOT / "data/teacher/raw.jsonl").open(encoding="utf-8"):
        row = json.loads(line)
        rec = nights[row["id"]]
        case = Case(rec)
        proofs = proof_turns(row["items"], len(row["turns"]))
        msgs = [{"role": "system", "content": rec["system"]}]
        model = row["model"]
        for k, t in enumerate(row["turns"]):
            fl = case.check(t["q"], t["a"], proof=k in proofs)
            stats[model]["turns"] += 1
            for name, bad in fl.items():
                stats[model][name] += bad
            if any(fl[h] for h in HARD) or fl["leak"] or fl["stage"] or fl["long"]:
                stats[model]["cut"] += 1
                break  # keep the clean prefix of the conversation
            msgs += [{"role": "user", "content": t["q"]}, {"role": "assistant", "content": t["a"]}]
        if len(msgs) >= 5:
            split = "val" if zlib.crc32(rec["seed"].encode()) % 20 == 0 else "train"
            out[split].append({"id": row["id"], "killer": rec["killer"], "teacher": model, "messages": msgs})
            stats[model]["kept_convs"] += 1
        stats[model]["convs"] += 1

    (ROOT / "data/sft").mkdir(parents=True, exist_ok=True)
    for split, rows in out.items():
        with (ROOT / f"data/sft/{split}.jsonl").open("w", encoding="utf-8") as fh:
            for r in rows:
                fh.write(json.dumps(r, ensure_ascii=False) + "\n")
    cols = ["convs", "kept_convs", "turns", "cut", "contradict", "leak", "confess", "meta", "invented", "long", "stage"]
    print(f"{'teacher':28}" + "".join(f"{c:>11}" for c in cols))
    for m, s in sorted(stats.items()):
        print(f"{m:28}" + "".join(f"{s[c]:>11}" for c in cols))
    turns = sum(len(r["messages"]) // 2 for r in out["train"])
    print(f"\ntrain: {len(out['train'])} conversations, {turns} replies | val: {len(out['val'])} conversations")


if __name__ == "__main__":
    main()

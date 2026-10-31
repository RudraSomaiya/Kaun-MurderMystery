"""Can the case still be solved from what the model's suspects actually say?

Every suspect in a held-out case is asked where they were at the time of death and who was
with them. A rule-based detective then applies the same logic as engine/src/solvable.ts to the
answers (not to the ground truth): arrest the one suspect nobody vouches for, preferring one whose
story someone contradicts. Perfect suspects give a 100% solve rate; leaks, lies and vagueness lower it.

    python eval/detective.py --model hf:Qwen/Qwen3.5-0.8B --cases 50
"""
import argparse
import json
import pathlib
import random
import sys
from collections import defaultdict

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "train"))
sys.path.insert(0, str(ROOT / "eval"))
from filters import Case  # noqa: E402
from interrogate import api_backend, clean, hf_backend  # noqa: E402


def detect(answers):
    """answers: {name: (room or None, set of names they say were with them)} -> list of candidates."""
    vouched = {s for s, (room, _) in answers.items() if room and any(o != s and r2 == room and s in w2 for o, (r2, w2) in answers.items())}
    loose = [s for s in answers if s not in vouched]
    contradicted = [s for s in loose if answers[s][0] and any(o != s and r2 == answers[s][0] and s not in w2 and w2 for o, (r2, w2) in answers.items())]
    return contradicted or loose


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True)
    ap.add_argument("--name", default="")
    ap.add_argument("--cases", type=int, default=50)
    args = ap.parse_args()
    name = args.name or args.model.split(":", 1)[1]

    by_case = defaultdict(list)
    for line in (ROOT / "data/nights/eval.jsonl").open(encoding="utf-8"):
        r = json.loads(line)
        by_case[r["seed"]].append(r)
    cases = list(by_case.values())[: args.cases]

    kind, spec = args.model.split(":", 1)
    generate, bs = hf_backend(str(ROOT / spec) if (ROOT / spec).exists() else spec) if kind == "hf" else api_backend(spec)

    items = []
    for recs in cases:
        tod = recs[0]["facts"]["murder"]["time"]
        for r in recs:
            q = f"Where were you at {tod}, and who was with you?"
            items.append((r, q, [{"role": "system", "content": r["system"]}, {"role": "user", "content": q}]))
    replies = []
    for i in range(0, len(items), bs):
        replies += generate([m for _, _, m in items[i : i + bs]])

    solved, expected, log = 0, 0.0, []
    k = 0
    for recs in cases:
        answers, killer = {}, None
        tod = recs[0]["facts"]["murder"]["time"]
        step = recs[0]["facts"]["times"].index(tod)
        names = {p for r in recs for p in r["facts"]["people"]}
        for r in recs:
            a = clean(replies[k], r["name"])
            k += 1
            c = Case(r)
            rooms = {room for s, room in c.claims(a) if s == step}
            room = rooms.pop() if len(rooms) == 1 else None
            with_ = {n for n in names if n != r["name"] and n in a}
            answers[r["name"]] = (room, with_)
            if r["killer"]:
                killer = r["name"]
            log.append({"case": r["seed"], "name": r["name"], "killer": r["killer"], "reply": a, "room": room, "with": sorted(with_)})
        cands = detect(answers)
        pick = random.Random(recs[0]["seed"]).choice(cands)
        solved += pick == killer
        expected += (killer in cands) / len(cands)

    out = ROOT / "eval/results" / f"detective_{name.replace('/', '_').replace(' ', '_').replace(':', '')}.json"
    out.write_text(json.dumps({"name": name, "cases": len(cases), "solved": solved, "expected": expected, "log": log}, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{name}: solved {solved}/{len(cases)} (expected {100 * expected / len(cases):.1f}%)")


if __name__ == "__main__":
    main()

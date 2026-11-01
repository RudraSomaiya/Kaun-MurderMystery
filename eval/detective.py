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
import sys
from collections import defaultdict

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "train"))
sys.path.insert(0, str(ROOT / "eval"))
from filters import Case  # noqa: E402


def question(recs):
    return f"Where were you at {recs[0]['facts']['murder']['time']}, and who was with you?"


def detect(answers):
    """answers: {name: (room or None, set of names they say were with them)} -> list of candidates."""
    vouched = {s for s, (room, _) in answers.items() if room and any(o != s and r2 == room and s in w2 for o, (r2, w2) in answers.items())}
    loose = [s for s in answers if s not in vouched]
    contradicted = [s for s in loose if answers[s][0] and any(o != s and r2 == answers[s][0] and s not in w2 and w2 for o, (r2, w2) in answers.items())]
    return contradicted or loose


def solve_case(recs, replies):
    """Chance (0..1) that the detective arrests the right person, given each suspect's reply."""
    q = question(recs)
    step = recs[0]["facts"]["times"].index(recs[0]["facts"]["murder"]["time"])
    names = {p for r in recs for p in r["facts"]["people"]}
    answers = {}
    for r, a in zip(recs, replies):
        rooms = {room for s, room in Case(r).claims(a, q) if s == step}
        answers[r["name"]] = (rooms.pop() if len(rooms) == 1 else None, {n for n in names if n != r["name"] and n in a})
    killer = next(r["name"] for r in recs if r["killer"])
    cands = detect(answers)
    return (killer in cands) / len(cands)


def main():
    from interrogate import api_backend, clean, hf_backend

    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True)
    ap.add_argument("--name", default="")
    ap.add_argument("--cases", type=int, default=50)
    ap.add_argument("--split", default="eval")
    args = ap.parse_args()
    name = args.name or args.model.split(":", 1)[1]

    by_case = defaultdict(list)
    for line in (ROOT / f"data/nights/{args.split}.jsonl").open(encoding="utf-8"):
        r = json.loads(line)
        by_case[r["seed"]].append(r)
    cases = list(by_case.values())[: args.cases]

    kind, spec = args.model.split(":", 1)
    generate, bs = hf_backend(str(ROOT / spec) if (ROOT / spec).exists() else spec) if kind == "hf" else api_backend(spec)
    items = [(r, [{"role": "system", "content": r["system"]}, {"role": "user", "content": question(recs)}]) for recs in cases for r in recs]
    replies = []
    for i in range(0, len(items), bs):
        replies += generate([m for _, m in items[i : i + bs]])
    replies = [clean(a, r["name"]) for (r, _), a in zip(items, replies)]

    total, k, log = 0.0, 0, []
    for recs in cases:
        mine = replies[k : k + len(recs)]
        k += len(recs)
        total += solve_case(recs, mine)
        log += [{"case": r["seed"], "name": r["name"], "killer": r["killer"], "reply": a} for r, a in zip(recs, mine)]

    out = ROOT / "eval/results" / f"detective_{name.replace('/', '_').replace(' ', '_').replace(':', '')}.json"
    out.write_text(json.dumps({"name": name, "cases": len(cases), "expected": total, "log": log}, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{name}: expected solve rate {100 * total / len(cases):.1f}% over {len(cases)} cases")


if __name__ == "__main__":
    main()

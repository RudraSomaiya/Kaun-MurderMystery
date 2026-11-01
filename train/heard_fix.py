"""Targeted data for one gap: earshot witnesses never said they heard the murder.

Only about a third of suspects are within earshot, and the teacher data mostly asked the others,
so every model we trained learned that the answer to "did you hear anything?" is always no.
Witness answers here are written from templates, so they are right by construction, and open with
the character's own catchphrase from their sheet. Non-witness answers are the model's own,
kept only if they pass the checks. The two kinds are balanced.

    python train/heard_fix.py --model train/out/grpo2-q35-08b/adapter --n 700
"""
import argparse
import json
import pathlib
import random
import re

from filters import Case

ROOT = pathlib.Path(__file__).resolve().parent.parent
QUESTIONS = [
    "Did you hear anything unusual tonight?",
    "Hear anything strange at any point?",
    "Any odd sounds while you were there?",
    "Did anything catch your ear tonight?",
    "Were there any noises from the rooms nearby?",
    "Did you hear a scream, a crash, anything like that?",
    "Kuch suna tumne? Koi awaaz?",
    "Think carefully. Did you hear anything tonight?",
]
TEMPLATES = [
    "{p}yes. Around {time} I heard {sound} from the {room}. I thought it was just the party.",
    "{p}I did, actually. At about {time} there was {sound} from the {room}.",
    "{p}now that you ask, yes. {Sound}, from the {room}, around {time}. I didn't go and check.",
    "{p}I was in the {mine} and heard {sound} through the wall, from the {room}. Around {time}.",
    "{p}around {time}, {sound} from the {room}. Everyone else was too busy to notice, but I heard it.",
    "{p}yes, {sound} from the {room}, maybe {time}. It gave me a fright, but I thought someone dropped something.",
]
HEARD = re.compile(r"Heard (.+?) from the (.+?)\.")
SOUND = re.compile(r"\b(heard|hear|scream|thud|crash|shatter|glass|sound|noise|cry|yell)\b", re.I)
DENIAL = re.compile(r"\b(nothing|didn't hear|did not hear|no sound)\b", re.I)


def witness_answer(r, rng):
    sheet = r["system"]
    sound, room = HEARD.search(sheet).groups()
    line = next(a for a in r["facts"]["account"] if a.get("heard"))
    voice = next((l for l in sheet.splitlines() if l.startswith("How you talk")), "")
    phrases = [w for w in re.findall(r"'([^']+)'", voice) if len(w.split()) <= 2]
    p = f"{rng.choice(phrases).capitalize()}, " if phrases and rng.random() < 0.8 else ""
    text = rng.choice(TEMPLATES).format(p=p, time=line["time"], sound=sound, Sound=sound[0].upper() + sound[1:], room=room, mine=line["room"])
    return text[0].upper() + text[1:]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="train/out/grpo2-q35-08b/adapter")
    ap.add_argument("--n", type=int, default=700)
    args = ap.parse_args()
    rng = random.Random(5)

    recs = [json.loads(l) for l in (ROOT / "data/nights/train.jsonl").open(encoding="utf-8")]
    heard = [r for r in recs if any(a.get("heard") for a in r["facts"]["account"])]
    quiet = [r for r in recs if not any(a.get("heard") for a in r["facts"]["account"])]
    row = lambda r, q, a: {"id": r["id"], "killer": r["killer"], "teacher": "heard-fix", "messages": [{"role": "system", "content": r["system"]}, {"role": "user", "content": q}, {"role": "assistant", "content": a}]}

    out = []
    for r in rng.sample(heard, args.n):
        q, a = rng.choice(QUESTIONS), witness_answer(r, rng)
        fl = Case(r).check(q, a)
        if not (fl["contradict"] or fl["meta"] or fl["leak"] or fl["long"]):
            out.append(row(r, q, a))
    positives = len(out)

    from unsloth import FastLanguageModel

    model, tok = FastLanguageModel.from_pretrained(str(ROOT / args.model), max_seq_length=3072, load_in_4bit=False)
    tok = getattr(tok, "tokenizer", tok)
    FastLanguageModel.for_inference(model)
    tok.padding_side = "left"
    stop = [tok.convert_tokens_to_ids(t) for t in ("<|im_end|>", "<|endoftext|>")]
    pool = rng.sample(quiet, int(args.n * 1.5))
    for i in range(0, len(pool), 24):
        if len(out) >= 2 * positives:
            break
        batch = pool[i : i + 24]
        qs = [rng.choice(QUESTIONS) for _ in batch]
        prompts = [tok.apply_chat_template([{"role": "system", "content": r["system"]}, {"role": "user", "content": q}], tokenize=False, add_generation_prompt=True, enable_thinking=False) for r, q in zip(batch, qs)]
        enc = tok(prompts, return_tensors="pt", padding=True).to(model.device)
        gen = model.generate(**enc, max_new_tokens=90, do_sample=True, temperature=0.8, top_p=0.95, eos_token_id=stop, pad_token_id=tok.pad_token_id)
        for r, q, g in zip(batch, qs, gen):
            a = re.sub(r"<think>.*?</think>", "", tok.decode(g[enc.input_ids.shape[1] :], skip_special_tokens=True), flags=re.S).strip()
            case = Case(r)
            keys = next(k for room, k in case.aliases if room == case.murder_room)
            claims_it = any(k in a.lower() for k in keys) and SOUND.search(a) and not DENIAL.search(a)
            fl = case.check(q, a)
            if not (claims_it or fl["contradict"] or fl["meta"] or fl["confess"] or fl["leak"] or fl["long"] or fl["stage"]) and len(out) < 2 * positives:
                out.append(row(r, q, a))
        print(f"{min(i + 24, len(pool))}/{len(pool)}: {positives} witnesses, {len(out) - positives} non-witnesses", flush=True)

    rng.shuffle(out)
    path = ROOT / "data/sft/heard.jsonl"
    path.write_text("\n".join(json.dumps(o, ensure_ascii=False) for o in out) + "\n", encoding="utf-8")
    print("wrote", path, len(out))
    for o in out[:6]:
        print(" ", o["messages"][1]["content"], "->", o["messages"][2]["content"])


if __name__ == "__main__":
    main()

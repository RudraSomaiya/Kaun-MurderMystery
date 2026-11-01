"""Supervised fine-tuning on the filtered teacher interrogations (LoRA, Unsloth).

Runs in WSL:
    python train/sft.py --model Qwen/Qwen3.5-0.8B --out train/out/sft-q35-08b
    python train/sft.py --smoke              # 10 steps, to check everything loads
"""
import argparse
import json
import pathlib

from unsloth import FastLanguageModel, is_bfloat16_supported  # must come before transformers/trl
from unsloth.chat_templates import train_on_responses_only
from datasets import load_dataset
from trl import SFTConfig, SFTTrainer

ROOT = pathlib.Path(__file__).resolve().parent.parent

ap = argparse.ArgumentParser()
ap.add_argument("--model", default="Qwen/Qwen3.5-0.8B")
ap.add_argument("--out", default="train/out/sft-q35-08b")
ap.add_argument("--epochs", type=float, default=2)
ap.add_argument("--lr", type=float, default=2e-4)
ap.add_argument("--rank", type=int, default=32)
ap.add_argument("--seq", type=int, default=3072)
ap.add_argument("--data", default=str(ROOT / "data/sft"))
ap.add_argument("--batch", type=int, default=2)
ap.add_argument("--smoke", action="store_true")
ap.add_argument("--init", default="", help="continue training an existing LoRA adapter")
ap.add_argument("--extra", default="", help="extra jsonl mixed into the training set")
args = ap.parse_args()

if args.init:
    model, tok = FastLanguageModel.from_pretrained(args.init, max_seq_length=args.seq, load_in_4bit=False, dtype=None)
    tok = getattr(tok, "tokenizer", tok)
    for n, p in model.named_parameters():
        p.requires_grad = "lora_" in n
else:
    model, tok = FastLanguageModel.from_pretrained(args.model, max_seq_length=args.seq, load_in_4bit=False, dtype=None)
    tok = getattr(tok, "tokenizer", tok)  # multimodal checkpoints hand back a processor
    model = FastLanguageModel.get_peft_model(
        model,
        r=args.rank,
        lora_alpha=args.rank,
        lora_dropout=0,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        use_gradient_checkpointing="unsloth",
        random_state=7,
    )
print("trainable params:", sum(p.numel() for p in model.parameters() if p.requires_grad))

train_files = [f"{args.data}/train.jsonl"] + ([args.extra] if args.extra else [])
ds = load_dataset("json", data_files={"train": train_files, "val": f"{args.data}/val.jsonl"})
render = lambda ex: {"text": tok.apply_chat_template(ex["messages"], tokenize=False, enable_thinking=False)}
ds = ds.map(render, remove_columns=ds["train"].column_names)
ds = ds.filter(lambda ex: len(tok(ex["text"]).input_ids) <= args.seq)
print(ds)
print(ds["train"][0]["text"][-700:])

trainer = SFTTrainer(
    model=model,
    processing_class=tok,
    train_dataset=ds["train"],
    eval_dataset=ds["val"],
    args=SFTConfig(
        dataset_text_field="text",
        max_length=args.seq,
        per_device_train_batch_size=args.batch,
        gradient_accumulation_steps=16 // args.batch,
        num_train_epochs=args.epochs,
        max_steps=10 if args.smoke else -1,
        learning_rate=args.lr,
        lr_scheduler_type="cosine",
        warmup_steps=0.05,
        weight_decay=0.01,
        logging_steps=5,
        eval_strategy="steps",
        eval_steps=10 if args.smoke else 50,
        save_steps=100,
        save_total_limit=2,
        bf16=is_bfloat16_supported(),
        fp16=not is_bfloat16_supported(),
        optim="adamw_8bit",
        output_dir=str(pathlib.Path(args.out).resolve()),
        report_to="none",
        seed=7,
    ),
)
# loss only on the suspect's replies, not on the sheet or the detective's questions
trainer = train_on_responses_only(trainer, instruction_part="<|im_start|>user\n", response_part="<|im_start|>assistant\n")
stats = trainer.train()
out = pathlib.Path(args.out).resolve()
model.save_pretrained(str(out / "adapter"))
tok.save_pretrained(str(out / "adapter"))
(out / "train_stats.json").write_text(json.dumps({"metrics": stats.metrics, "log": trainer.state.log_history}, indent=1))
print("saved", args.out)

#!/usr/bin/env bash
# LoRA adapter -> merged fp16 checkpoint -> MLC q4f16_1 weights for WebLLM.
# The architecture is unchanged by fine-tuning, so the browser reuses the prebuilt
# Qwen3.5-0.8B WebGPU kernels; only the weights are ours.
#
#   bash train/export_webllm.sh train/out/sft-q35-08b/adapter
set -euo pipefail
cd "$(dirname "$0")/.."

ADAPTER=${1:-train/out/sft-q35-08b/adapter}
MERGED=${2:-train/out/merged}
OUT=${3:-game/public/models/kaun-0.8b}
PREBUILT=mlc-ai/Qwen3.5-0.8B-q4f16_1-MLC

# merge on CPU so it never competes with training for VRAM
~/.venvs/mlc/bin/python - "$ADAPTER" "$MERGED" <<'PY'
import json, sys, torch
from peft import PeftModel
from transformers import AutoModelForImageTextToText, AutoTokenizer

adapter, out = sys.argv[1:]
base_id = json.load(open(f"{adapter}/adapter_config.json"))["base_model_name_or_path"]
model = AutoModelForImageTextToText.from_pretrained(base_id, dtype=torch.bfloat16)
model = PeftModel.from_pretrained(model, adapter).merge_and_unload()
model.save_pretrained(out)
AutoTokenizer.from_pretrained(adapter).save_pretrained(out)
PY

rm -rf "$OUT" && mkdir -p "$OUT"
~/.venvs/mlc/bin/python -m mlc_llm convert_weight "$MERGED" --quantization q4f16_1 --device cpu -o "$OUT"

# chat config and tokenizer from the prebuilt package, so they match the prebuilt kernels exactly
TMP=$(mktemp -d)
~/.venvs/kaun/bin/hf download "$PREBUILT" --include "mlc-chat-config.json" "tokenizer*" "vocab.json" "merges.txt" --local-dir "$TMP" >/dev/null
cp "$TMP"/mlc-chat-config.json "$TMP"/tokenizer* "$OUT"/
cp "$TMP"/vocab.json "$TMP"/merges.txt "$OUT"/ 2>/dev/null || true
rm -rf "$TMP"
du -sh "$OUT"
ls "$OUT"

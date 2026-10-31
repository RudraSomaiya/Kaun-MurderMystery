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

~/.venvs/kaun/bin/python - "$ADAPTER" "$MERGED" <<'PY'
import sys
from unsloth import FastLanguageModel

model, tok = FastLanguageModel.from_pretrained(sys.argv[1], load_in_4bit=False)
model.save_pretrained_merged(sys.argv[2], tok, save_method="merged_16bit")
PY

rm -rf "$OUT" && mkdir -p "$OUT"
~/.venvs/mlc/bin/mlc_llm convert_weight "$MERGED" --quantization q4f16_1 --model-type qwen35 --device cpu -o "$OUT"

# chat config and tokenizer from the prebuilt package, so they match the prebuilt kernels exactly
TMP=$(mktemp -d)
~/.venvs/kaun/bin/hf download "$PREBUILT" --include "mlc-chat-config.json" "tokenizer*" "vocab.json" "merges.txt" --local-dir "$TMP" >/dev/null
cp "$TMP"/mlc-chat-config.json "$TMP"/tokenizer* "$OUT"/
cp "$TMP"/vocab.json "$TMP"/merges.txt "$OUT"/ 2>/dev/null || true
rm -rf "$TMP"
du -sh "$OUT"
ls "$OUT"

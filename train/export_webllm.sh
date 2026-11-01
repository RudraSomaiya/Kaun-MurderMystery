#!/usr/bin/env bash
# LoRA adapter -> merged fp16 checkpoint -> MLC q4f16_1 weights for WebLLM.
# The architecture is unchanged by fine-tuning, so the browser reuses the prebuilt
# Qwen3.5-0.8B WebGPU kernels; only the weights are ours. Quantization is done by
# train/mlc_quantize.py because the MLC nightly crashes compiling its own quantizer.
#
#   bash train/export_webllm.sh train/out/sft-q35-08b/adapter
set -euo pipefail
cd "$(dirname "$0")/.."

ADAPTER=${1:-train/out/sft-q35-08b/adapter}
MERGED=${2:-train/out/merged}
# same layout as a Hugging Face repo, which is what WebLLM expects
OUT=${3:-game/public/models/kaun-0.8b/resolve/main}
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

# the nightly's loader passes TVM dtype objects to numpy; cast them to strings (idempotent)
sed -i 's/\.astype(dtype)/.astype(str(dtype))/g' ~/.venvs/mlc/lib/python3.12/site-packages/mlc_llm/model/qwen35/qwen35_loader.py

PREBUILT_DIR=train/out/prebuilt-q35-08b
[ -f "$PREBUILT_DIR/tensor-cache.json" ] || ~/.venvs/kaun/bin/hf download "$PREBUILT" --local-dir "$PREBUILT_DIR" >/dev/null
rm -rf "$OUT"
~/.venvs/mlc/bin/python train/mlc_quantize.py "$MERGED" "$PREBUILT_DIR" "$OUT"
du -sh "$OUT"

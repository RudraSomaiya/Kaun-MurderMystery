#!/usr/bin/env bash
# The whole model pipeline after teacher data exists. Runs in WSL with ~/.venvs/kaun (see train/pyproject.toml).
#   npm run nights -- train 3000 && npm run nights -- eval 100 && npm run nights -- unseen 50 taash
#   python train/gen_teacher.py        # on any machine, resumable
#   bash train/pipeline.sh
set -euo pipefail
cd "$(dirname "$0")/.."
source ~/.venvs/kaun/bin/activate

python train/filters.py                                                   # checks -> data/sft
python train/sft.py --model Qwen/Qwen3.5-0.8B --out train/out/sft2-q35-08b
python train/grpo.py --init train/out/sft2-q35-08b/adapter --out train/out/grpo2-q35-08b --steps 300 --voice 0.25 --beta 0.05
python train/heard_fix.py --model train/out/grpo2-q35-08b/adapter --n 700   # earshot witnesses must report the sound
python train/sft.py --init train/out/grpo2-q35-08b/adapter --extra data/sft/heard.jsonl --epochs 1 --lr 5e-5 --out train/out/final-q35-08b

for m in "Qwen/Qwen3.5-0.8B|Qwen3.5-0.8B (base)" "Qwen/Qwen3.5-2B|Qwen3.5-2B (base)" \
         "train/out/sft2-q35-08b/adapter|Ours: SFT" "train/out/grpo2-q35-08b/adapter|Ours: SFT + GRPO (voice reward)" \
         "train/out/final-q35-08b/adapter|Ours: final"; do
  path=${m%%|*}; name=${m##*|}
  python eval/interrogate.py --model "hf:$path" --name "$name"
  python eval/detective.py --model "hf:$path" --name "$name"
  python eval/interrogate.py --split unseen --model "hf:$path" --name "$name · unseen setting"
  python eval/detective.py --split unseen --model "hf:$path" --name "$name · unseen setting"
done
python eval/metrics.py

bash train/export_webllm.sh train/out/final-q35-08b/adapter train/out/merged-final game/public/models/kaun-0.8b/resolve/main
bash train/export_webllm.sh train/out/sft2-q35-08b/adapter train/out/merged-sft2 game/public/models/kaun-0.8b-sft/resolve/main

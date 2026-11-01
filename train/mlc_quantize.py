"""Quantize a Qwen3.5 checkpoint to MLC's q4f16_1 format without compiling anything.

MLC's own convert_weight compiles its quantization kernel with TVM, and the current nightly's
CPU backend segfaults doing that. The format itself is simple, so this does it in NumPy:
groups of 32 along the input dimension, scale = max|w| / 7 in fp16, 4-bit codes packed eight to
a uint32. Tensor names, shapes and shard layout are copied from the official prebuilt package,
so the browser can use the prebuilt WebGPU kernels unchanged.

    python train/mlc_quantize.py <hf_checkpoint_dir> <prebuilt_dir> <out_dir>
    python train/mlc_quantize.py <base_checkpoint_dir> <prebuilt_dir> --check   # compare with the official weights
"""
import hashlib
import json
import pathlib
import shutil
import sys

import numpy as np
import tvm

tvm.tirx.analysis.verify_well_formed = lambda *a, **k: True  # nightly verifier crashes on the RNN-state kernels
from mlc_llm.loader import HuggingFaceLoader  # noqa: E402
from mlc_llm.model import MODELS  # noqa: E402
from mlc_llm.quantization import QUANTIZATION  # noqa: E402


def q4f16(w):
    """[N, K] float16 -> ([N, K/8] uint32 codes, [N, K/32] float16 scales)."""
    n, k = w.shape
    g = w.astype(np.float16).reshape(n, k // 32, 32)
    scale = (np.abs(g).max(axis=2) / np.float16(7)).astype(np.float16)
    safe = np.where(scale == 0, np.float16(1), scale)  # all-zero group: every code is 7, i.e. zero
    q = np.clip(np.round(g / safe[..., None] + np.float16(7)), 0, 14).astype(np.uint32).reshape(n, k // 8, 8)
    packed = np.zeros((n, k // 8), np.uint32)
    for i in range(8):
        packed |= q[:, :, i] << np.uint32(4 * i)
    return packed, scale


def to_bf16_bytes(x):
    u = np.ascontiguousarray(x, np.float32).view(np.uint32)
    return ((u + 0x7FFF + ((u >> 16) & 1)) >> 16).astype(np.uint16).tobytes()


def tensors(src):
    info = MODELS["qwen3_5"]
    config = info.config.from_file(pathlib.Path(src) / "config.json")
    mapping = info.source["huggingface-safetensor"](config, QUANTIZATION["q4f16_1"])
    loader = HuggingFaceLoader(path=pathlib.Path(src) / "model.safetensors.index.json", extern_param_map=mapping)
    return {name: t.numpy() for name, t in loader.load(device=tvm.cpu())}


def encode(params, rec, cache):
    name = rec["name"]
    if name.endswith((".q_weight", ".q_scale")):
        base = name.rsplit(".", 1)[0] + ".weight"
        if base not in cache:
            cache.clear()
            cache[base] = q4f16(params[base])
        arr = cache[base][0 if name.endswith("q_weight") else 1]
        return arr.astype(rec["dtype"]).tobytes()
    x = params[name]
    numel = int(np.prod(rec["shape"]))
    if rec["dtype"] == "float32" and rec["nbytes"] == 2 * numel:
        return to_bf16_bytes(x)
    return np.ascontiguousarray(x.astype(rec["dtype"])).tobytes()


def main():
    src, prebuilt = sys.argv[1], pathlib.Path(sys.argv[2])
    check = sys.argv[3] == "--check"
    cache_json = json.loads((prebuilt / "tensor-cache.json").read_text())
    params = tensors(src)
    print(f"loaded {len(params)} tensors from {src}")
    cache = {}
    if check:
        same = total = 0
        for shard in cache_json["records"]:
            ref = (prebuilt / shard["dataPath"]).read_bytes()
            for rec in shard["records"]:
                mine = np.frombuffer(encode(params, rec, cache), np.uint8)
                theirs = np.frombuffer(ref[rec["byteOffset"] : rec["byteOffset"] + rec["nbytes"]], np.uint8)
                assert mine.size == theirs.size, rec["name"]
                same += int((mine == theirs).sum())
                total += mine.size
                if rec["name"].endswith("embed_tokens.q_weight") or "layers.3." in rec["name"]:
                    print(f"  {rec['name']:55} {100 * (mine == theirs).mean():6.2f}% identical bytes")
        print(f"overall: {100 * same / total:.3f}% of {total:,} bytes identical to the official package")
        return

    out = pathlib.Path(sys.argv[3])
    out.mkdir(parents=True, exist_ok=True)
    for shard in cache_json["records"]:
        buf = bytearray(shard["nbytes"])
        for rec in shard["records"]:
            data = encode(params, rec, cache)
            assert len(data) == rec["nbytes"], (rec["name"], len(data), rec["nbytes"])
            buf[rec["byteOffset"] : rec["byteOffset"] + rec["nbytes"]] = data
        (out / shard["dataPath"]).write_bytes(buf)
        shard["md5sum"] = hashlib.md5(buf).hexdigest()
    (out / "tensor-cache.json").write_text(json.dumps(cache_json))
    for f in ["tokenizer.json", "tokenizer_config.json", "vocab.json", "merges.txt"]:
        if (prebuilt / f).exists():
            shutil.copy(prebuilt / f, out / f)
    chat = json.loads((prebuilt / "mlc-chat-config.json").read_text())
    chat["context_window_size"] = 4096  # the prebuilt asks for 262k, gigabytes of KV cache in the browser
    (out / "mlc-chat-config.json").write_text(json.dumps(chat, indent=2))
    print(f"wrote {len(cache_json['records'])} shards to {out}")


if __name__ == "__main__":
    main()

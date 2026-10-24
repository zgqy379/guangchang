"""W1 实测 2.1b：对照实验——货币主题是否触发内容审核
- 参数A: 金币堆（中性主题，验证管线本身）
- 参数B: 虚构货币 fantasy banknote（验证虚构币面是否可过）
"""
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, r"C:\Users\dqy\tools\Aholo-Lux3D\plugins\common\aholo-lux3d\core\runtime")

from lux3d_client import generate_text_to_3d  # noqa: E402

TESTS = [
    {
        "id": "gold-coins",
        "assetLine": "props-gold",
        "prompt": (
            "A small stack of stylized gold coins, mobile game asset, "
            "clean silhouette, single object, no background"
        ),
        "style": "cartoon",
    },
    {
        "id": "fantasy-banknote",
        "assetLine": "money-gc-coin",
        "prompt": (
            "A neat bundle of fictional fantasy banknotes with glowing blue "
            "patterns, original made-up currency design, mobile game asset, "
            "clean silhouette, single object, no background"
        ),
        "style": "cartoon",
    },
]

for t in TESTS:
    out_dir = Path(rf"E:\guangchang\docs\iterations\lux3d-money\2026-10-25-{t['id']}")
    out_dir.mkdir(parents=True, exist_ok=True)
    t0 = time.time()
    status = "success"
    err = None
    try:
        result = generate_text_to_3d(
            t["prompt"],
            output_path=str(out_dir / "output"),
            version="G1-Turbo",
            style=t["style"],
            outputFormat="glb",
            enablePbr=True,
            region="cn",
        )
    except Exception as e:  # noqa: BLE001 — 实测记录一切失败形态
        status = "failed"
        err = f"{type(e).__name__}: {e}"[:800]
    elapsed = round(time.time() - t0, 1)
    meta = {
        "date": "2026-10-25T22:30:00+08:00",
        "pipeline": "lux3d",
        "assetLine": t["assetLine"],
        "version": t["id"],
        "prompt": t["prompt"],
        "params": {"mode": "G1-Turbo", "style": t["style"], "outputFormat": "glb", "enablePbr": True},
        "result": status,
        "elapsedSeconds": elapsed,
        "error": err,
        "note": "对照实验：v1 真钞 prompt 失败(provider status=4)，本组验证是否内容审核所致",
    }
    (out_dir / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[{t['id']}] {status} elapsed={elapsed}s err={err}")
    for f in sorted(out_dir.rglob("*")):
        if f.is_file() and f.name != "meta.json":
            print("  FILE:", f.relative_to(out_dir), f.stat().st_size, "bytes")

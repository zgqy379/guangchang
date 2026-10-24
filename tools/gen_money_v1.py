"""W1 实测 2.1：文生 3D —— 风格化钞票捆（资产清单 P0）
产物与 meta 按存档规范写入 docs/iterations/lux3d-money/2026-10-25-v1/
"""
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, r"E:\guangchang\tools\Aholo-Lux3D\plugins\common\aholo-lux3d\core\runtime")

from lux3d_client import generate_text_to_3d  # noqa: E402

PROMPT = (
    "A neat bundle of stylized Chinese 100 yuan banknotes, 50 bills stacked "
    "and wrapped with a red paper strap, low-poly mobile game asset, "
    "clean silhouette, single object, no background"
)

OUT_DIR = Path(r"E:\guangchang\docs\iterations\lux3d-money\2026-10-25-v1")
OUT_DIR.mkdir(parents=True, exist_ok=True)

t0 = time.time()
result = generate_text_to_3d(
    PROMPT,
    output_path=str(OUT_DIR / "output"),
    version="G1-Turbo",
    style="cartoon",
    outputFormat="glb",
    enablePbr=True,
    region="cn",
)
elapsed = round(time.time() - t0, 1)

meta = {
    "date": "2026-10-25T22:00:00+08:00",
    "pipeline": "lux3d",
    "assetLine": "money-bundle",
    "version": "v1",
    "prompt": PROMPT,
    "params": {
        "mode": "G1-Turbo",
        "style": "cartoon",
        "outputFormat": "glb",
        "enablePbr": True,
    },
    "result": "success",
    "elapsedSeconds": elapsed,
    "rawResult": result if isinstance(result, (str, int, float)) else str(result)[:2000],
    "nextAction": "v2：真钞皮肤版用 photorealistic；对比两版作为报告书迭代素材",
}
(OUT_DIR / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"OK elapsed={elapsed}s")
print(json.dumps(meta, ensure_ascii=False, indent=2)[:1500])
for f in sorted(OUT_DIR.rglob("*")):
    if f.is_file() and f.name != "meta.json":
        print("FILE:", f.relative_to(OUT_DIR), f.stat().st_size, "bytes")

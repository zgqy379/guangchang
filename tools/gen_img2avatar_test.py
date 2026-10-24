"""W1 实测 1.1（图生版）：参考图 → 风格化 3D 形象
用户提供的"用于生成有趣的3D形象的照片"，取 2 张各生成一次（G1-Turbo + cartoon）。
安全约束：仅官方上传通道；产物经官方 download_model 落地。
"""
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, r"C:\Users\dqy\tools\Aholo-Lux3D\plugins\common\aholo-lux3d\core\runtime")
from asset_uploader import upload_file  # noqa: E402
from lux3d_client import create_image_to_3d_task, query_task_status, download_requested_models  # noqa: E402

SRC_DIR = Path(r"E:\guangchang\用于生成有趣的3D形象的照片")
PICKS = [
    "Screenshot_2026-02-07-01-40-53-18_2332cb9b27b851b548ba47a91682926c (1).jpg",
    "Screenshot_2025-11-06-11-53-58-92_2332cb9b27b851b548ba47a91682926c.jpg",
]
OUT_ROOT = Path(r"E:\guangchang\docs\iterations\lux3d-avatar")
REGION = "cn"

for pick in PICKS:
    tag = pick.replace("Screenshot_", "").split("_")[0][:8]
    out_dir = OUT_ROOT / f"2026-10-26-img2avatar-{tag}"
    out_dir.mkdir(parents=True, exist_ok=True)
    meta = {"pipeline": "lux3d", "assetLine": "avatar-from-photo", "version": tag, "source": pick}
    t0 = time.time()
    try:
        up = upload_file(str(SRC_DIR / pick), region=REGION)
        meta["imgUrl"] = up["url"]
        task_id = create_image_to_3d_task(
            img=up["url"], version="G1-Turbo", enablePbr=True, region=REGION
        )
        data = query_task_status(task_id, region=REGION)
        meta["result"] = "success"
        meta["elapsedSeconds"] = round(time.time() - t0, 1)
        meta["outputs"] = str(data)[:800]
        # 产物落地（download_requested_models 处理 zip→glb 提取）
        try:
            files = download_requested_models(
                data if isinstance(data, dict) else {}, str(out_dir / "output"), ["glb"]
            )
            meta["downloaded"] = str(files)[:400]
        except Exception as de:  # noqa: BLE001
            meta["downloadError"] = str(de)[:300]
    except Exception as e:  # noqa: BLE001
        meta["result"] = "failed"
        meta["error"] = f"{type(e).__name__}: {e}"[:800]
        meta["elapsedSeconds"] = round(time.time() - t0, 1)
    (out_dir / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[img2avatar-{tag}] {meta['result']} {meta['elapsedSeconds']}s {meta.get('error') or meta.get('downloaded', '')[:120]}")

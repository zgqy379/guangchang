"""world generations 失败定位：
A. 同参数重试（排偶发）
B. 若再失败 → 纯文案无图生成（定位是否图输入导致）
"""
import json
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, r"C:\Users\dqy\tools\Aholo-Lux3D\plugins\common\aholo-lux3d\core\runtime")
from asset_uploader import upload_file  # noqa: E402

from manycore.aholo_sdk_world import create_world_client  # noqa: E402
from manycore.aholo_sdk_core import AholoClientConfig  # noqa: E402

OUT = Path(r"E:\guangchang\docs\iterations\spatialgen-space\2026-10-26-v1\retry-log.json")
world = create_world_client(AholoClientConfig(api_key=os.environ["AHOLO_API_KEY"], region="cn"))
log = []

def attempt(tag, resources):
    t0 = time.time()
    try:
        op = world.generations.create(
            name=f"逛厂示范办公室-{tag}",
            prompt="现代互联网公司开放式办公室，工位、绿植、落地窗、会议室，明亮通透",
            resources=resources,
        )
        wid = op["worldId"]
        detail = world.wait_for(wid)
        entry = {"tag": tag, "worldId": wid, "result": "success", "elapsed": round(time.time() - t0, 1)}
    except Exception as e:  # noqa: BLE001
        entry = {"tag": tag, "result": "failed", "elapsed": round(time.time() - t0, 1), "error": str(e)[:400]}
    log.append(entry)
    print(json.dumps(entry, ensure_ascii=False))
    return entry

# A: 同参数重试
up = upload_file(r"E:\guangchang\办公室内景招聘\IMG_20261024_160541.jpg", region="cn")
a = attempt("retry-with-image", [{"url": up["url"], "type": "image"}])

# B: 纯文案（仅当 A 失败）
if a["result"] != "success":
    attempt("prompt-only", None)

OUT.write_text(json.dumps(log, ensure_ascii=False, indent=2), encoding="utf-8")

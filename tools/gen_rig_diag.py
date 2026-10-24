"""rig 失败诊断：重发一次绑骨任务，完整记录 task_data 错误明细。"""
import json
import sys
from pathlib import Path

sys.path.insert(0, r"C:\Users\dqy\tools\Aholo-Lux3D\plugins\common\aholo-lux3d\core\runtime")

from lux3d_client import create_auto_rig_task  # noqa: E402

MODEL_URL = "https://holo-cos.aholo3d.cn/resource/platform/temp/2026/10/25/NLOO2PYKTLGAMAABAAAAADY8.glb"
OUT = Path(r"E:\guangchang\docs\iterations\lux3d-avatar\2026-10-26-rig-v2\diagnosis.json")

try:
    task_id = create_auto_rig_task(MODEL_URL, region="cn")
    print("taskId:", task_id)
    OUT.write_text(json.dumps({"taskId": str(task_id)}, ensure_ascii=False), encoding="utf-8")
except Exception as e:  # noqa: BLE001
    detail = getattr(e, "task_data", None)
    print("CREATE FAILED:", type(e).__name__, str(e)[:300])
    print("task_data:", json.dumps(detail, ensure_ascii=False, indent=2)[:2000] if detail else None)
    OUT.write_text(json.dumps({"error": str(e), "task_data": detail}, ensure_ascii=False, indent=2, default=str), encoding="utf-8")

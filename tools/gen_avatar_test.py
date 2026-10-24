"""W1 实测 1.3/1.4/1.5：Avatar 管线
- 1.3 文生 3D Avatar ×3（同一模板改单变量，兼顾 1.4 风格锚定测试）
- 1.5 取 v1 的 GLB URL → auto-rig 绑骨任务（若需 quote/授权则记录阻塞原因）
"""
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, r"C:\Users\dqy\tools\Aholo-Lux3D\plugins\common\aholo-lux3d\core\runtime")

from lux3d_client import (  # noqa: E402
    create_text_to_3d_task,
    create_auto_rig_task,
    query_task_status,
)

BASE_PROMPT = (
    "A stylized young office worker avatar, full body, standing, T-pose, "
    "cartoon style, big head small body proportion, big expressive eyes, "
    "clean silhouette, single character, mobile game asset, no background, "
    "{variant}"
)
VARIANTS = [
    ("avatar-v1", "short black hair, wearing a light blue hoodie and jeans"),
    ("avatar-v2", "glasses, short black hair, wearing a light blue hoodie and jeans"),
    ("avatar-v3", "ponytail hairstyle, wearing a light blue hoodie and jeans"),
]

OUT_ROOT = Path(r"E:\guangchang\docs\iterations\lux3d-avatar")
REGION = "cn"


def extract_glb_url(task_data):
    """从任务返回里抓 GLB URL（绑骨输入）。"""
    if isinstance(task_data, str) and task_data.startswith("http"):
        return task_data
    if isinstance(task_data, dict):
        for key in ("glbUrl", "glb_url", "url", "modelUrl"):
            v = task_data.get(key)
            if isinstance(v, str) and v.startswith("http"):
                return v
        for v in task_data.values():
            u = extract_glb_url(v)
            if u:
                return u
    if isinstance(task_data, (list, tuple)):
        for v in task_data:
            u = extract_glb_url(v)
            if u:
                return u
    return None


results = []
for name, variant in VARIANTS:
    out_dir = OUT_ROOT / f"2026-10-26-{name}"
    out_dir.mkdir(parents=True, exist_ok=True)
    prompt = BASE_PROMPT.format(variant=variant)
    t0 = time.time()
    entry = {"id": name, "prompt": prompt, "params": {"mode": "G1-Turbo", "style": "cartoon"}}
    try:
        task_id = create_text_to_3d_task(prompt, version="G1-Turbo", style="cartoon", region=REGION)
        task_data = query_task_status(task_id, region=REGION)
        entry["result"] = "success"
        entry["elapsedSeconds"] = round(time.time() - t0, 1)
        entry["glbUrl"] = extract_glb_url(task_data)
        entry["rawOutputs"] = str(task_data)[:1500]
    except Exception as e:  # noqa: BLE001
        entry["result"] = "failed"
        entry["error"] = f"{type(e).__name__}: {e}"[:800]
        entry["elapsedSeconds"] = round(time.time() - t0, 1)
    (out_dir / "meta.json").write_text(json.dumps(entry, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[{name}] {entry['result']} {entry['elapsedSeconds']}s glb={entry.get('glbUrl')}")
    results.append(entry)

# 1.5 绑骨：用第一个成功的 GLB URL
rig_src = next((r for r in results if r["result"] == "success" and r.get("glbUrl")), None)
if rig_src:
    out_dir = OUT_ROOT / "2026-10-26-rig-v1"
    out_dir.mkdir(parents=True, exist_ok=True)
    t0 = time.time()
    entry = {"id": "rig-v1", "srcAsset": rig_src["id"], "modelUrl": rig_src["glbUrl"]}
    try:
        rig_task = create_auto_rig_task(rig_src["glbUrl"], region=REGION)
        rig_data = query_task_status(rig_task, region=REGION)
        entry["result"] = "success"
        entry["rawOutputs"] = str(rig_data)[:1500]
    except Exception as e:  # noqa: BLE001
        entry["result"] = "failed"
        entry["error"] = f"{type(e).__name__}: {e}"[:800]
    entry["elapsedSeconds"] = round(time.time() - t0, 1)
    (out_dir / "meta.json").write_text(json.dumps(entry, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[rig-v1] {entry['result']} {entry['elapsedSeconds']}s err={entry.get('error')}")
else:
    print("[rig-v1] skipped: no successful avatar glb")

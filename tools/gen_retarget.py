"""W1 实测 1.5 收尾：动画重定向（retarget）
绑骨 Avatar（task 4346472 产物）+ Idle/Walk/Talking 三动画
产物：docs/iterations/lux3d-avatar/2026-10-26-anim/
"""
import ipaddress
import json
import socket
import sys
import time
from pathlib import Path
from urllib.parse import urlparse

import requests

sys.path.insert(0, r"C:\Users\dqy\tools\Aholo-Lux3D\plugins\common\aholo-lux3d\core\runtime")
from lux3d_client import create_animation_retarget_task, query_task_status  # noqa: E402

RIG_URL = "https://maas-cos.kujiale.com/ai-render/output/202610250147032621a167642a4316-0-014703-84db_MaaSReportFile-3ccd01b27196e5b851f83ab8b31431a8.glb"
ANIMS = ["Idle_Loop", "Walk_Loop", "Idle_Talking_Loop"]
OUT_DIR = Path(r"E:\guangchang\docs\iterations\lux3d-avatar\2026-10-26-anim")
OUT_DIR.mkdir(parents=True, exist_ok=True)


def assert_safe_url(u: str) -> str:
    p = urlparse(u)
    h = p.hostname.lower()
    assert p.scheme == "https" and (h.endswith(".kujiale.com") or h.endswith(".aholo3d.cn")), h
    for _, _, _, _, sa in socket.getaddrinfo(h, 443):
        ip = ipaddress.ip_address(sa[0])
        assert not (ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved)
    return u


meta = {"pipeline": "lux3d", "assetLine": "avatar-anim", "date": "2026-10-26T10:30:00+08:00",
        "rigModelUrl": RIG_URL, "animationIds": ANIMS, "attempts": []}

for attempt in range(3):  # provider status=4 偶发，默认重试
    t0 = time.time()
    try:
        task_id = create_animation_retarget_task(
            RIG_URL, ANIMS, animationOutputMode="separate", outFormat="glb", region="cn"
        )
        meta["attempts"].append({"attempt": attempt + 1, "taskId": str(task_id)})
        print("taskId:", task_id, flush=True)
        data = query_task_status(task_id, region="cn")
        meta["result"] = "success"
        meta["elapsedSeconds"] = round(time.time() - t0, 1)
        meta["outputs"] = str(data)[:2000]

        def find_glbs(o, acc):
            if isinstance(o, str) and o.startswith("https") and o.endswith(".glb"):
                acc.append(o)
            elif isinstance(o, dict):
                for v in o.values():
                    find_glbs(v, acc)
            elif isinstance(o, list):
                for v in o:
                    find_glbs(v, acc)

        urls = []
        find_glbs(data, urls)
        meta["glbUrls"] = urls
        for i, u in enumerate(urls):
            assert_safe_url(u)
            rr = requests.get(u, timeout=600, allow_redirects=False)
            rr.raise_for_status()
            f = OUT_DIR / f"avatar-anim-{i}.glb"
            f.write_bytes(rr.content)
            print("saved:", f.name, len(rr.content), "bytes", flush=True)
        break
    except Exception as e:  # noqa: BLE001
        meta["attempts"].append({"attempt": attempt + 1, "error": f"{type(e).__name__}: {e}"[:500]})
        print(f"attempt {attempt+1} failed: {e}", flush=True)
        meta["result"] = "failed"
        meta["error"] = f"{type(e).__name__}: {e}"[:800]
        time.sleep(5)

(OUT_DIR / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
print("[retarget]", meta.get("result"), flush=True)

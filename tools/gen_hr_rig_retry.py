"""补跑 m01/m05：绑骨（provider status=4 偶发重试）→ Idle 重定向
从已有 meta.json 读 model_url（首次运行已上传），无需重新生成。
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
from lux3d_client import (  # noqa: E402
    create_animation_retarget_task,
    create_auto_rig_task,
    query_task_status,
)
from asset_uploader import upload_file  # noqa: E402

ALLOWED = (".kujiale.com", ".aholo3d.cn")


def assert_safe_url(url: str) -> str:
    p = urlparse(url)
    h = p.hostname.lower()
    assert p.scheme == "https" and any(h == s.lstrip(".") or h.endswith(s) for s in ALLOWED), h
    for _, _, _, _, sa in socket.getaddrinfo(h, 443):
        ip = ipaddress.ip_address(sa[0])
        assert not (ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved)
    return url


def find_glbs(o, acc):
    if isinstance(o, str) and o.startswith("https") and o.endswith(".glb"):
        acc.append(o)
    elif isinstance(o, dict):
        [find_glbs(v, acc) for v in o.values()]
    elif isinstance(o, list):
        [find_glbs(v, acc) for v in o]
    return acc


ROOT = Path(r"E:\guangchang\docs\iterations\lux3d-hr\2026-10-25-v2")
for name in ("hr-m01", "hr-m05"):
    out_dir = ROOT / name
    out_dir.mkdir(parents=True, exist_ok=True)
    meta_path = out_dir / "meta.json"
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    model_url = meta.get("steps", {}).get("upload", {}).get("url")
    raw = out_dir / f"{name}-raw.glb"
    if not model_url and raw.exists():
        # 首版 meta 未存 URL，从本地 raw GLB 重新上传
        up = upload_file(str(raw), region="cn")
        model_url = up.get("url")
        meta.setdefault("steps", {})["upload"] = {"url": model_url, "bytes": up.get("size"), "reuploaded": True}
        print(f"[{name}] re-uploaded raw glb", flush=True)
    if not model_url:
        print(f"[{name}] no model_url and no raw file, skip")
        continue
    t0 = time.time()
    try:
        rig_task = create_auto_rig_task(model_url, region="cn")
        rig_data = None
        for a in range(4):
            try:
                rig_data = query_task_status(rig_task, region="cn")
                break
            except Exception as e:  # noqa: BLE001
                print(f"[{name}-rig] attempt {a+1} failed: {e}", flush=True)
                time.sleep(10)
        assert rig_data, "rig failed after retries"
        rig_urls = find_glbs(rig_data, [])
        assert rig_urls, f"no rigged glb: {str(rig_data)[:300]}"
        rig_url = assert_safe_url(rig_urls[0])

        anim_task = create_animation_retarget_task(
            rig_url, ["Idle_Loop"], animationOutputMode="separate", outFormat="glb", region="cn"
        )
        anim_data = query_task_status(anim_task, region="cn")
        anim_urls = find_glbs(anim_data, [])
        assert anim_urls, f"no idle glb: {str(anim_data)[:300]}"
        idle = out_dir / f"{name}-idle.glb"
        idle.write_bytes(requests.get(assert_safe_url(anim_urls[0]), timeout=600, allow_redirects=False).content)
        meta["steps"]["rig"] = {"retried": True}
        meta["steps"]["idleGlb"] = {"file": idle.name, "bytes": idle.stat().st_size}
        meta["result"] = "success"
        meta["elapsedSeconds"] = round(time.time() - t0, 1)
        print(f"[{name}] OK idle={idle.stat().st_size}B", flush=True)
    except Exception as e:  # noqa: BLE001
        meta["result"] = "failed"
        meta["error"] = f"{type(e).__name__}: {e}"[:500]
        print(f"[{name}] FAILED {meta['error']}", flush=True)
    meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
print("RETRY DONE", flush=True)

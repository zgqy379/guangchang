"""对抗式审查修复：Walk 动画改 animateInPlace=True（原地版）
原版未显式设置（默认 False），若含根位移会与 AvatarActor 的移动逻辑叠加（滑步/双倍速）。
产物：avatar-walk-inplace.glb → Draco 压缩替换 web 资产
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
OUT_DIR = Path(r"E:\guangchang\docs\iterations\lux3d-avatar\2026-10-26-anim")
meta = {"pipeline": "lux3d", "assetLine": "avatar-anim", "note": "Walk_Loop animateInPlace=true 重制"}

for attempt in range(3):
    try:
        t0 = time.time()
        task_id = create_animation_retarget_task(
            RIG_URL, ["Walk_Loop"], animationOutputMode="separate", outFormat="glb",
            animateInPlace=True, region="cn",
        )
        data = query_task_status(task_id, region="cn")
        urls = []
        def find(o):
            if isinstance(o, str) and o.startswith("https") and o.endswith(".glb"):
                urls.append(o)
            elif isinstance(o, dict):
                [find(v) for v in o.values()]
            elif isinstance(o, list):
                [find(v) for v in o]
        find(data)
        assert urls, f"no glb url in outputs: {str(data)[:300]}"
        u = urls[0]
        p = urlparse(u)
        h = p.hostname.lower()
        assert p.scheme == "https" and (h.endswith(".kujiale.com") or h.endswith(".aholo3d.cn"))
        for _, _, _, _, sa in socket.getaddrinfo(h, 443):
            ip = ipaddress.ip_address(sa[0])
            assert not (ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved)
        rr = requests.get(u, timeout=600, allow_redirects=False)
        rr.raise_for_status()
        f = OUT_DIR / "avatar-walk-inplace.glb"
        f.write_bytes(rr.content)
        meta.update({"result": "success", "elapsedSeconds": round(time.time() - t0, 1), "file": f.name, "bytes": len(rr.content)})
        break
    except Exception as e:  # noqa: BLE001
        meta.update({"result": "failed", "error": f"{type(e).__name__}: {e}"[:500]})
        time.sleep(5)

(OUT_DIR / "meta-walk-inplace.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
print("[walk-inplace]", meta.get("result"), meta.get("error", ""))

"""W1 实测 3.1：视频世界重建
素材：Pexels 5483080（CC0 类许可，14s 4K 全景摇镜空办公室，4096x2160 25fps）
流程：OUS 上传 mp4 → reconstructions.create(type=video) → wait_for → 下载 spz
"""
import ipaddress
import json
import os
import socket
import sys
import time
from pathlib import Path
from urllib.parse import urlparse

import requests

sys.path.insert(0, r"C:\Users\dqy\tools\Aholo-Lux3D\plugins\common\aholo-lux3d\core\runtime")
from asset_uploader import upload_file  # noqa: E402

from manycore.aholo_sdk_world import create_world_client  # noqa: E402
from manycore.aholo_sdk_core import AholoClientConfig  # noqa: E402

VIDEO = Path(r"E:\guangchang\assets\office-panorama-5483080.mp4")
OUT_DIR = Path(r"E:\guangchang\docs\iterations\reality-office\2026-10-26-v1")
OUT_DIR.mkdir(parents=True, exist_ok=True)

meta = {
    "date": "2026-10-26T03:00:00+08:00",
    "pipeline": "world-recon",
    "assetLine": "office-space",
    "version": "v1",
    "source": "Pexels 5483080 (free license) 14s UHD panorama, empty office with cubicles",
    "steps": {},
}

up = upload_file(str(VIDEO), region="cn")
meta["steps"]["upload"] = {"url": up["url"], "bytes": up.get("size")}
print("uploaded:", up["url"], flush=True)

world = create_world_client(AholoClientConfig(api_key=os.environ["AHOLO_API_KEY"], region="cn"))
t0 = time.time()
try:
    op = world.reconstructions.create(
        name="逛厂示范办公室-重建",
        resources=[{"url": up["url"], "type": "video"}],
        task_quality="normal",
        scene="space",
    )
    wid = op["worldId"]
    meta["steps"]["create"] = {"worldId": str(wid)}
    print("worldId:", wid, flush=True)
    detail = world.wait_for(wid)
    meta["result"] = "success"
    meta["elapsedSeconds"] = round(time.time() - t0, 1)
    d = json.loads(json.dumps(detail, ensure_ascii=False, default=str))
    meta["detail"] = d
    urls = ((d.get("assets") or {}).get("splats") or {}).get("urls") or {}

    def safe(u):
        p = urlparse(u)
        h = p.hostname.lower()
        assert p.scheme == "https" and (h.endswith(".kujiale.com") or h.endswith(".aholo3d.cn")), h
        for _, _, _, _, sa in socket.getaddrinfo(h, 443):
            ip = ipaddress.ip_address(sa[0])
            assert not (ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved)
        return u

    for key in ("spzPath", "plyPath"):
        u = urls.get(key)
        if not u:
            continue
        rr = requests.get(safe(u), timeout=900, allow_redirects=False)
        rr.raise_for_status()
        f = OUT_DIR / f"office-recon.{key.removesuffix('Path')}"
        f.write_bytes(rr.content)
        meta["steps"]["downloads"] = meta["steps"].get("downloads", {}) | {key: {"file": f.name, "bytes": len(rr.content)}}
        print("downloaded:", f.name, len(rr.content), flush=True)
except Exception as e:  # noqa: BLE001
    meta["result"] = "failed"
    meta["error"] = f"{type(e).__name__}: {e}"[:1200]
    meta["elapsedSeconds"] = round(time.time() - t0, 1)

(OUT_DIR / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"[recon] {meta.get('result')} {meta.get('elapsedSeconds')}s err={meta.get('error')}", flush=True)

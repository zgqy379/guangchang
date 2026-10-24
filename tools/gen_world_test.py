"""W1 实测 4.x：World 管线
- 4.1 单图世界生成（generations，1 图 + prompt）——用一张办公室内景
- 3.1 重建（reconstructions）：内景仅 14 张 < 20 张硬性下限，跳过并记录，
  待用户补拍（≥20 张照片或 1 段环绕视频）
产物存档：docs/iterations/spatialgen-space/

安全约束：产物下载仅允许 https + 白名单域，解析后拒绝私网/环回/链路本地，禁用重定向。
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
from asset_uploader import upload_file  # noqa: E402  (官方 OUS 上传，域名为 aholo3d.cn)

from manycore.aholo_sdk_world import create_world_client  # noqa: E402
from manycore.aholo_sdk_core import AholoClientConfig  # noqa: E402

ALLOWED_HOST_SUFFIXES = (".kujiale.com", ".aholo3d.cn")


def assert_safe_url(url: str) -> str:
    p = urlparse(url)
    if p.scheme != "https" or not p.hostname:
        raise ValueError(f"仅允许 https URL: {url}")
    host = p.hostname.lower()
    if not any(host == s.lstrip(".") or host.endswith(s) for s in ALLOWED_HOST_SUFFIXES):
        raise ValueError(f"目标主机不在白名单: {host}")
    for _, _, _, _, sockaddr in socket.getaddrinfo(host, 443):
        ip = ipaddress.ip_address(sockaddr[0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
            raise ValueError(f"解析到内网/保留地址，拒绝请求: {host} -> {ip}")
    return url


PHOTO = Path(r"E:\guangchang\办公室内景招聘\IMG_20261024_160541.jpg")
OUT_DIR = Path(r"E:\guangchang\docs\iterations\spatialgen-space\2026-10-26-v1")
OUT_DIR.mkdir(parents=True, exist_ok=True)

meta = {
    "date": "2026-10-26T02:20:00+08:00",
    "pipeline": "spatialgen",
    "assetLine": "office-space",
    "version": "v1",
    "steps": {},
}

# 1. 上传单图
up = upload_file(str(PHOTO), region="cn")
img_url = up["url"]
meta["steps"]["upload"] = {"url": img_url, "bytes": up.get("size")}
print("uploaded:", img_url)

# 2. 单图世界生成
_api_key = os.environ.get("AHOLO_API_KEY")
if not _api_key:
    raise SystemExit("缺少 AHOLO_API_KEY 环境变量（勿硬编码，见 .env.example）")
world = create_world_client(AholoClientConfig(api_key=_api_key, region="cn"))
t0 = time.time()
try:
    op = world.generations.create(
        name="逛厂示范办公室",
        prompt="现代互联网公司开放式办公室，工位、绿植、落地窗、会议室，明亮通透",
        resources=[{"url": img_url, "type": "image"}],
    )
    wid = op["worldId"]
    meta["steps"]["create"] = {"worldId": str(wid)}
    print("worldId:", wid)
    detail = world.wait_for(wid)
    meta["result"] = "success"
    meta["elapsedSeconds"] = round(time.time() - t0, 1)
    assets = detail.get("assets", {})
    splats = assets.get("splats", {}).get("urls", {})
    meta["steps"]["outputs"] = {
        k: splats.get(k) for k in ("plyPath", "spzPath", "lodMetaPath") if splats.get(k)
    }
    meta["steps"]["panoUrl"] = assets.get("imagery", {}).get("panoUrl")
    meta["rawDetailHead"] = str(detail)[:1200]
    # 下载 spz/ply 首选产物（spz 是 Aholo Viewer 原生格式）
    for key in ("spzPath", "plyPath"):
        url = splats.get(key)
        if not url:
            continue
        assert_safe_url(url)
        rr = requests.get(url, timeout=600, allow_redirects=False)
        rr.raise_for_status()
        dest = OUT_DIR / f"office-space.{key.removesuffix('Path')}"
        dest.write_bytes(rr.content)
        meta["steps"]["downloads"] = meta["steps"].get("downloads", {}) | {
            key: {"file": dest.name, "bytes": len(rr.content)}
        }
        print("downloaded:", dest.name, len(rr.content), "bytes")
        break
except Exception as e:  # noqa: BLE001
    meta["result"] = "failed"
    meta["error"] = f"{type(e).__name__}: {e}"[:1200]
    meta["elapsedSeconds"] = round(time.time() - t0, 1)

(OUT_DIR / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"[world-gen] {meta.get('result')} {meta.get('elapsedSeconds')}s err={meta.get('error')}")

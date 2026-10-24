"""W1 实测 1.5（v2）：绑骨全流程
下载 avatar-v1 的 results.zip → 解出 GLB → 资产上传拿公开直链 → auto-rig
若服务端要求 quote/授权（付费阶段），记录阻塞原因为 W1 结论。

安全约束：所有外联请求仅允许 https + 白名单域，解析后拒绝私网/环回/链路本地地址，禁用重定向。
"""
import io
import ipaddress
import json
import socket
import sys
import time
import zipfile
from pathlib import Path
from urllib.parse import urlparse

import requests

sys.path.insert(0, r"C:\Users\dqy\tools\Aholo-Lux3D\plugins\common\aholo-lux3d\core\runtime")

from lux3d_client import create_auto_rig_task, query_task_status  # noqa: E402
from asset_uploader import upload_file  # noqa: E402

ALLOWED_HOST_SUFFIXES = (".kujiale.com", ".aholo3d.cn")


def assert_safe_url(url: str) -> str:
    p = urlparse(url)
    if p.scheme != "https" or not p.hostname:
        raise ValueError(f"仅允许 https URL: {url}")
    host = p.hostname.lower()
    if not any(host == s.lstrip(".") or host.endswith(s) for s in ALLOWED_HOST_SUFFIXES):
        raise ValueError(f"目标主机不在白名单: {host}")
    for family, _, _, _, sockaddr in socket.getaddrinfo(host, 443):
        ip = ipaddress.ip_address(sockaddr[0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
            raise ValueError(f"解析到内网/保留地址，拒绝请求: {host} -> {ip}")
    return url


ZIP_URL = "https://qhsmodel.kujiale.com/genesis3d/inference/20261024/2a1e4adc00384ffb9946c7350e47987a/results/results.zip"
OUT_DIR = Path(r"E:\guangchang\docs\iterations\lux3d-avatar\2026-10-26-rig-v2")
OUT_DIR.mkdir(parents=True, exist_ok=True)
REGION = "cn"
entry = {"id": "rig-v2", "steps": {}}

# 1. 下载并解压 GLB
assert_safe_url(ZIP_URL)
r = requests.get(ZIP_URL, timeout=120, allow_redirects=False)
r.raise_for_status()
entry["steps"]["download"] = {"bytes": len(r.content)}
zf = zipfile.ZipFile(io.BytesIO(r.content))
glb_names = [n for n in zf.namelist() if n.lower().endswith(".glb")]
if not glb_names:
    entry["result"] = "failed"
    entry["error"] = f"no glb in zip: {zf.namelist()[:10]}"
    (OUT_DIR / "meta.json").write_text(json.dumps(entry, ensure_ascii=False, indent=2), encoding="utf-8")
    print(entry["error"])
    sys.exit(0)
glb_path = OUT_DIR / "avatar-v1.glb"
glb_path.write_bytes(zf.read(glb_names[0]))
entry["steps"]["extract"] = {"file": glb_names[0], "bytes": glb_path.stat().st_size}
print("GLB extracted:", glb_path.stat().st_size, "bytes")

# 2. 上传拿直链（upload_file 内部走官方 OUS 网关）
up = upload_file(str(glb_path), region=REGION)
model_url = up.get("url")
entry["steps"]["upload"] = {k: up.get(k) for k in ("url", "size", "uploadMode")}
print("uploaded:", model_url)

# 3. auto-rig
t0 = time.time()
try:
    task_id = create_auto_rig_task(model_url, region=REGION)
    entry["steps"]["createTask"] = {"taskId": str(task_id)}
    rig_data = query_task_status(task_id, region=REGION)
    entry["result"] = "success"
    entry["steps"]["poll"] = {"outputs": str(rig_data)[:1500]}
except Exception as e:  # noqa: BLE001
    entry["result"] = "failed"
    entry["error"] = f"{type(e).__name__}: {e}"[:1200]
entry["elapsedSeconds"] = round(time.time() - t0, 1)

(OUT_DIR / "meta.json").write_text(json.dumps(entry, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"[rig-v2] {entry['result']} err={entry.get('error')}")

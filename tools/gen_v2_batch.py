"""V2-1 街区版素材批量生成：
Phase A: HR 形象 ×10（Lux3D 文生 → 下载 GLB → 上传 → auto-rig → Idle retarget）
Phase B: 四大行业办公空间 ×3（SpatialGen 纯文案生成；互联网区复用已有 office-promptonly.spz）
产物：docs/iterations/lux3d-hr/<date>-hr-*/  与  docs/iterations/spatialgen-space/<date>-industry-*/
安全约束：外联仅 https + 白名单域（.kujiale.com/.aholo3d.cn），解析拒绝私网，禁重定向。
"""
import ipaddress
import json
import os
import socket
import sys
import time
import zipfile
from pathlib import Path
from urllib.parse import urlparse

import requests

sys.path.insert(0, r"C:\Users\dqy\tools\Aholo-Lux3D\plugins\common\aholo-lux3d\core\runtime")

from lux3d_client import (  # noqa: E402
    create_animation_retarget_task,
    create_auto_rig_task,
    create_text_to_3d_task,
    query_task_status,
)
from asset_uploader import upload_file  # noqa: E402
from manycore.aholo_sdk_world import create_world_client  # noqa: E402
from manycore.aholo_sdk_core import AholoClientConfig  # noqa: E402

ALLOWED_HOST_SUFFIXES = (".kujiale.com", ".aholo3d.cn")
REGION = "cn"
DATE = "2026-10-25-v2"
HR_ROOT = Path(rf"E:\guangchang\docs\iterations\lux3d-hr\{DATE}")
WORLD_ROOT = Path(rf"E:\guangchang\docs\iterations\spatialgen-space\{DATE}-industries")


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
            raise ValueError(f"解析到内网/保留地址，拒绝: {host} -> {ip}")
    return url


def find_urls(o, suffix, acc):
    if isinstance(o, str) and o.startswith("https") and o.endswith(suffix):
        acc.append(o)
    elif isinstance(o, dict):
        for v in o.values():
            find_urls(v, suffix, acc)
    elif isinstance(o, list):
        for v in o:
            find_urls(v, suffix, acc)
    return acc


def poll_with_retry(fn, tag, tries=3):
    for a in range(tries):
        try:
            return fn(), None
        except Exception as e:  # noqa: BLE001
            err = f"{type(e).__name__}: {e}"[:400]
            print(f"[{tag}] attempt {a+1} failed: {err}", flush=True)
            time.sleep(8)
    return None, err


def save_meta(out_dir: Path, entry: dict):
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "meta.json").write_text(json.dumps(entry, ensure_ascii=False, indent=2), encoding="utf-8")


HR_SPECS = [
    ("hr-f01", "female HR recruiter, navy business blazer and white blouse, shoulder-length hair, warm smile, holding a tablet"),
    ("hr-m01", "male HR manager, charcoal business suit, glasses, short hair, confident stance"),
    ("hr-f02", "female HR, beige cardigan over silk blouse, high ponytail, name-badge lanyard around neck"),
    ("hr-m02", "male HR, light grey dress shirt with dark vest, tidy beard, holding resume folder"),
    ("hr-f03", "female creative-industry HR, modern qipao-inspired dress, artistic earrings, side braid"),
    ("hr-m03", "male manufacturing HR, navy polo shirt with company badge, sturdy build, flat cap in hand"),
    ("hr-f04", "female finance HR, pinstripe business suit, neat bun hairstyle, pearl earrings"),
    ("hr-m04", "male internet-company HR, dark hoodie over collared shirt, casual sneakers, lanyard badge"),
    ("hr-f05", "female HR, burgundy dress with blazer, short bob haircut, standing confidently"),
    ("hr-m05", "male senior HR director, double-breasted suit, silver hair, arms crossed"),
]
BASE_PROMPT = (
    "A stylized HR recruiter character, full body, standing, T-pose, cartoon style, "
    "big head small body proportion, big expressive eyes, clean silhouette, single character, "
    "mobile game asset, no background, {variant}"
)

summary = {"hr": [], "world": []}

# ============ Phase A: HR ×10 ============
for name, variant in HR_SPECS:
    out_dir = HR_ROOT / name
    out_dir.mkdir(parents=True, exist_ok=True)
    entry = {"id": name, "prompt": BASE_PROMPT.format(variant=variant), "steps": {}}
    t0 = time.time()
    try:
        data = None
        # 恢复：此前运行已成功文生但落盘失败的，用 taskId 重查而非重新生成
        prev = out_dir / "meta.json"
        if prev.exists():
            old = json.loads(prev.read_text(encoding="utf-8"))
            tid = old.get("steps", {}).get("gen", {}).get("taskId")
            if old.get("result") == "failed" and tid:
                data, _ = poll_with_retry(lambda: query_task_status(tid, region=REGION), f"{name}-recover")
                if data is not None:
                    entry["steps"]["gen"] = {"taskId": str(tid), "recovered": True}
                    print(f"[{name}] recovered task {tid}", flush=True)
        task_id = None
        if data is None:
            # 文生
            task_id = create_text_to_3d_task(entry["prompt"], version="G1-Turbo", style="cartoon", region=REGION)
            data, err = poll_with_retry(lambda: query_task_status(task_id, region=REGION), f"{name}-gen")
            if data is None:
                raise RuntimeError(err)
        zips = find_urls(data, ".zip", [])
        glbs = find_urls(data, ".glb", [])
        entry["steps"].setdefault("gen", {"taskId": str(task_id), "elapsed": round(time.time() - t0, 1)})
        if glbs and not zips:
            glb_bytes = None
            url = assert_safe_url(glbs[0])
            glb_bytes = requests.get(url, timeout=300, allow_redirects=False).content
        elif zips:
            url = assert_safe_url(zips[0])
            zf = zipfile.ZipFile(io.BytesIO(requests.get(url, timeout=300, allow_redirects=False).content)) if False else None
            # io 未导入，改用 requests 直接解压
            import io as _io
            zf = zipfile.ZipFile(_io.BytesIO(requests.get(url, timeout=300, allow_redirects=False).content))
            glb_names = [n for n in zf.namelist() if n.lower().endswith(".glb")]
            glb_bytes = zf.read(glb_names[0]) if glb_names else None
        else:
            raise RuntimeError(f"no glb/zip in outputs: {str(data)[:300]}")
        if not glb_bytes:
            raise RuntimeError("no glb extracted")
        raw = out_dir / f"{name}-raw.glb"
        raw.write_bytes(glb_bytes)
        entry["steps"]["rawGlb"] = {"bytes": len(glb_bytes)}

        # 上传 + 绑骨
        up = upload_file(str(raw), region=REGION)
        model_url = up["url"]
        entry["steps"]["upload"] = {"bytes": up.get("size")}
        t1 = time.time()
        rig_task = create_auto_rig_task(model_url, region=REGION)
        rig_data, err = poll_with_retry(lambda: query_task_status(rig_task, region=REGION), f"{name}-rig")
        if rig_data is None:
            raise RuntimeError("rig: " + err)
        rig_urls = find_urls(rig_data, ".glb", [])
        if not rig_urls:
            raise RuntimeError(f"no rigged glb: {str(rig_data)[:300]}")
        entry["steps"]["rig"] = {"elapsed": round(time.time() - t1, 1)}

        # Idle 重定向
        rig_url = assert_safe_url(rig_urls[0])
        t2 = time.time()
        anim_task = create_animation_retarget_task(
            rig_url, ["Idle_Loop"], animationOutputMode="separate", outFormat="glb", region=REGION
        )
        anim_data, err = poll_with_retry(lambda: query_task_status(anim_task, region=REGION), f"{name}-retarget")
        if anim_data is None:
            raise RuntimeError("retarget: " + err)
        anim_urls = [u for u in find_urls(anim_data, ".glb", []) if "idle" in u.lower() or True]
        if not anim_urls:
            raise RuntimeError(f"no idle glb: {str(anim_data)[:300]}")
        idle_url = assert_safe_url(anim_urls[0])
        idle = out_dir / f"{name}-idle.glb"
        idle.write_bytes(requests.get(idle_url, timeout=600, allow_redirects=False).content)
        entry["steps"]["idleGlb"] = {"file": idle.name, "bytes": idle.stat().st_size}
        entry["result"] = "success"
        entry["elapsedSeconds"] = round(time.time() - t0, 1)
        print(f"[{name}] OK {entry['elapsedSeconds']}s idle={idle.stat().st_size}B", flush=True)
    except Exception as e:  # noqa: BLE001
        entry["result"] = "failed"
        entry["error"] = f"{type(e).__name__}: {e}"[:600]
        entry["elapsedSeconds"] = round(time.time() - t0, 1)
        print(f"[{name}] FAILED: {entry['error']}", flush=True)
    save_meta(out_dir, entry)
    summary["hr"].append({"id": name, "result": entry["result"]})

# ============ Phase B: World ×3（金融/制造/文创；互联网复用现有） ============
INDUSTRIES = [
    ("finance", "现代金融公司交易大厅办公室，弧形数据大屏，深色木纹与金属质感，多个交易工位，冷色照明，精致专业"),
    ("manufacturing", "智能制造企业展厅与办公区，工业风金属结构，机械臂展示台，暖色工矿灯，安全整洁，科技感"),
    ("culture", "文化创意公司开放式工作室， Loft 风格红砖墙，画板与创意物料，原木家具，暖色射灯，轻松有艺术气息"),
]
_api_key = os.environ.get("AHOLO_API_KEY") or os.environ.get("LUX3D_CN_API_KEY")
if not _api_key:
    print("缺少 AHOLO_API_KEY，跳过 Phase B", flush=True)
else:
    world = create_world_client(AholoClientConfig(api_key=_api_key, region="cn"))
    for name, prompt in INDUSTRIES:
        out_dir = WORLD_ROOT / name
        out_dir.mkdir(parents=True, exist_ok=True)
        entry = {"id": name, "prompt": prompt, "steps": {}}
        t0 = time.time()
        try:
            op = world.generations.create(name=f"逛厂-{name}-办公室", prompt=prompt)
            wid = op["worldId"]
            entry["steps"]["create"] = {"worldId": str(wid)}
            detail, err = poll_with_retry(lambda: world.wait_for(wid), f"{name}-world")
            if detail is None:
                raise RuntimeError(err)
            splats = detail.get("assets", {}).get("splats", {}).get("urls", {})
            for key in ("spzPath", "plyPath"):
                url = splats.get(key)
                if not url:
                    continue
                url = assert_safe_url(url)
                rr = requests.get(url, timeout=600, allow_redirects=False)
                rr.raise_for_status()
                dest = out_dir / f"office.{key.removesuffix('Path')}"
                dest.write_bytes(rr.content)
                entry["steps"][key] = {"file": dest.name, "bytes": len(rr.content)}
                break
            entry["result"] = "success"
            entry["elapsedSeconds"] = round(time.time() - t0, 1)
            print(f"[{name}-world] OK {entry['elapsedSeconds']}s", flush=True)
        except Exception as e:  # noqa: BLE001
            entry["result"] = "failed"
            entry["error"] = f"{type(e).__name__}: {e}"[:600]
            entry["elapsedSeconds"] = round(time.time() - t0, 1)
            print(f"[{name}-world] FAILED: {entry['error']}", flush=True)
        save_meta(out_dir, entry)
        summary["world"].append({"id": name, "result": entry["result"]})

(HR_ROOT / "_summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
print("BATCH DONE", json.dumps(summary, ensure_ascii=False), flush=True)

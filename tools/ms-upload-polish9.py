# 魔搭创空间上传（polish9 视觉冲刺版）
# 配方 docs/lessons.md §7.4：LFS 阈值 500MB（防 LFS pointer 黑屏）+ 批次 12MB（防 E1020）
# 上传报告必须 Normal committed N / LFS 0
import os
import sys

os.environ["MODELSCOPE_UPLOAD_LFS_FORCE_THRESHOLD"] = "524288000"
os.environ["MODELSCOPE_UPLOAD_COMMIT_MAX_INLINE_BYTES"] = "12582912"

# 令牌从 .env 读取（不回显）
token = None
with open("E:/guangchang/.env", encoding="utf-8") as f:
    for line in f:
        if line.startswith("MODELSCOPE_TOKEN="):
            token = line.split("=", 1)[1].strip()
if not token:
    print("no MODELSCOPE_TOKEN in .env")
    sys.exit(1)

from modelscope.hub.api import HubApi

api = HubApi()
api.login(token)
print("login ok")
api.upload_folder(
    repo_id="zgqy379/guangchang3d",
    repo_type="studio",
    folder_path="E:/guangchang/web/dist",
    commit_message="polish9 视觉冲刺版：focus 白幕根治+夜景照明 v2+玻璃三层配方+昼夜双地板（八轮盲审视觉 7.0 平台）",
)
print("upload done")

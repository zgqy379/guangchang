"""Demo 视频合成 v3：1280×720 全幅帧 + 场景字幕条 + 标题/片尾卡 → ffmpeg 合成
（v1 尺寸混乱/v2 无字幕；v3 适配 2026-10-25 审查修复后的新山体视觉）"""
import json
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

FRAMES = Path(r"E:\guangchang\docs\video\frames")
VIDEO = Path(r"E:\guangchang\docs\video")
FONT = "C:/Windows/Fonts/msyh.ttc"
FPS = 12
RED = (194, 58, 43)
GREY = (139, 148, 158)

marks = {m["label"]: m["frameIndex"] for m in json.loads((VIDEO / "scene-marks.json").read_text())}
files = sorted(FRAMES.glob("f_*.jpg"))
first = Image.open(files[0])
W = first.width - (first.width % 2)
H = first.height - (first.height % 2)
print("frame:", W, H, "| frames:", len(files), "| marks:", marks)


def font(sz):
    return ImageFont.truetype(FONT, sz)


def text_w(d, s, f):
    b = d.textbbox((0, 0), s, font=f)
    return b[2] - b[0]


def title_card():
    img = Image.new("RGB", (W, H), (13, 17, 23))
    d = ImageDraw.Draw(img)
    d.ellipse([W // 2 - 190, 96, W // 2 + 190, 470], outline=(60, 42, 38), width=3)
    f1 = font(110)
    d.text(((W - text_w(d, "逛厂", f1)) // 2, 150), "逛厂", font=f1, fill=RED)
    f2 = font(30)
    d.text(((W - text_w(d, "把画的饼，砌成真的山", f2)) // 2, 470), "把画的饼，砌成真的山", font=f2, fill=(230, 237, 243))
    f3 = font(20)
    for i, line in enumerate(["参数空间化 3D 求职招聘平台", "Aholo 全球 3D AI 黑客松参赛作品"]):
        d.text(((W - text_w(d, line, f3)) // 2, 530 + i * 34), line, font=f3, fill=GREY)
    return img


def end_card():
    img = Image.new("RGB", (W, H), (13, 17, 23))
    d = ImageDraw.Draw(img)
    f1 = font(46)
    d.text(((W - text_w(d, "别听他说，自己去看", f1)) // 2, H // 2 - 100), "别听他说，自己去看", font=f1, fill=(230, 237, 243))
    f2 = font(26)
    d.text(((W - text_w(d, "在线体验：zgqy379.github.io/guangchang", f2)) // 2, H // 2 + 20), "在线体验：zgqy379.github.io/guangchang", font=f2, fill=GREY)
    f3 = font(20)
    d.text(((W - text_w(d, "逛厂 · Aholo 黑客松 · 2026", f3)) // 2, H // 2 + 90), "逛厂 · Aholo 黑客松 · 2026", font=f3, fill=GREY)
    return img


def caption(img, text):
    """底部半透明字幕条"""
    d = ImageDraw.Draw(img, "RGBA")
    f = font(24)
    tw = text_w(d, text, f)
    x0, y0 = (W - tw) // 2 - 22, H - 74
    d.rectangle([x0, y0, x0 + tw + 44, y0 + 50], fill=(13, 17, 23, 195))
    d.text(((W - tw) // 2, y0 + 8), text, font=f, fill=(240, 244, 248))
    return img


captions = {
    "params": "年薪变山：15万 → 100万，钱一层层砌成塔",
    "growth": "生长动画重播：凌晨的月亮只挂在加班的人头上",
    "roam": "漫游模式：点击地面行走 · WASD · 第三人称",
    "compare": "A/B 对比：100万·凌晨月亮 vs 15万·准点夕阳",
    "office": "办公室漫游：Aholo World 生成 · 3DGS 实时渲染",
}
CAP_FRAMES = int(1.8 * FPS)

# 字幕烧录（写入后另存 caption 版本序列，避免二次运行重复烧录错位）
CAPDIR = VIDEO / "frames_cap"
CAPDIR.mkdir(exist_ok=True)
for i, p in enumerate(files):
    img = Image.open(p)
    for label, start in marks.items():
        if start <= i < start + CAP_FRAMES:
            img = caption(img, captions[label])
            break
    img.save(CAPDIR / p.name, quality=88)

title_card().save(VIDEO / "card_title.jpg", quality=92)
end_card().save(VIDEO / "card_end.jpg", quality=92)

ff = r"C:/Users/dqy/AppData/Local/Microsoft/WinGet/Links/ffmpeg.exe"
cmd = [
    ff, "-y",
    "-loop", "1", "-t", "3", "-i", str(VIDEO / "card_title.jpg"),
    "-framerate", str(FPS), "-i", str(CAPDIR / "f_%04d.jpg"),
    "-loop", "1", "-t", "3", "-i", str(VIDEO / "card_end.jpg"),
    "-filter_complex",
    f"[0:v]scale={W}:{H},format=yuv420p[v0];[1:v]scale={W}:{H},format=yuv420p[v1];[2:v]scale={W}:{H},format=yuv420p[v2];"
    "[v0][v1][v2]concat=n=3:v=1:a=0[out]",
    "-map", "[out]", "-c:v", "libx264", "-preset", "medium", "-crf", "23",
    "-movflags", "+faststart",
    str(VIDEO / "demo-video.mp4"),
]
r = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
print("ffmpeg:", "OK" if r.returncode == 0 else r.stderr[-400:])
out = VIDEO / "demo-video.mp4"
if out.exists():
    print("size: %.2f MB" % (out.stat().st_size / 1e6))

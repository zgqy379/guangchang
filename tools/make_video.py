"""Demo 视频后期：标题卡/片尾卡 + 场景字幕条 → ffmpeg 合成 mp4"""
import json
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

FRAMES = Path(r"E:\guangchang\docs\video\frames")
VIDEO = Path(r"E:\guangchang\docs\video")
FONT = "C:/Windows/Fonts/msyh.ttc"
FPS = 12

marks = {m["label"]: m["frameIndex"] for m in json.loads((VIDEO / "scene-marks.json").read_text())}
first = Image.open(sorted(FRAMES.glob("f_*.jpg"))[0])
W, H = first.size
print("frame size:", W, H, "| frames:", len(list(FRAMES.glob('f_*.jpg'))), "| marks:", marks)

RED = (194, 58, 43)
GREY = (139, 148, 158)

def font(sz, bold=False):
    return ImageFont.truetype(FONT, sz)

def text_w(draw, s, f):
    b = draw.textbbox((0, 0), s, font=f)
    return b[2] - b[0]

# 标题卡（每帧独立图片，重复 FPS*3 张）
def title_card():
    img = Image.new("RGB", (W, H), (13, 17, 23))
    d = ImageDraw.Draw(img)
    d.ellipse([W//2-190, 96, W//2+190, 470], outline=(60, 42, 38), width=3)
    f1 = font(110)
    d.text(((W - text_w(d, "逛厂", f1)) // 2, 160), "逛厂", font=f1, fill=RED)
    f2 = font(30)
    d.text(((W - text_w(d, "把画的饼，砌成真的山", f2)) // 2, 500), "把画的饼，砌成真的山", font=f2, fill=(230, 237, 243))
    f3 = font(20)
    for i, line in enumerate(["参数空间化 3D 求职招聘平台", "Aholo 全球 3D AI 黑客松参赛作品"]):
        d.text(((W - text_w(d, line, f3)) // 2, 560 + i * 34), line, font=f3, fill=GREY)
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
    f = font(26)
    tw = text_w(d, text, f)
    x0, y0 = (W - tw) // 2 - 22, H - 78
    d.rectangle([x0, y0, x0 + tw + 44, y0 + 52], fill=(13, 17, 23, 190))
    d.text(((W - tw) // 2, y0 + 8), text, font=f, fill=(240, 244, 248))
    return img

# 场景字幕（场景开头 ~1.8s 的帧打字幕）
captions = {
    "params": "年薪变山 · 下班时间变月亮（等比放大 2.5× 展示）",
    "growth": "生长动画：地砖路铺设 × 钞票山隆起",
    "roam": "漫游模式：点击地面行走 · WASD · 第三人称",
    "compare": "A/B 对比：左·慢山文旅（夕阳） 右·不眠星云（凌晨月亮）",
    "office": "办公室漫游：Aholo World 生成 · 3DGS 实时渲染",
}
CAP_FRAMES = int(1.8 * FPS)

for label, start in marks.items():
    for i in range(start, min(start + CAP_FRAMES, 314)):
        p = FRAMES / f"f_{i:04d}.jpg"
        if p.exists():
            caption(Image.open(p), captions[label]).save(p, quality=88)

# 卡片写入（占位 f 序列之外）
title_card().save(VIDEO / "card_title.jpg", quality=92)
end_card().save(VIDEO / "card_end.jpg", quality=92)

# ffmpeg：标题 3s + 正文 + 片尾 3s
ff = r"C:/Users/dqy/AppData/Local/Microsoft/WinGet/Links/ffmpeg.exe"
cmd = [
    ff, "-y",
    "-loop", "1", "-t", "3", "-i", str(VIDEO / "card_title.jpg"),
    "-framerate", str(FPS), "-i", str(FRAMES / "f_%04d.jpg"),
    "-loop", "1", "-t", "3", "-i", str(VIDEO / "card_end.jpg"),
    "-filter_complex", "[0:v]scale=%d:%d,format=yuv420p[v0];[1:v]format=yuv420p[v1];[2:v]scale=%d:%d,format=yuv420p[v2];[v0][v1][v2]concat=n=3:v=1:a=0[out]" % (W, H, W, H),
    "-map", "[out]", "-c:v", "libx264", "-preset", "medium", "-crf", "23", "-movflags", "+faststart",
    str(VIDEO / "demo-video.mp4"),
]
r = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
print("ffmpeg:", "OK" if r.returncode == 0 else r.stderr[-500:])
out = VIDEO / "demo-video.mp4"
print("size:", out.stat().st_size / 1e6, "MB" if out.exists() else "missing")

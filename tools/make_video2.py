"""Demo 视频合成 v2：字幕已烧录，只做卡片（偶数尺寸）+ ffmpeg 偶数缩放合成"""
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

first = Image.open(sorted(FRAMES.glob("f_*.jpg"))[0])
W = first.width - (first.width % 2)
H = first.height - (first.height % 2)
print("canvas:", W, H)

def font(sz):
    return ImageFont.truetype(FONT, sz)

def text_w(d, s, f):
    b = d.textbbox((0, 0), s, font=f)
    return b[2] - b[0]

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

title_card().save(VIDEO / "card_title.jpg", quality=92)
end_card().save(VIDEO / "card_end.jpg", quality=92)

ff = r"C:/Users/dqy/AppData/Local/Microsoft/WinGet/Links/ffmpeg.exe"
cmd = [
    ff, "-y",
    "-loop", "1", "-t", "3", "-i", str(VIDEO / "card_title.jpg"),
    "-framerate", str(FPS), "-i", str(FRAMES / "f_%04d.jpg"),
    "-loop", "1", "-t", "3", "-i", str(VIDEO / "card_end.jpg"),
    "-filter_complex",
    f"[0:v]scale={W}:{H}[v0];[1:v]scale={W}:{H}[v1];[2:v]scale={W}:{H}[v2];"
    "[v0][v1][v2]concat=n=3:v=1:a=0,format=yuv420p[out]",
    "-map", "[out]", "-c:v", "libx264", "-preset", "medium", "-crf", "23",
    "-movflags", "+faststart",
    str(VIDEO / "demo-video.mp4"),
]
r = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
out = VIDEO / "demo-video.mp4"
print("ffmpeg:", "OK" if r.returncode == 0 else r.stderr[-300:])
if out.exists():
    print("size: %.1f MB" % (out.stat().st_size / 1e6))

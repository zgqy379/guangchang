#!/usr/bin/env python3
"""Compose the liquid-glass proof contact sheet (2400x1960)."""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs/design/proofs/editorial/out"

W, H = 2400, 1960
M = 64
BG = "#0B0D10"
GRID = "#12161b"
INK = "#F4F5F7"
SOFT = "#9AA0AA"
FAINT = "#6F7681"
LINE = "#2A2F37"

SERIF = "C:/Windows/Fonts/simsun.ttc"
SANS = "C:/Windows/Fonts/msyh.ttc"
SANS_B = "C:/Windows/Fonts/msyhbd.ttc"
MONO = "C:/Windows/Fonts/consola.ttf"


def f(path, size, index=0):
    return ImageFont.truetype(path, size, index=index)


def label(draw, x, y, idx, text, note=""):
    draw.text((x, y), idx, font=f(MONO, 20), fill=SOFT)
    draw.text((x + 52, y - 3), text, font=f(SANS_B, 23), fill=INK)
    if note:
        nw = draw.textlength(text, font=f(SANS_B, 23))
        draw.text((x + 52 + nw + 18, y), note, font=f(MONO, 17), fill=FAINT)


def paste(img_path, x, y, w, h):
    im = Image.open(img_path).convert("RGB").resize((w, h), Image.LANCZOS)
    canvas.paste(im, (x, y))
    draw.rectangle([x, y, x + w - 1, y + h - 1], outline=LINE, width=1)


canvas = Image.new("RGB", (W, H), BG)
draw = ImageDraw.Draw(canvas)

for gx in range(0, W, 64):
    draw.line([(gx, 0), (gx, H)], fill=GRID, width=1)
for gy in range(0, H, 64):
    draw.line([(0, gy), (W, gy)], fill=GRID, width=1)

draw.text((M, 48), "GG / VISUAL PROOF 2026-10-28", font=f(MONO, 19), fill=FAINT)
draw.text((M, 78), "液态玻璃", font=f(SERIF, 82), fill=INK)
draw.text((M + 372, 126), "LIQUID GLASS", font=f(MONO, 26), fill=FAINT)
draw.text(
    (M + 620, 128),
    "编辑骨架 × 玻璃材质 · 首屏 / 街区 HUD · 1600×900 & 390×844",
    font=f(SANS, 25),
    fill=SOFT,
)
draw.line([(M, 182), (W - M, 182)], fill=LINE, width=1)

row_a_y = 222
label(draw, M, row_a_y, "01", "首屏 · 日间浅玻璃", "RECOMMENDED")
paste(OUT / "glass-gate-day.png", M, row_a_y + 34, 1120, 630)
label(draw, M + 1152, row_a_y, "02", "首屏 · 夜间烟玻璃", "DARK THEME")
paste(OUT / "glass-gate-desktop.png", M + 1152, row_a_y + 34, 1120, 630)

row_b_y = 952
label(draw, M, row_b_y, "03", "街区 HUD · 日间", "1600×900")
paste(OUT / "glass-street-hud.png", M, row_b_y + 34, 1600, 900)

mx = M + 1600 + 32
label(draw, mx, row_b_y, "04", "移动端 390×844")
paste(OUT / "glass-gate-day-mobile.png", mx, row_b_y + 34, 308, 667)
paste(OUT / "glass-gate-mobile.png", mx + 332, row_b_y + 34, 308, 667)
draw.text((mx, row_b_y + 714), "日间 / DAY", font=f(MONO, 17), fill=FAINT)
draw.text((mx + 332, row_b_y + 714), "夜间 / NIGHT", font=f(MONO, 17), fill=FAINT)

draw.line([(M, 1902), (W - M, 1902)], fill=LINE, width=1)
draw.text(
    (M, 1918),
    "3D 场景仍为 R14 低模实拍；本轮只改 UI 与图版。纸面版样张保留在 proof-gate.html / proof-street.html。",
    font=f(SANS, 19),
    fill=FAINT,
)

dest = OUT / "glass-contact-sheet.png"
canvas.save(dest, optimize=True)
print(dest, canvas.size)

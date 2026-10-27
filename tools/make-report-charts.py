from PIL import Image, ImageDraw, ImageFont

W, H = 1400, 560
BG = (255, 255, 255)
INK = (31, 41, 55)
MUTED = (107, 114, 128)
GRID = (232, 237, 243)
RED = (194, 58, 43)
GRAY = (154, 167, 184)

bold = "C:/Windows/Fonts/msyhbd.ttc"
regular = "C:/Windows/Fonts/msyh.ttc"
f_title = ImageFont.truetype(bold, 27)
f_label = ImageFont.truetype(regular, 16)
f_value = ImageFont.truetype(bold, 24)
f_note = ImageFont.truetype(regular, 14)
f_small = ImageFont.truetype(regular, 13)

im = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(im)

def panel(x0, x1, title, ylabel, values, colors, vmax, fmt, target, target_label, gain, baseline_labels):
    d.text((x0, 26), title, font=f_title, fill=INK)
    top, base = 86, 452
    # grid + y ticks
    for i in range(6):
        y = base - (base - top) * i / 5
        d.line([(x0, y), (x1, y)], fill=GRID, width=1)
        d.text((x0 - 10, y - 9), f"{vmax * i / 5:.0f}", font=f_small, fill=MUTED, anchor="ra")
    # target line
    ty = base - (base - top) * target / vmax
    for gx in range(x0, x1, 12):
        d.line([(gx, ty), (gx + 6, ty)], fill=RED, width=2)
    d.text((x1 - 4, ty - 22), target_label, font=f_small, fill=RED, anchor="ra")
    # bars
    bw = 118
    xs = [x0 + (x1 - x0) * 0.28, x0 + (x1 - x0) * 0.66]
    for cx, v, c, lab in zip(xs, values, colors, baseline_labels):
        bh = (base - top) * v / vmax
        d.rectangle([cx - bw / 2, base - bh, cx + bw / 2, base], fill=c)
        d.text((cx, base - bh - 36), fmt(v), font=f_value, fill=INK, anchor="ma")
        d.text((cx, base + 12), lab, font=f_label, fill=MUTED, anchor="ma")
    # gain
    gx = (xs[0] + xs[1]) / 2
    d.text((gx, top + 26), gain, font=f_value, fill=RED, anchor="ma")
    # axis label
    d.text((x0, base + 46), ylabel, font=f_small, fill=MUTED)

panel(80, 640, "首屏 3D 资产传输量", "单位：MB · 首屏 GLB 请求 0 个", [8.49, 0.31], [GRAY, RED],
      10, lambda v: f"{v:.2f} MB", 5, "5MB 红线", "−96%", ["还债前 10-26", "现在 10-27"])
panel(780, 1340, "街区 draw calls", "单位：次 · 64 摊 + 四区 + 办公门面", [2136, 672], [GRAY, RED],
      2400, lambda v: f"{v}", 200, "≤200 目标", "−69%", ["还债前", "现在"])

d.text((80, 524), "数据：lessons §11.4 / 2026-10-27 线上验收。首屏已做到 0 个 GLB、0 个 canvas；街区 672 DC 仍高于 200 目标，已列入下一阶段 InstancedMesh / 材质图集优化。",
       font=f_note, fill=MUTED)

im.save("docs/figures/engineering-gains.png", "PNG", optimize=True)
print("saved docs/figures/engineering-gains.png", im.size)

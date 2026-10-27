from PIL import Image, ImageDraw, ImageFont

SRC = "docs/figures/street-2026-10-27-polish9/night/hero.png"
OUT = "web/public/og-image.png"
W, H = 1200, 630

src = Image.open(SRC).convert("RGB")
# 去掉应用顶栏（48px），避免 OG 卡片里出现两套品牌标题
src = src.crop((0, 48, src.width, src.height))
scale = max(W / src.width, H / src.height)
im = src.resize((round(src.width * scale), round(src.height * scale)), Image.LANCZOS)
x = (im.width - W) // 2
y = (im.height - H) // 2
im = im.crop((x, y, x + W, y + H)).convert("RGBA")

# 左侧暗化 + 底部压暗，保证文字可读
overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
d = ImageDraw.Draw(overlay)
for px in range(W):
    if px < 920:
        a = int(238 * (1 - px / 920) ** 1.15)
        d.line([(px, 0), (px, H)], fill=(7, 11, 19, a))
for py in range(H):
    if py > H - 230:
        a = int(165 * ((py - (H - 230)) / 230))
        d.line([(0, py), (W, py)], fill=(5, 8, 14, a))
# 应用底栏/引导 pill 压掉，保证 OG 自己的落款可读
d.rectangle([0, H - 150, W, H], fill=(7, 11, 19, 245))
im = Image.alpha_composite(im, overlay).convert("RGB")
d = ImageDraw.Draw(im)

bold = "C:/Windows/Fonts/msyhbd.ttc"
regular = "C:/Windows/Fonts/msyh.ttc"
f_kicker = ImageFont.truetype(regular, 19)
f_brand = ImageFont.truetype(bold, 104)
f_latin = ImageFont.truetype(regular, 38)
f_slogan = ImageFont.truetype(bold, 44)
f_sub = ImageFont.truetype(regular, 26)
f_footer = ImageFont.truetype(regular, 20)

red = (194, 58, 43)
gold = (255, 210, 74)
white = (246, 248, 252)
muted = (196, 205, 220)
dim = (143, 160, 184)

# 品牌红竖线
d.rectangle([96, 142, 106, 474], fill=red)

d.text((134, 138), "AHOLO 3D AI HACKATHON · 2026", font=f_kicker, fill=muted)
d.text((130, 168), "逛厂", font=f_brand, fill=white)
d.text((138, 292), "GuǎngChǎng", font=f_latin, fill=muted)
d.text((134, 356), "把画的饼，砌成真的山", font=f_slogan, fill=gold)
d.text((134, 424), "参数空间化 3D 求职招聘街区", font=f_sub, fill=white)
d.text((134, 462), "年薪 / 五险 / 期权 / 下班，全部砌成可走进去的地形", font=f_footer, fill=muted)

d.line([(134, 520), (700, 520)], fill=(255, 255, 255, 40), width=1)
d.text((134, 540), "群核科技 Aholo 全球 3D AI 黑客松 · 单人队 必胜客的汉堡最好吃", font=f_footer, fill=dim)
d.text((134, 572), "zgqy379.github.io/guangchang", font=f_footer, fill=dim)

im.save(OUT, "PNG", optimize=True)
print("saved", OUT, im.size)

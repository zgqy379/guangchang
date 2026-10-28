# 美术风格实验 · 镜头/调色后期（Pillow）
# 原始 3D 帧来自 tools/style-lab-shoot.cjs（真实场景改灯光/材质后截图）；
# 这里只做镜头语言：移轴景深、辉光、分级、暗角、颗粒。产出可直接对比的方向图。
from PIL import Image, ImageChops, ImageFilter, ImageEnhance, ImageDraw, ImageFont
import os

BASE = 'docs/design/proofs/art-style'
EDIT = 'docs/design/proofs/editorial/assets'
W, H = 1600, 900


def screen_blend(a, b, strength):
    return Image.blend(a, ImageChops.screen(a, b), strength)


def bloom(img, threshold=200, radius=16, strength=0.3):
    lum = img.convert('L')
    mask = lum.point(lambda v: 0 if v < threshold else min(255, (v - threshold) * 5))
    black = Image.new('RGB', img.size, (0, 0, 0))
    bright = Image.composite(img, black, mask)
    b = bright.filter(ImageFilter.GaussianBlur(radius))
    return screen_blend(img, b, strength)


def tilt_shift(img, band=(0.34, 0.60), max_blur=7.0, feather=0.22):
    w, h = img.size
    mask = Image.new('L', (1, h))
    px = mask.load()
    for y in range(h):
        t = y / (h - 1)
        if band[0] <= t <= band[1]:
            v = 0
        else:
            d = min(abs(t - band[0]), abs(t - band[1]))
            v = int(min(1.0, d / feather) * 255)
        px[0, y] = v
    mask = mask.resize((w, h)).filter(ImageFilter.GaussianBlur(36))
    blurred = img.filter(ImageFilter.GaussianBlur(max_blur))
    return Image.composite(blurred, img, mask)


def vignette(img, strength=0.2):
    rad = Image.radial_gradient('L').resize(img.size)
    m = rad.point(lambda v: int(255 - (v / 255.0) * strength * 255))
    return ImageChops.multiply(img, m.convert('RGB'))


def grain(img, sigma=14, opacity=0.05):
    noise = Image.effect_noise(img.size, sigma).convert('RGB')
    return Image.blend(img, ImageChops.soft_light(img, noise), opacity)


def soft_color(img, color, strength):
    solid = Image.new('RGB', img.size, color)
    return Image.blend(img, ImageChops.soft_light(img, solid), strength)


def split_tone(img, warm=(255, 196, 128), cool=(78, 108, 138), hi=0.08, lo=0.05):
    lum = img.convert('L')
    hi_mask = lum.point(lambda v: max(0, min(255, (v - 150) * 4)))
    lo_mask = lum.point(lambda v: max(0, min(255, (110 - v) * 5)))
    warm_layer = Image.new('RGB', img.size, warm)
    cool_layer = Image.new('RGB', img.size, cool)
    out = Image.composite(ImageChops.soft_light(img, warm_layer), img, hi_mask)
    out = Image.composite(ImageChops.soft_light(out, cool_layer), out, lo_mask)
    out = Image.blend(img, out, max(hi, lo) * 4)
    return out


def radial_glow(img, color, center=(0.2, 0.05), radius=0.75, strength=0.1):
    w, h = img.size
    rad = Image.radial_gradient('L').resize((int(w * radius), int(w * radius)))
    # radial_gradient: 0 center → 255 edge; invert → glow mask
    m = Image.new('L', (w, h), 0)
    inv = rad.point(lambda v: 255 - v)
    m.paste(inv, (int(center[0] * w - rad.width / 2), int(center[1] * h - rad.height / 2)))
    m = m.filter(ImageFilter.GaussianBlur(60))
    solid = Image.new('RGB', (w, h), color)
    return Image.composite(ImageChops.screen(img, solid), img, m.point(lambda v: int(v * strength)))


def grade_a(img):
    img = ImageEnhance.Brightness(img).enhance(0.97)
    img = ImageEnhance.Contrast(img).enhance(1.10)
    img = ImageEnhance.Color(img).enhance(0.9)
    img = split_tone(img, warm=(255, 186, 112), cool=(70, 98, 126), hi=0.09, lo=0.07)
    img = radial_glow(img, (255, 214, 170), center=(0.16, 0.02), radius=1.0, strength=0.08)
    img = bloom(img, threshold=200, radius=14, strength=0.22)
    img = tilt_shift(img, band=(0.35, 0.62), max_blur=5.5, feather=0.28)
    img = vignette(img, 0.24)
    img = grain(img, sigma=14, opacity=0.06)
    # 纸板/泡沫板的纤维感：把同一张颗粒以 soft-light 叠一层
    tex = Image.open(os.path.join(EDIT, 'grain.png')).convert('RGB')
    tile = Image.new('RGB', img.size)
    for x in range(0, img.width, tex.width):
        for y in range(0, img.height, tex.height):
            tile.paste(tex, (x, y))
    img = Image.blend(img, ImageChops.soft_light(img, tile), 0.05)
    img = Image.blend(img, Image.new('RGB', img.size, (206, 190, 168)), 0.03)
    return img


def grade_b(img):
    img = ImageEnhance.Brightness(img).enhance(1.0)
    img = ImageEnhance.Contrast(img).enhance(1.08)
    img = ImageEnhance.Color(img).enhance(1.04)
    # 抬黑：用深蓝 screen 一层，保留剪影但不死黑
    lift = Image.new('RGB', img.size, (10, 18, 34))
    img = Image.blend(img, ImageChops.screen(img, lift), 0.35)
    img = soft_color(img, (28, 58, 104), 0.08)
    img = bloom(img, threshold=140, radius=24, strength=0.62)
    img = vignette(img, 0.20)
    img = grain(img, sigma=13, opacity=0.06)
    return img


def grade_c(img):
    img = ImageEnhance.Brightness(img).enhance(1.0)
    img = ImageEnhance.Contrast(img).enhance(1.0)
    img = ImageEnhance.Color(img).enhance(1.38)
    img = split_tone(img, warm=(255, 222, 206), cool=(186, 156, 190), hi=0.10, lo=0.06)
    img = radial_glow(img, (255, 228, 214), center=(0.16, 0.00), radius=1.0, strength=0.12)
    img = bloom(img, threshold=206, radius=14, strength=0.28)
    img = vignette(img, 0.10)
    img = grain(img, sigma=6, opacity=0.015)
    return img


def label(img, text, sub=''):
    canvas = Image.new('RGB', (img.width, img.height + 54), (16, 17, 19))
    canvas.paste(img, (0, 0))
    d = ImageDraw.Draw(canvas)
    try:
        f1 = ImageFont.truetype('C:/Windows/Fonts/msyhbd.ttc', 24)
        f2 = ImageFont.truetype('C:/Windows/Fonts/consola.ttf', 16)
    except Exception:
        f1 = ImageFont.load_default(); f2 = f1
    d.text((22, img.height + 12), text, font=f1, fill=(235, 232, 226))
    d.text((22 + d.textlength(text, font=f1) + 14, img.height + 18), sub, font=f2, fill=(150, 152, 158))
    return canvas


def main():
    raws = {k: Image.open(os.path.join(BASE, f'raw-{k}.png')).convert('RGB') for k in ('a', 'b', 'c')}
    base = Image.open(os.path.join(EDIT, 'street-clean-day-hero.png')).convert('RGB').resize((W, H), Image.LANCZOS)

    finals = {
        'a': grade_a(raws['a']),
        'b': grade_b(raws['b']),
        'c': grade_c(raws['c']),
    }
    for k, im in finals.items():
        im.save(os.path.join(BASE, f'style-{k}.png'))

    # 2×2 场景对比（基线 + 三方向）
    tiles = [
        (base, '00 当前 / CURRENT', 'flat low-poly · noon'),
        (finals['a'], 'A 建筑沙盘 / MAQUETTE', 'matte model · studio light · tilt-shift'),
        (finals['b'], 'B 蓝调霓虹 / BLUE HOUR', 'neon · emissive · cool grade'),
        (finals['c'], 'C 潮玩展柜 / VINYL TOY', 'high-key · glossy · candy color'),
    ]
    tw, th = 1200, 675
    gap, pad, cap = 20, 28, 54
    sheet = Image.new('RGB', (pad * 2 + tw * 2 + gap, pad * 2 + (th + cap) * 2 + gap), (16, 17, 19))
    for i, (im, t, s) in enumerate(tiles):
        x = pad + (i % 2) * (tw + gap)
        y = pad + (i // 2) * (th + cap + gap)
        sheet.paste(im.resize((tw, th), Image.LANCZOS), (x, y))
        d = ImageDraw.Draw(sheet)
        try:
            f1 = ImageFont.truetype('C:/Windows/Fonts/msyhbd.ttc', 26)
            f2 = ImageFont.truetype('C:/Windows/Fonts/consola.ttf', 17)
        except Exception:
            f1 = ImageFont.load_default(); f2 = f1
        d.text((x + 2, y + th + 12), t, font=f1, fill=(238, 234, 226))
        d.text((x + 2, y + th + 42), s, font=f2, fill=(146, 150, 158))
    sheet.save(os.path.join(BASE, 'style-compare-scene.png'))
    print('saved', os.path.join(BASE, 'style-compare-scene.png'), sheet.size)


if __name__ == '__main__':
    main()

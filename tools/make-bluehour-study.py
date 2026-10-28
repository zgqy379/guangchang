# 蓝调釉面 · 后期
from PIL import Image, ImageChops, ImageFilter, ImageEnhance
import os

BASE = 'docs/design/proofs/art-style'
RAW = os.environ.get('RAW', 'raw-bluehour4.png')
OUT = os.environ.get('OUT', 'style-bluehour.png')


def screen_blend(a, b, s):
    return Image.blend(a, ImageChops.screen(a, b), s)


def bloom(img, t=150, r=22, s=0.5):
    lum = img.convert('L')
    mask = lum.point(lambda v: 0 if v < t else min(255, (v - t) * 5))
    bright = Image.composite(img, Image.new('RGB', img.size, (0, 0, 0)), mask)
    return screen_blend(img, bright.filter(ImageFilter.GaussianBlur(r)), s)


def vignette(img, s=0.34):
    rad = Image.radial_gradient('L').resize(img.size)
    m = rad.point(lambda v: int(255 - (v / 255.0) * s * 255))
    return ImageChops.multiply(img, m.convert('RGB'))


def grain(img, sigma=12, o=0.05):
    noise = Image.effect_noise(img.size, sigma).convert('RGB')
    return Image.blend(img, ImageChops.soft_light(img, noise), o)


def split_tone(img, warm=(255, 198, 140), cool=(70, 100, 140), hi=0.09, lo=0.07):
    lum = img.convert('L')
    hm = lum.point(lambda v: max(0, min(255, (v - 150) * 4)))
    lm = lum.point(lambda v: max(0, min(255, (110 - v) * 5)))
    out = Image.composite(ImageChops.soft_light(img, Image.new('RGB', img.size, warm)), img, hm)
    out = Image.composite(ImageChops.soft_light(out, Image.new('RGB', img.size, cool)), out, lm)
    return Image.blend(img, out, max(hi, lo) * 4)


def radial_glow(img, color=(255, 190, 120), center=(0.41, 0.45), radius=0.7, strength=0.08):
    w, h = img.size
    rad = Image.radial_gradient('L').resize((int(w * radius), int(w * radius)))
    m = Image.new('L', (w, h), 0)
    inv = rad.point(lambda v: 255 - v)
    m.paste(inv, (int(center[0] * w - rad.width / 2), int(center[1] * h - rad.height / 2)))
    m = m.filter(ImageFilter.GaussianBlur(70))
    solid = Image.new('RGB', (w, h), color)
    return Image.composite(ImageChops.screen(img, solid), img, m.point(lambda v: int(v * strength)))


def near_blur(img, start=0.9, max_blur=4.0):
    w, h = img.size
    mask = Image.new('L', (1, h))
    px = mask.load()
    for y in range(h):
        t = y / (h - 1)
        px[0, y] = 0 if t < start else int(min(1.0, (t - start) / (1 - start)) * 255)
    mask = mask.resize((w, h)).filter(ImageFilter.GaussianBlur(26))
    return Image.composite(img.filter(ImageFilter.GaussianBlur(max_blur)), img, mask)


def main():
    img = Image.open(os.path.join(BASE, RAW)).convert('RGB')
    scale = img.width / 1600
    img = ImageEnhance.Brightness(img).enhance(1.04)
    img = ImageEnhance.Contrast(img).enhance(1.08)
    img = ImageEnhance.Color(img).enhance(1.0)
    lift = Image.new('RGB', img.size, (8, 16, 30))
    img = Image.blend(img, ImageChops.screen(img, lift), 0.22)
    img = split_tone(img)
    img = radial_glow(img)
    img = bloom(img, 150, int(22 * scale), 0.5)
    img = near_blur(img, 0.9, 4.0 * scale)
    img = vignette(img)
    img = grain(img)
    out = os.path.join(BASE, OUT)
    img.save(out)
    print('saved', out)


if __name__ == '__main__':
    main()

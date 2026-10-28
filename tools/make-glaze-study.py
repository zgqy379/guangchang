# 釉面瓷方向 · 后期（镜头语言 + 分级）
# 原始 3D 帧：tools/art-lab-dusk.cjs（GLAZE=1）
from PIL import Image, ImageChops, ImageFilter, ImageEnhance
import os

BASE = 'docs/design/proofs/art-style'


def screen_blend(a, b, strength):
    return Image.blend(a, ImageChops.screen(a, b), strength)


def bloom(img, threshold=190, radius=18, strength=0.3):
    lum = img.convert('L')
    mask = lum.point(lambda v: 0 if v < threshold else min(255, (v - threshold) * 5))
    black = Image.new('RGB', img.size, (0, 0, 0))
    bright = Image.composite(img, black, mask)
    b = bright.filter(ImageFilter.GaussianBlur(radius))
    return screen_blend(img, b, strength)


def vignette(img, strength=0.26):
    rad = Image.radial_gradient('L').resize(img.size)
    m = rad.point(lambda v: int(255 - (v / 255.0) * strength * 255))
    return ImageChops.multiply(img, m.convert('RGB'))


def grain(img, sigma=12, opacity=0.045):
    noise = Image.effect_noise(img.size, sigma).convert('RGB')
    return Image.blend(img, ImageChops.soft_light(img, noise), opacity)


def split_tone(img, warm=(255, 205, 160), cool=(90, 105, 130), hi=0.08, lo=0.05):
    lum = img.convert('L')
    hi_mask = lum.point(lambda v: max(0, min(255, (v - 150) * 4)))
    lo_mask = lum.point(lambda v: max(0, min(255, (110 - v) * 5)))
    warm_layer = Image.new('RGB', img.size, warm)
    cool_layer = Image.new('RGB', img.size, cool)
    out = Image.composite(ImageChops.soft_light(img, warm_layer), img, hi_mask)
    out = Image.composite(ImageChops.soft_light(out, cool_layer), out, lo_mask)
    return Image.blend(img, out, max(hi, lo) * 4)


def radial_glow(img, color=(255, 214, 170), center=(0.43, 0.45), radius=0.9, strength=0.12):
    w, h = img.size
    rad = Image.radial_gradient('L').resize((int(w * radius), int(w * radius)))
    m = Image.new('L', (w, h), 0)
    inv = rad.point(lambda v: 255 - v)
    m.paste(inv, (int(center[0] * w - rad.width / 2), int(center[1] * h - rad.height / 2)))
    m = m.filter(ImageFilter.GaussianBlur(70))
    solid = Image.new('RGB', (w, h), color)
    return Image.composite(ImageChops.screen(img, solid), img, m.point(lambda v: int(v * strength)))


def near_blur(img, start=0.86, max_blur=4.0):
    w, h = img.size
    mask = Image.new('L', (1, h))
    px = mask.load()
    for y in range(h):
        t = y / (h - 1)
        px[0, y] = 0 if t < start else int(min(1.0, (t - start) / (1 - start)) * 255)
    mask = mask.resize((w, h)).filter(ImageFilter.GaussianBlur(30))
    blurred = img.filter(ImageFilter.GaussianBlur(max_blur))
    return Image.composite(blurred, img, mask)


def grade(img):
    img = ImageEnhance.Brightness(img).enhance(1.0)
    img = ImageEnhance.Contrast(img).enhance(1.05)
    img = ImageEnhance.Color(img).enhance(0.92)
    img = split_tone(img)
    img = radial_glow(img)
    img = bloom(img, threshold=186, radius=18, strength=0.3)
    img = near_blur(img, 0.88, 4.0)
    img = vignette(img, 0.26)
    img = grain(img, 12, 0.045)
    return img


def main():
    raw = Image.open(os.path.join(BASE, 'raw-glaze.png')).convert('RGB')
    out = grade(raw)
    p = os.path.join(BASE, 'style-glaze.png')
    out.save(p)
    print('saved', p, out.size)


if __name__ == '__main__':
    main()

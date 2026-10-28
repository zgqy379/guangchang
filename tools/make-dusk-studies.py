# 黄昏街景 · 摄影版 / 纸剧场版 两套后期
from PIL import Image, ImageChops, ImageFilter, ImageEnhance, ImageOps, ImageDraw
import os

BASE = 'docs/design/proofs/art-style'
EDIT = 'docs/design/proofs/editorial/assets'
W, H = 1600, 900


def screen_blend(a, b, strength):
    return Image.blend(a, ImageChops.screen(a, b), strength)


def bloom(img, threshold=188, radius=18, strength=0.32):
    lum = img.convert('L')
    mask = lum.point(lambda v: 0 if v < threshold else min(255, (v - threshold) * 5))
    black = Image.new('RGB', img.size, (0, 0, 0))
    bright = Image.composite(img, black, mask)
    b = bright.filter(ImageFilter.GaussianBlur(radius))
    return screen_blend(img, b, strength)


def vignette(img, strength=0.28):
    rad = Image.radial_gradient('L').resize(img.size)
    m = rad.point(lambda v: int(255 - (v / 255.0) * strength * 255))
    return ImageChops.multiply(img, m.convert('RGB'))


def grain(img, sigma=12, opacity=0.05):
    noise = Image.effect_noise(img.size, sigma).convert('RGB')
    return Image.blend(img, ImageChops.soft_light(img, noise), opacity)


def split_tone(img, warm=(255, 192, 132), cool=(82, 106, 140), hi=0.1, lo=0.07):
    lum = img.convert('L')
    hi_mask = lum.point(lambda v: max(0, min(255, (v - 150) * 4)))
    lo_mask = lum.point(lambda v: max(0, min(255, (110 - v) * 5)))
    warm_layer = Image.new('RGB', img.size, warm)
    cool_layer = Image.new('RGB', img.size, cool)
    out = Image.composite(ImageChops.soft_light(img, warm_layer), img, hi_mask)
    out = Image.composite(ImageChops.soft_light(out, cool_layer), out, lo_mask)
    return Image.blend(img, out, max(hi, lo) * 4)


def radial_glow(img, color=(255, 196, 128), center=(0.433, 0.454), radius=0.85, strength=0.12):
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
    blurred = img.filter(ImageFilter.GaussianBlur(max_blur))
    return Image.composite(blurred, img, mask)


def grade_photo(img):
    img = ImageEnhance.Brightness(img).enhance(0.98)
    img = ImageEnhance.Contrast(img).enhance(1.08)
    img = ImageEnhance.Color(img).enhance(0.94)
    img = split_tone(img)
    img = radial_glow(img)
    img = bloom(img, 188, 18, 0.34)
    img = near_blur(img, 0.9, 4.2)
    img = vignette(img, 0.30)
    img = grain(img, 12, 0.05)
    return img


def grade_paper(img, bits=6, blur=1.6, thresh=44, line_op=0.5):
    p = ImageOps.posterize(img, bits)
    soft = p.filter(ImageFilter.GaussianBlur(blur))
    edges = soft.convert('L').filter(ImageFilter.FIND_EDGES)
    mask = edges.point(lambda v: 0 if v < thresh else min(255, (v - thresh) * 5))
    line = Image.new('RGB', p.size, (250, 243, 229))
    shadow = ImageChops.offset(mask, 2, 4)
    dark = Image.new('RGB', p.size, (92, 78, 66))
    p2 = Image.composite(dark, p, shadow.point(lambda v: int(v * 0.30)))
    p2 = Image.composite(line, p2, mask.point(lambda v: int(v * line_op)))
    # 纸纤维
    tex = Image.open(os.path.join(EDIT, 'grain.png')).convert('RGB')
    tile = Image.new('RGB', p2.size)
    for x in range(0, p2.width, tex.width):
        for y in range(0, p2.height, tex.height):
            tile.paste(tex, (x, y))
    p2 = Image.blend(p2, ImageChops.soft_light(p2, tile), 0.10)
    # 暖灯侧光 + 冷影
    w, h = p2.size
    warm = Image.new('RGB', p2.size, (255, 198, 140))
    grad = Image.linear_gradient('L').resize((w, h)).rotate(-32, expand=False)
    p2 = Image.composite(ImageChops.screen(p2, warm), p2, grad.point(lambda v: int(v * 0.18)))
    p2 = split_tone(p2, (255, 196, 132), (86, 104, 128), 0.09, 0.06)
    p2 = bloom(p2, 196, 14, 0.2)
    p2 = near_blur(p2, 0.92, 3.5)
    p2 = vignette(p2, 0.24)
    p2 = grain(p2, 10, 0.035)
    return p2


def main():
    raw = Image.open(os.path.join(BASE, 'raw-dusk2.png')).convert('RGB')
    photo = grade_photo(raw)
    photo.save(os.path.join(BASE, 'style-dusk.png'))
    paper = grade_paper(raw)
    paper.save(os.path.join(BASE, 'style-paper.png'))
    print('saved style-dusk.png / style-paper.png')


if __name__ == '__main__':
    main()

"""Source-faithful portrait: rembg cutout, hair decontam, shirt recolor.

  C:\\Users\\denni\\Projects\\Ashwake\\.venv-ai\\Scripts\\python.exe scripts\\refine-portrait-cutout.py
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter, ImageOps
from rembg import new_session, remove
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
ME = ROOT / "public" / "media" / "me"
RAW = ME / "_ai-portrait"
SOURCE = ME / "_source-2026.png"


def crop_compose(img: Image.Image, size: int = 1024) -> Image.Image:
    img = ImageOps.exif_transpose(img).convert("RGB")
    w, h = img.size
    top, bottom = int(h * 0.18), int(h * 0.92)
    left, right = int(w * 0.12), int(w * 0.88)
    cropped = img.crop((left, top, right, bottom))
    cw, ch = cropped.size
    side = max(cw, ch)
    canvas = Image.new("RGB", (side, side), (8, 9, 14))
    canvas.paste(cropped, ((side - cw) // 2, (side - ch) // 2))
    return canvas.resize((size, size), Image.Resampling.LANCZOS)


def fit_canvas(rgba: Image.Image, size: int = 1024, pad: float = 0.08) -> Image.Image:
    bbox = rgba.getbbox()
    if not bbox:
        return rgba
    subject = rgba.crop(bbox)
    sw, sh = subject.size
    max_inner = int(size * (1 - pad * 2))
    scale = min(max_inner / sw, max_inner / sh)
    nw, nh = max(1, int(sw * scale)), max(1, int(sh * scale))
    subject = subject.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.paste(subject, ((size - nw) // 2, size - nh - int(size * 0.02)), subject)
    return canvas


def main() -> None:
    RAW.mkdir(parents=True, exist_ok=True)
    base = crop_compose(Image.open(SOURCE))
    base.save(RAW / "src-crop.jpg", quality=95)

    print("rembg birefnet-portrait…")
    session = new_session("birefnet-portrait")
    cut = remove(base, session=session)
    cut.save(RAW / "src-rawcut.png")

    arr = np.asarray(cut).astype(np.float32)
    rgb, a = arr[..., :3].copy(), arr[..., 3].copy()

    # Unspill light wall/ceiling background
    bg = np.array([225.0, 225.0, 228.0], dtype=np.float32)
    an = np.clip(a / 255.0, 0, 1)
    fg = (rgb - (1 - an)[..., None] * bg) / np.maximum(an[..., None], 1e-3)
    fg = np.clip(fg, 0, 255)
    solid = a > 245
    fg[solid] = rgb[solid]

    h, w = a.shape
    yy = np.arange(h)[:, None]
    upper = yy < h * 0.55
    solid_m = a > 200
    dil = ndimage.binary_dilation(solid_m, iterations=2)
    ero = ndimage.binary_erosion(solid_m, iterations=2)
    band = (dil & ~ero) | ((a > 5) & (a < 230))
    interior = ndimage.binary_erosion(solid_m, iterations=6)
    fl = fg.mean(axis=2)
    dark = interior & upper & (fl < 90) & (fl > 5)
    ref = fg[dark].mean(axis=0) if dark.any() else np.array([40.0, 30.0, 28.0])
    print("hair ref", ref)

    bright = band & upper & (fl > 55)
    whiteish = upper & (a > 5) & (a < 250) & (fl > 110)
    a2 = a.copy()
    a2[bright] *= np.clip((90 - fl[bright]) / 90, 0, 1) ** 1.2
    a2[whiteish] = 0
    edge_fix = bright | whiteish
    fg[edge_fix] = fg[edge_fix] * 0.2 + ref * 0.8

    fr = (a2 > 5) & (a2 < 220)
    scale = (a2[fr] / 255.0) ** 0.6
    fg[fr] = fg[fr] * scale[:, None]

    a2[a2 < 10] = 0
    a_img = Image.fromarray(a2.clip(0, 255).astype(np.uint8), "L")
    a2 = np.array(a_img.filter(ImageFilter.GaussianBlur(0.55))).astype(np.float32)
    a2[solid] = 255

    fl = fg.mean(axis=2)
    ys, xs = np.mgrid[0:h, 0:w]
    torso = (ys > h * 0.38) & (ys < h * 0.88) & (xs > w * 0.28) & (xs < w * 0.72) & (a2 > 180)
    shirt_light = torso & (fl > 140)
    shirt = ndimage.binary_dilation(shirt_light, iterations=8)
    r, g, b = fg[..., 0], fg[..., 1], fg[..., 2]
    skin = (r > 90) & (g > 60) & (b > 45) & (r > b) & ((r - b) > 15) & (fl < 200) & (fl > 70)
    neck = (ys > h * 0.32) & (ys < h * 0.48) & (xs > w * 0.38) & (xs < w * 0.62)
    shirt = shirt & ~skin & ~neck
    labeled, n = ndimage.label(shirt)
    if n:
        sizes = ndimage.sum(shirt, labeled, range(1, n + 1))
        best = int(np.argmax(sizes)) + 1
        shirt = labeled == best
        shirt = ndimage.binary_dilation(shirt, iterations=3)
        shirt = ndimage.binary_erosion(shirt, iterations=1)

    Image.fromarray((shirt.astype(np.uint8) * 255), "L").save(RAW / "shirt-mask.png")
    print("shirt mask px", int(shirt.sum()))

    rng = np.random.default_rng(7)
    noise = rng.normal(0, 7, fg.shape).astype(np.float32)
    rib = (np.sin(xs * 0.9) * 3).astype(np.float32)
    knit = np.clip(np.array([42.0, 44.0, 48.0]) + noise + rib[..., None], 0, 255)
    mask_f = np.clip(ndimage.gaussian_filter(shirt.astype(np.float32), sigma=2.5), 0, 1)
    comp = fg * (1 - mask_f[..., None]) + knit * mask_f[..., None]
    out = np.dstack([comp.clip(0, 255), a2.clip(0, 255)]).astype(np.uint8)
    fitted = fit_canvas(Image.fromarray(out, "RGBA"))

    f = np.asarray(fitted).astype(np.float32)
    fl2 = f[..., :3].mean(axis=2)
    fa = f[..., 3]
    solid2 = fa > 200
    dil2 = ndimage.binary_dilation(solid2, iterations=2)
    ero2 = ndimage.binary_erosion(solid2, iterations=2)
    band2 = (dil2 & ~ero2) | ((fa > 5) & (fa < 210))
    yy2 = np.arange(fa.shape[0])[:, None]
    be = band2 & (yy2 < fa.shape[0] * 0.55) & (fl2 > 50)
    f[..., :3][be] = f[..., :3][be] * 0.15 + ref * 0.85
    f[..., 3][be] *= 0.25
    f[..., 3][f[..., 3] < 10] = 0

    final_im = Image.fromarray(f.clip(0, 255).astype(np.uint8), "RGBA")
    rgb_p = final_im.convert("RGB")
    rgb_p = ImageEnhance.Contrast(rgb_p).enhance(1.05)
    rgb_p = ImageEnhance.Color(rgb_p).enhance(1.04)
    rgb_p = ImageEnhance.Sharpness(rgb_p).enhance(1.1)
    final_im = Image.merge("RGBA", (*rgb_p.split(), final_im.split()[-1]))

    final_im.save(RAW / "v14-source-faithful.png")
    crop = final_im.crop((280, 60, 740, 340))
    Image.alpha_composite(Image.new("RGBA", crop.size, (0, 0, 0, 255)), crop).save(
        RAW / "v14-hair-crop.png"
    )

    final_im.save(ME / "portrait.webp", "WEBP", quality=92, method=6)
    final_im.save(ME / "portrait-v4.webp", "WEBP", quality=92, method=6)
    plate = Image.alpha_composite(Image.new("RGBA", final_im.size, (7, 8, 12, 255)), final_im)
    plate.convert("RGB").save(ME / "portrait-full.webp", "WEBP", quality=90, method=6)
    plate.convert("RGB").save(ME / "portrait-full.jpg", quality=92)
    try:
        final_im.save(ME / "portrait.avif", quality=72)
        plate.convert("RGB").save(ME / "portrait-full.avif", quality=70)
    except Exception as e:
        print("avif skip:", e)
    print("installed portrait-v4.webp")


if __name__ == "__main__":
    main()

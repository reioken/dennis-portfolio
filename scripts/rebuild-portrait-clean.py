"""Rebuild About portrait: natural face, black sweater, no posterize brighten."""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter, ImageOps
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
    canvas.paste(subject, ((size - nw) // 2, (size - nh - int(size * 0.02))), subject)
    return canvas


def main() -> None:
    RAW.mkdir(parents=True, exist_ok=True)
    base = crop_compose(Image.open(SOURCE))
    base.save(RAW / "clean-src-crop.jpg", quality=95)

    print("rembg birefnet-portrait…")
    session = new_session("birefnet-portrait")
    cut = remove(base, session=session)
    cut.save(RAW / "clean-rawcut.png")

    arr = np.asarray(cut).astype(np.float32)
    rgb, a = arr[..., :3].copy(), arr[..., 3].copy()

    # Unspill light background into fringe only — keep face RGB faithful
    bg = np.array([225.0, 225.0, 228.0], dtype=np.float32)
    an = np.clip(a / 255.0, 0, 1)
    fg = (rgb - (1 - an)[..., None] * bg) / np.maximum(an[..., None], 1e-3)
    fg = np.clip(fg, 0, 255)
    solid = a > 245
    fg[solid] = rgb[solid]

    h, w = a.shape
    yy, xx = np.mgrid[0:h, 0:w]
    solid_m = a > 200
    dil = ndimage.binary_dilation(solid_m, iterations=2)
    ero = ndimage.binary_erosion(solid_m, iterations=2)
    band = (dil & ~ero) | ((a > 5) & (a < 230))
    upper = yy < h * 0.55
    fl = fg.mean(axis=2)
    interior = ndimage.binary_erosion(solid_m, iterations=6)
    dark = interior & upper & (fl < 90) & (fl > 5)
    ref = fg[dark].mean(axis=0) if dark.any() else np.array([40.0, 30.0, 28.0])

    # Hair fringe cleanup only (not face recolor)
    bright = band & upper & (fl > 55)
    whiteish = upper & (a > 5) & (a < 250) & (fl > 110)
    a2 = a.copy()
    a2[bright] *= np.clip((90 - fl[bright]) / 90, 0, 1) ** 1.2
    a2[whiteish] = 0
    edge_fix = bright | whiteish
    fg[edge_fix] = fg[edge_fix] * 0.25 + ref * 0.75
    a2[a2 < 10] = 0

    # Black knit sweater — same idea as refine script, leave face alone
    fl = fg.mean(axis=2)
    torso = (yy > h * 0.38) & (yy < h * 0.88) & (xx > w * 0.28) & (xx < w * 0.72) & (a2 > 180)
    r, g, b = fg[..., 0], fg[..., 1], fg[..., 2]
    skin = (r > 90) & (g > 60) & (b > 45) & (r > b) & ((r - b) > 15) & (fl < 200) & (fl > 70)
    neck = (yy > h * 0.32) & (yy < h * 0.48) & (xx > w * 0.38) & (xx < w * 0.62)
    shirt_light = torso & (fl > 140)
    shirt = ndimage.binary_dilation(shirt_light, iterations=8)
    shirt = shirt & ~skin & ~neck
    labeled, n = ndimage.label(shirt)
    if n:
        sizes = ndimage.sum(shirt, labeled, range(1, n + 1))
        best = int(np.argmax(sizes)) + 1
        shirt = labeled == best
        shirt = ndimage.binary_dilation(shirt, iterations=3)
        shirt = ndimage.binary_erosion(shirt, iterations=1)

    rng = np.random.default_rng(7)
    noise = rng.normal(0, 7, fg.shape).astype(np.float32)
    rib = (np.sin(xx * 0.9) * 3).astype(np.float32)
    knit = np.clip(np.array([42.0, 44.0, 48.0]) + noise + rib[..., None], 0, 255)
    mask_f = np.clip(ndimage.gaussian_filter(shirt.astype(np.float32), sigma=2.5), 0, 1)
    fg = fg * (1 - mask_f[..., None]) + knit * mask_f[..., None]

    # Soft alpha blur on rim only, then harden interior
    a_img = Image.fromarray(a2.clip(0, 255).astype(np.uint8), "L")
    a2 = np.array(a_img.filter(ImageFilter.GaussianBlur(0.45))).astype(np.float32)
    out = np.dstack([fg.clip(0, 255), a2.clip(0, 255)]).astype(np.uint8)
    fitted = fit_canvas(Image.fromarray(out, "RGBA"))

    f = np.asarray(fitted).astype(np.float32)
    rgb_f, af = f[..., :3], f[..., 3]
    subject = af >= 40
    subject = ndimage.binary_fill_holes(subject)
    dist = ndimage.distance_transform_edt(subject)
    af = np.where(dist >= 2.0, 255.0, np.where(dist > 0, np.clip(dist / 2.0 * 255.0, 0, 255), 0.0))

    final = np.dstack([rgb_f.clip(0, 255), af.clip(0, 255)]).astype(np.uint8)
    final_im = Image.fromarray(final, "RGBA")
    # NO contrast/color/sharpness boost — that caused the face posterize look

    final_im.save(RAW / "v21-clean.png")
    final_im.save(ME / "portrait-v8.webp", "WEBP", quality=95, method=6)
    final_im.save(ME / "portrait.webp", "WEBP", quality=95, method=6)
    print("wrote portrait-v8.webp", (ME / "portrait-v8.webp").stat().st_size)

    # face smoothness check
    h2, w2 = af.shape
    face = final[int(h2 * 0.12) : int(h2 * 0.42), int(w2 * 0.32) : int(w2 * 0.68)]
    g = 0.2126 * face[:, :, 0] + 0.7152 * face[:, :, 1] + 0.0722 * face[:, :, 2]
    skin_m = (face[:, :, 3] > 220) & (face[:, :, 0] > 70)
    lap = float(np.abs(ndimage.laplace(g.astype(float)))[skin_m].mean()) if skin_m.any() else -1
    print("face lap (lower=smoother)", lap)


if __name__ == "__main__":
    main()

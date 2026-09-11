"""Inpaint charcoal sweater onto source crop; keep face/arms/tattoos untouched.

  C:\\Users\\denni\\Projects\\Ashwake\\.venv-ai\\Scripts\\python.exe scripts\\inpaint-sweater.py
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import torch
from PIL import Image, ImageEnhance, ImageFilter, ImageOps
from rembg import new_session, remove
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
ME = ROOT / "public" / "media" / "me"
RAW = ME / "_ai-portrait"
SOURCE = ME / "_source-2026.png"

PROMPT = (
    "plain dark charcoal grey crewneck knit sweater, fine rib texture, "
    "no logo, no text, no graphics, sleeves rolled to mid forearm, "
    "photorealistic fabric, soft studio lighting"
)
NEGATIVE = (
    "logo, text, graphic tee, white shirt, print, watermark, "
    "deformed arms, extra limbs, bad hands, face change, tattoo change"
)


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


def build_shirt_mask(rgb: Image.Image) -> Image.Image:
    """White/light graphic tee on torso only; exclude skin, tattoos, face, arms."""
    arr = np.asarray(rgb).astype(np.float32)
    h, w = arr.shape[:2]
    lum = arr.mean(axis=2)
    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
    ys, xs = np.mgrid[0:h, 0:w]

    # Light fabric (white tee + print can be darker — include mid tones in torso)
    torso = (ys > int(h * 0.40)) & (ys < int(h * 0.90)) & (xs > int(w * 0.30)) & (xs < int(w * 0.70))
    light = (lum > 155) | ((lum > 90) & (r > 100) & (g > 90) & (b > 90) & ((r - b) < 40))
    # Red/black graphic ink on white tee inside torso
    graphic = torso & (lum < 140) & (ys > int(h * 0.45)) & (ys < int(h * 0.78)) & (xs > int(w * 0.34)) & (
        xs < int(w * 0.66)
    )

    skin = (r > 95) & (g > 65) & (b > 50) & (r > b + 12) & (lum > 75) & (lum < 210)
    # Arms when crossed sit roughly mid height spanning wider — exclude high-sat dark ink outside center
    ink = (lum < 70) & ((r + g + b) < 180)
    # Keep graphic region of shirt even if dark
    shirt = torso & (light | graphic)
    shirt = shirt & ~skin
    # Remove arm tattoo zones: dark ink outside center column
    center = (xs > int(w * 0.36)) & (xs < int(w * 0.64))
    shirt = shirt & (center | ~ink)

    shirt = ndimage.binary_opening(shirt, iterations=1)
    shirt = ndimage.binary_closing(shirt, iterations=4)
    labeled, n = ndimage.label(shirt)
    if n:
        sizes = ndimage.sum(shirt, labeled, range(1, n + 1))
        best = int(np.argmax(sizes)) + 1
        shirt = labeled == best
    shirt = ndimage.binary_dilation(shirt, iterations=6)
    # Soft feather via blur later — save hard mask first
    mask = Image.fromarray((shirt.astype(np.uint8) * 255), "L")
    mask = mask.filter(ImageFilter.GaussianBlur(4))
    # Threshold soft mask back to mostly white with soft edge for SD
    m = np.array(mask)
    m = np.clip((m.astype(np.float32) - 40) * 1.3, 0, 255).astype(np.uint8)
    return Image.fromarray(m, "L")


def clean_hair_alpha(cut: Image.Image) -> Image.Image:
    arr = np.asarray(cut).astype(np.float32)
    rgb, a = arr[..., :3].copy(), arr[..., 3].copy()
    bg = np.array([225.0, 225.0, 228.0], dtype=np.float32)
    an = np.clip(a / 255.0, 0, 1)
    fg = (rgb - (1 - an)[..., None] * bg) / np.maximum(an[..., None], 1e-3)
    fg = np.clip(fg, 0, 255)
    solid = a > 245
    fg[solid] = rgb[solid]

    h = a.shape[0]
    yy = np.arange(h)[:, None]
    upper = yy < h * 0.55
    solid_m = a > 200
    dil = ndimage.binary_dilation(solid_m, iterations=2)
    ero = ndimage.binary_erosion(solid_m, iterations=2)
    band = (dil & ~ero) | ((a > 5) & (a < 230))
    fl = fg.mean(axis=2)
    interior = ndimage.binary_erosion(solid_m, iterations=6)
    dark = interior & upper & (fl < 90) & (fl > 5)
    ref = fg[dark].mean(axis=0) if dark.any() else np.array([40.0, 30.0, 28.0])

    bright = band & upper & (fl > 55)
    whiteish = upper & (a > 5) & (a < 250) & (fl > 105)
    a2 = a.copy()
    a2[bright] *= np.clip((90 - fl[bright]) / 90, 0, 1) ** 1.2
    a2[whiteish] = 0
    fix = bright | whiteish
    fg[fix] = fg[fix] * 0.15 + ref * 0.85

    fr = (a2 > 5) & (a2 < 220)
    scale = (a2[fr] / 255.0) ** 0.55
    fg[fr] = fg[fr] * scale[:, None]

    a2[a2 < 10] = 0
    a_img = Image.fromarray(a2.clip(0, 255).astype(np.uint8), "L")
    a2 = np.array(a_img.filter(ImageFilter.GaussianBlur(0.5))).astype(np.float32)
    a2[solid] = 255

    out = np.dstack([fg.clip(0, 255), a2.clip(0, 255)]).astype(np.uint8)
    fitted = fit_canvas(Image.fromarray(out, "RGBA"))

    f = np.asarray(fitted).astype(np.float32)
    fl2 = f[..., :3].mean(axis=2)
    fa = f[..., 3]
    solid2 = fa > 200
    dil2 = ndimage.binary_dilation(solid2, iterations=2)
    ero2 = ndimage.binary_erosion(solid2, iterations=2)
    band2 = (dil2 & ~ero2) | ((fa > 5) & (fa < 210))
    yy2 = np.arange(fa.shape[0])[:, None]
    be = band2 & (yy2 < fa.shape[0] * 0.55) & (fl2 > 48)
    f[..., :3][be] = f[..., :3][be] * 0.12 + ref * 0.88
    f[..., 3][be] *= 0.22
    f[..., 3][f[..., 3] < 10] = 0
    return Image.fromarray(f.clip(0, 255).astype(np.uint8), "RGBA")


def main() -> None:
    if not torch.cuda.is_available():
        raise SystemExit("CUDA required for inpaint")

    RAW.mkdir(parents=True, exist_ok=True)
    base = crop_compose(Image.open(SOURCE))
    base.save(RAW / "src-crop.jpg", quality=95)
    mask = build_shirt_mask(base)
    mask.save(RAW / "shirt-mask-inpaint.png")
    print("mask mean", np.array(mask).mean())

    print("Loading SDXL inpaint…")
    from diffusers import AutoencoderKL, StableDiffusionXLInpaintPipeline

    dtype = torch.float16
    vae = AutoencoderKL.from_pretrained("madebyollin/sdxl-vae-fp16-fix", torch_dtype=dtype)
    pipe = StableDiffusionXLInpaintPipeline.from_pretrained(
        "stabilityai/stable-diffusion-xl-base-1.0",
        vae=vae,
        torch_dtype=dtype,
        variant="fp16",
        use_safetensors=True,
    )
    pipe.to("cuda")

    gen = torch.Generator(device="cuda").manual_seed(0x50F71)
    out = pipe(
        prompt=PROMPT,
        negative_prompt=NEGATIVE,
        image=base,
        mask_image=mask,
        strength=0.88,
        guidance_scale=6.5,
        num_inference_steps=36,
        generator=gen,
    ).images[0]
    out = ImageEnhance.Contrast(out).enhance(1.05)
    out = ImageEnhance.Color(out).enhance(1.03)
    out = ImageEnhance.Sharpness(out).enhance(1.08)
    out.save(RAW / "v15-inpaint-rgb.png")
    print("wrote v15-inpaint-rgb.png")

    print("cutout…")
    session = new_session("birefnet-portrait")
    cut = remove(out, session=session)
    cut.save(RAW / "v15-rawcut.png")
    final = clean_hair_alpha(cut)
    final.save(RAW / "v15-final.png")

    crop = final.crop((280, 60, 740, 340))
    Image.alpha_composite(Image.new("RGBA", crop.size, (0, 0, 0, 255)), crop).save(
        RAW / "v15-hair-crop.png"
    )

    final.save(ME / "portrait.webp", "WEBP", quality=92, method=6)
    final.save(ME / "portrait-v4.webp", "WEBP", quality=92, method=6)
    plate = Image.alpha_composite(Image.new("RGBA", final.size, (7, 8, 12, 255)), final)
    plate.convert("RGB").save(ME / "portrait-full.webp", "WEBP", quality=90, method=6)
    plate.convert("RGB").save(ME / "portrait-full.jpg", quality=92)
    try:
        final.save(ME / "portrait.avif", quality=72)
        plate.convert("RGB").save(ME / "portrait-full.avif", quality=70)
    except Exception as e:
        print("avif skip:", e)
    print("installed portrait-v4.webp")


if __name__ == "__main__":
    main()

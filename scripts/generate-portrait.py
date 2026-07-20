"""Enhance + cut out About portrait via SDXL img2img + rembg.

  C:\\Users\\denni\\Projects\\Ashwake\\.venv-ai\\Scripts\\python.exe scripts\\generate-portrait.py
"""
from __future__ import annotations

import argparse
import os
from pathlib import Path

import torch
from PIL import Image, ImageEnhance, ImageFilter, ImageOps

os.environ.setdefault("HF_HUB_DISABLE_XET", "1")

ROOT = Path(__file__).resolve().parents[1]
ME = ROOT / "public" / "media" / "me"
RAW = ME / "_ai-portrait"
SOURCE = ME / "_source-2026.png"

PROMPT = (
    "professional portfolio headshot of the exact same young man, "
    "long wavy dark brown hair to shoulders, full neat dark beard, warm natural smile, "
    "arms crossed, looking at camera, "
    "clean plain dark charcoal crewneck sweater, no logos no text no graphics, "
    "soft cinematic studio lighting, gentle rim light in ice blue and soft violet, "
    "clean skin, sharp eyes, premium photography for designer portfolio, "
    "isolated on pure black background, high detail, natural colors"
)

NEGATIVE = (
    "different person, face swap, deformed face, extra limbs, bad anatomy, "
    "baseball cap, hoodie, graphic tee, logo, text, watermark, mogul, "
    "bedroom, clutter, furniture, ceiling, framed picture, dresser, bed, "
    "harsh flash, overexposed, underexposed, noisy, blurry, lowres, "
    "cartoon, anime, plastic skin, oversharpen, beauty filter fake"
)


def crop_compose(img: Image.Image, size: int = 1024) -> Image.Image:
    img = ImageOps.exif_transpose(img).convert("RGB")
    w, h = img.size
    top = int(h * 0.18)
    bottom = int(h * 0.92)
    left = int(w * 0.12)
    right = int(w * 0.88)
    cropped = img.crop((left, top, right, bottom))
    cw, ch = cropped.size
    side = max(cw, ch)
    canvas = Image.new("RGB", (side, side), (8, 9, 14))
    canvas.paste(cropped, ((side - cw) // 2, (side - ch) // 2))
    return canvas.resize((size, size), Image.Resampling.LANCZOS)


def polish(img: Image.Image) -> Image.Image:
    img = img.convert("RGB")
    img = ImageEnhance.Color(img).enhance(1.04)
    img = ImageEnhance.Contrast(img).enhance(1.08)
    img = ImageEnhance.Brightness(img).enhance(1.03)
    img = ImageEnhance.Sharpness(img).enhance(1.12)
    img = img.filter(ImageFilter.UnsharpMask(radius=1.0, percent=60, threshold=3))
    return img


def cutout(img: Image.Image) -> Image.Image:
    from rembg import remove

    rgba = remove(img.convert("RGBA"))
    a = rgba.getchannel("A").filter(ImageFilter.GaussianBlur(0.6))
    rgba.putalpha(a)
    return rgba


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
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", type=Path, default=SOURCE)
    ap.add_argument("--variants", type=int, default=3)
    ap.add_argument("--seed", type=int, default=0x70A17)
    ap.add_argument("--steps", type=int, default=32)
    ap.add_argument("--guidance", type=float, default=5.8)
    ap.add_argument("--strength", type=float, default=0.42)
    ap.add_argument("--size", type=int, default=1024)
    ap.add_argument("--pick", type=int, default=0)
    args = ap.parse_args()

    if not args.source.exists():
        raise SystemExit(f"Missing source: {args.source}")
    if not torch.cuda.is_available():
        raise SystemExit("CUDA required")

    print(f"GPU: {torch.cuda.get_device_name(0)}")
    print("Loading SDXL img2img…")
    from diffusers import AutoencoderKL, StableDiffusionXLImg2ImgPipeline
    from diffusers.utils import logging as dlog

    dlog.set_verbosity_info()
    dtype = torch.float16
    vae = AutoencoderKL.from_pretrained(
        "madebyollin/sdxl-vae-fp16-fix",
        torch_dtype=dtype,
    )
    pipe = StableDiffusionXLImg2ImgPipeline.from_pretrained(
        "stabilityai/stable-diffusion-xl-base-1.0",
        vae=vae,
        torch_dtype=dtype,
        variant="fp16",
        use_safetensors=True,
    )
    pipe.to("cuda")
    pipe.set_progress_bar_config(disable=False)

    RAW.mkdir(parents=True, exist_ok=True)
    base = crop_compose(Image.open(args.source), size=args.size)
    base.save(RAW / "crop-input.jpg", quality=95)
    print(f"cropped -> {RAW / 'crop-input.jpg'}")

    paths: list[Path] = []
    for i in range(args.variants):
        seed = args.seed + i * 97
        gen = torch.Generator(device="cuda").manual_seed(seed)
        print(f"\n=== variant {i}  seed={seed}  strength={args.strength} ===")
        out = pipe(
            prompt=PROMPT,
            negative_prompt=NEGATIVE,
            image=base,
            strength=args.strength,
            guidance_scale=args.guidance,
            num_inference_steps=args.steps,
            generator=gen,
        ).images[0]
        polished = polish(out)
        rgb_path = RAW / f"v{i}-rgb.png"
        polished.save(rgb_path)
        print(f"wrote {rgb_path}")

        print("cutout (rembg)…")
        keyed = fit_canvas(cutout(polished), size=args.size)
        cut_path = RAW / f"v{i}-cut.png"
        keyed.save(cut_path)
        paths.append(cut_path)
        print(f"wrote {cut_path}")

    pick = paths[max(0, min(args.pick, len(paths) - 1))]
    final = Image.open(pick).convert("RGBA")

    webp = ME / "portrait.webp"
    final.save(webp, "WEBP", quality=92, method=6)
    print(f"installed {webp}")

    plate = Image.new("RGBA", final.size, (7, 8, 12, 255))
    plate = Image.alpha_composite(plate, final)
    full = ME / "portrait-full.webp"
    plate.convert("RGB").save(full, "WEBP", quality=90, method=6)
    plate.convert("RGB").save(ME / "portrait-full.jpg", quality=92)
    print(f"installed {full}")

    try:
        final.save(ME / "portrait.avif", quality=72)
        plate.convert("RGB").save(ME / "portrait-full.avif", quality=70)
        print("installed avif variants")
    except Exception as e:
        print(f"avif skip: {e}")

    print("\nDone. Review RAW variants in", RAW)


if __name__ == "__main__":
    main()

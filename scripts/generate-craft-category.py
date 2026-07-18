"""Generate Logos & Concepts category art on local CUDA (SDXL).

Uses the Ashwake AI venv (diffusers + CUDA). Best open model for this
portfolio look without a gated HF token: SDXL base fp16.
With HF auth, prefer FLUX.1-dev (gated) for sharper glass/brand stills.

  $env:HF_HUB_DISABLE_XET=1
  C:\\Users\\denni\\Projects\\Ashwake\\.venv-ai\\Scripts\\python.exe scripts\\generate-craft-category.py
"""
from __future__ import annotations

import argparse
import os
from pathlib import Path

import torch
from PIL import Image, ImageEnhance, ImageFilter

# XET downloads hang unauthenticated on this machine — force classic HTTP.
os.environ.setdefault("HF_HUB_DISABLE_XET", "1")

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "public" / "media" / "craft"

PROMPT = (
    "premium brand design category hero, dark charcoal glass desk top-down, "
    "abstract logo mark construction with geometry guides and compass arcs, "
    "frosted acrylic sheets and specular glass edges, "
    "soft violet #ac8bfd to electric blue #4a82fe to ice #c8daf4 light accents, "
    "minimal modern art-direction moodboard, elegant negative space, "
    "high-end UI portfolio aesthetic, cinematic product still life, "
    "clean contemporary graphic design studio atmosphere, "
    "no readable text, no letters, no watermark, no logo wordmark"
)

NEGATIVE = (
    "text, letters, typography, watermark, signature, logo word, brand name, "
    "skateboard, lime green, neon glow spam, photorealistic person, face, hands, "
    "cluttered desk trash, warm cream paper scrapbook, terracotta, newspaper collage, "
    "cartoon, anime, lowres, blurry, jpeg artifacts, oversaturated purple haze, "
    "3d plastic toy, stock photo office"
)


def build_pipe():
    from diffusers import AutoencoderKL, StableDiffusionXLPipeline
    from diffusers.utils import logging as dlog

    dlog.set_verbosity_info()
    dtype = torch.float16
    print("Loading SDXL base + fp16-fix VAE on CUDA…")
    vae = AutoencoderKL.from_pretrained(
        "madebyollin/sdxl-vae-fp16-fix",
        torch_dtype=dtype,
    )
    pipe = StableDiffusionXLPipeline.from_pretrained(
        "stabilityai/stable-diffusion-xl-base-1.0",
        vae=vae,
        torch_dtype=dtype,
        variant="fp16",
        use_safetensors=True,
    )
    pipe.to("cuda")
    pipe.set_progress_bar_config(disable=False)
    return pipe


def polish(img: Image.Image) -> Image.Image:
    img = img.convert("RGB")
    img = ImageEnhance.Color(img).enhance(1.05)
    img = ImageEnhance.Contrast(img).enhance(1.08)
    img = ImageEnhance.Sharpness(img).enhance(1.2)
    img = img.filter(ImageFilter.UnsharpMask(radius=1.2, percent=80, threshold=2))
    return img


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", type=int, default=0xC2AF7)
    ap.add_argument("--steps", type=int, default=32)
    ap.add_argument("--guidance", type=float, default=6.0)
    ap.add_argument("--width", type=int, default=1280)
    ap.add_argument("--height", type=int, default=800)
    args = ap.parse_args()

    if not torch.cuda.is_available():
        raise SystemExit("CUDA required — expected RTX GPU")

    print(f"GPU: {torch.cuda.get_device_name(0)}")
    pipe = build_pipe()
    gen = torch.Generator(device="cuda").manual_seed(args.seed)

    print(f"Generating {args.width}×{args.height}  steps={args.steps}  seed={args.seed}")
    raw = pipe(
        prompt=PROMPT,
        negative_prompt=NEGATIVE,
        width=args.width,
        height=args.height,
        num_inference_steps=args.steps,
        guidance_scale=args.guidance,
        generator=gen,
    ).images[0]

    img = polish(raw)
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    master = OUT_DIR / "category-master.png"
    img.save(master, optimize=True)
    print(f"wrote {master}")

    # Card / cover sizes used by the site
    try:
        import sharp  # type: ignore
    except Exception:
        sharp = None

    # Prefer Pillow + optional subprocess via node sharp if present
    webp = OUT_DIR / "category.webp"
    webp2 = OUT_DIR / "category@2x.webp"
    logo = OUT_DIR / "logo.webp"

    img_card = img.resize((1040, 650), Image.Resampling.LANCZOS)
    img_hi = img.resize((1600, 1000), Image.Resampling.LANCZOS)
    side = min(img.size)
    left = (img.width - side) // 2
    top = (img.height - side) // 2
    mark = img.crop((left, top, left + side, top + side)).resize((640, 640), Image.Resampling.LANCZOS)

    img_card.save(webp, format="WEBP", quality=86, method=6)
    img_hi.save(webp2, format="WEBP", quality=88, method=6)
    mark.save(logo, format="WEBP", quality=90, method=6)

    print(f"wrote {webp} ({webp.stat().st_size} bytes)")
    print(f"wrote {webp2} ({webp2.stat().st_size} bytes)")
    print(f"wrote {logo} ({logo.stat().st_size} bytes)")


if __name__ == "__main__":
    main()

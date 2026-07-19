"""Generate a clean Logos & Concepts mark (square logo icon) via SDXL CUDA.

  $env:HF_HUB_DISABLE_XET=1
  C:\\Users\\denni\\Projects\\Ashwake\\.venv-ai\\Scripts\\python.exe scripts\\generate-craft-logo.py
  C:\\Users\\denni\\Projects\\Ashwake\\.venv-ai\\Scripts\\python.exe scripts\\generate-craft-logo.py --variants 4
"""
from __future__ import annotations

import argparse
import os
from pathlib import Path

import torch
from PIL import Image, ImageEnhance, ImageFilter

os.environ.setdefault("HF_HUB_DISABLE_XET", "1")

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "public" / "media" / "craft"
RAW_DIR = OUT_DIR / "_ai-logo"

PROMPT = (
    "single centered premium brand logo mark icon, abstract geometric emblem, "
    "sharp faceted crystal shard form suggesting design craft, "
    "frosted glass and brushed metal edges, subtle specular highlights, "
    "color palette violet #ac8bfd electric blue #4a82fe ice #c8daf4, "
    "isolated on pure black background, generous padding, "
    "high-end portfolio project logo, minimal, symmetrical, "
    "no text, no letters, no wordmark, no watermark, no desk, no collage, "
    "no mockup, no paper, no photography props, logo only"
)

NEGATIVE = (
    "text, letters, typography, watermark, signature, brand name, wordmark, "
    "desk, moodboard, collage, scrapbook, paper, notebook, pencil, ruler, "
    "person, face, hands, photo, landscape, building, animal, "
    "busy background, pattern fill, grid, blueprint lines, "
    "cartoon, anime, lowres, blurry, jpeg artifacts, neon spam, "
    "purple haze wash, cream background, terracotta, newspaper"
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
    img = ImageEnhance.Color(img).enhance(1.06)
    img = ImageEnhance.Contrast(img).enhance(1.1)
    img = ImageEnhance.Sharpness(img).enhance(1.25)
    img = img.filter(ImageFilter.UnsharpMask(radius=1.1, percent=85, threshold=2))
    return img


def key_black(img: Image.Image, thr: int = 18, soft: int = 28) -> Image.Image:
    """Punch near-black plate to alpha so the mark sits on logo panels."""
    rgba = img.convert("RGBA")
    px = rgba.load()
    w, h = rgba.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
            if lum <= thr:
                px[x, y] = (r, g, b, 0)
            elif lum < thr + soft:
                px[x, y] = (r, g, b, int(((lum - thr) / soft) * a))
    return rgba


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", type=int, default=0xC0AF70)
    ap.add_argument("--variants", type=int, default=4)
    ap.add_argument("--steps", type=int, default=36)
    ap.add_argument("--guidance", type=float, default=6.5)
    ap.add_argument("--size", type=int, default=1024)
    ap.add_argument("--pick", type=int, default=-1, help="Variant index to install as emblem.webp")
    args = ap.parse_args()

    if not torch.cuda.is_available():
        raise SystemExit("CUDA required — expected RTX GPU")

    print(f"GPU: {torch.cuda.get_device_name(0)}")
    pipe = build_pipe()
    RAW_DIR.mkdir(parents=True, exist_ok=True)

    paths: list[Path] = []
    for i in range(args.variants):
        seed = args.seed + i * 97
        gen = torch.Generator(device="cuda").manual_seed(seed)
        print(f"\n=== variant {i}  seed={seed} ===")
        raw = pipe(
            prompt=PROMPT,
            negative_prompt=NEGATIVE,
            width=args.size,
            height=args.size,
            num_inference_steps=args.steps,
            guidance_scale=args.guidance,
            generator=gen,
        ).images[0]
        img = polish(raw)
        out = RAW_DIR / f"logo-v{i}-s{seed}.png"
        img.save(out, optimize=True)
        paths.append(out)
        print(f"wrote {out}")

    pick = args.pick if args.pick >= 0 else 0
    chosen = paths[pick]
    print(f"\nInstalling variant {pick}: {chosen.name}")
    mark = key_black(Image.open(chosen))
    mark = mark.resize((800, 800), Image.Resampling.LANCZOS)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    master = OUT_DIR / "mark-master.png"
    mark.save(master, optimize=True)
    for name in ("emblem.webp", "mark.webp", "logo.webp"):
        mark.save(OUT_DIR / name, format="WEBP", quality=92, method=6)
    mark.save(OUT_DIR / "emblem.png", optimize=True)
    mark.save(OUT_DIR / "mark.png", optimize=True)
    print(f"wrote {master}")
    print("wrote emblem.webp / mark.webp / logo.webp")
    print("Review _ai-logo/ variants, re-run with --pick N if needed.")


if __name__ == "__main__":
    main()

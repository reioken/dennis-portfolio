"""Generate 3 process-step icons (transparent PNG/WebP) via SDXL CUDA.

  C:\\Users\\denni\\Projects\\Ashwake\\.venv-ai\\Scripts\\python.exe scripts\\generate-process-icons.py
"""
from __future__ import annotations

import argparse
import os
from pathlib import Path

import torch
from PIL import Image, ImageEnhance, ImageFilter

os.environ.setdefault("HF_HUB_DISABLE_XET", "1")

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "public" / "media" / "process"
RAW_DIR = OUT_DIR / "_ai-raw"

NEGATIVE = (
    "text, letters, typography, watermark, signature, wordmark, logo text, "
    "person, face, hands, photo, photograph, realistic human, "
    "busy background, pattern fill, grid paper, blueprint lines, "
    "cartoon, anime, lowres, blurry, jpeg artifacts, neon spam, "
    "purple haze wash, cream background, terracotta, newspaper, "
    "frame, border, mockup, desk, office, UI screenshot, app window"
)

STEPS = [
    {
        "id": "direction",
        "seed": 0xD11E01,
        "prompt": (
            "single centered premium 3D icon object, abstract compass rose and "
            "faceted north-star crystal, soft directional beam of light, "
            "frosted glass and brushed metal, subtle specular highlights, "
            "color palette electric blue #4a82fe violet #ac8bfd ice #c8daf4, "
            "isolated on pure black background, generous padding, "
            "high-end product design metaphor for strategic direction, "
            "minimal, elegant, no text, no letters, object only"
        ),
    },
    {
        "id": "system",
        "seed": 0x5757E1,
        "prompt": (
            "single centered premium 3D icon object, abstract modular design system "
            "made of floating glass tokens and nested geometric components, "
            "soft interlocking plates suggesting hierarchy and tokens, "
            "frosted glass and brushed metal edges, subtle specular highlights, "
            "color palette violet #ac8bfd electric blue #4a82fe ice #c8daf4, "
            "isolated on pure black background, generous padding, "
            "high-end product design metaphor for design system, "
            "minimal, elegant, no text, no letters, object only"
        ),
    },
    {
        "id": "build",
        "seed": 0xB011D0,
        "prompt": (
            "single centered premium 3D icon object, abstract polished app slab "
            "emerging from layered prototype sheets, soft construction beams of light, "
            "frosted glass UI plane with subtle depth, brushed metal accents, "
            "color palette ice #c8daf4 electric blue #4a82fe violet #ac8bfd, "
            "isolated on pure black background, generous padding, "
            "high-end product design metaphor for building and shipping, "
            "minimal, elegant, no text, no letters, object only"
        ),
    },
]


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
    img = img.filter(ImageFilter.UnsharpMask(radius=1.0, percent=75, threshold=2))
    return img


def key_black(img: Image.Image, thr: int = 16, soft: int = 32) -> Image.Image:
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
    ap.add_argument("--steps", type=int, default=36)
    ap.add_argument("--guidance", type=float, default=6.8)
    ap.add_argument("--size", type=int, default=1024)
    ap.add_argument("--variants", type=int, default=2, help="Variants per step; best (0) installed")
    args = ap.parse_args()

    if not torch.cuda.is_available():
        raise SystemExit("CUDA required — expected RTX GPU")

    print(f"GPU: {torch.cuda.get_device_name(0)}")
    pipe = build_pipe()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    RAW_DIR.mkdir(parents=True, exist_ok=True)

    for step in STEPS:
        for i in range(args.variants):
            seed = step["seed"] + i * 131
            gen = torch.Generator(device="cuda").manual_seed(seed)
            print(f"\n=== {step['id']} v{i}  seed={seed} ===")
            raw = pipe(
                prompt=step["prompt"],
                negative_prompt=NEGATIVE,
                width=args.size,
                height=args.size,
                num_inference_steps=args.steps,
                guidance_scale=args.guidance,
                generator=gen,
            ).images[0]
            polished = polish(raw)
            keyed = key_black(polished)
            raw_path = RAW_DIR / f"{step['id']}-v{i}.png"
            polished.save(raw_path.with_name(f"{step['id']}-v{i}-rgb.png"), optimize=True)
            keyed.save(raw_path, optimize=True)
            print(f"wrote {raw_path}")
            if i == 0:
                out = OUT_DIR / f"{step['id']}.webp"
                keyed.save(out, "WEBP", quality=92, method=6)
                print(f"installed {out}")

    print("\nDone.")


if __name__ == "__main__":
    main()

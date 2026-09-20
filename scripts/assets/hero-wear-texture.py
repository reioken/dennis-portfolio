"""
hero-wear-texture.py — the shared, tiling detail behind every hero machine's wear (no download, all generated).

The baked mask of a hero machine (hero_gen.py, channel A) only says WHERE a surface is rubbed or dirty; at 1 K it
can never be sharp. This sheet says WHAT wear looks like up close, and the hall multiplies the two
(src/components/hall/heroMaterial.ts). 1024 px tile over 0.6 m = 1.7 px per millimetre.

    wear-scratches-v1  fine scratches: crisp hairlines, mostly along the horizontal, a few long ones
    wear-chips-v1      chipping height with a flat histogram; the hall thresholds the soft baked mask against it

Two grey files, not one RGB: lossy WebP subsamples chroma, packed channels bleed into each other.

    python scripts/assets/hero-wear-texture.py   ->  public/textures/hardware/wear-{scratches,chips}-v1.webp
"""

import math
import os

import numpy as np
from PIL import Image, ImageDraw

SIZE = 1024
SS = 3  # supersampling for the hairlines
rng = np.random.default_rng(19)


def spectral(beta, size=SIZE, stretch=(1.0, 1.0)):
    """Periodic noise with a 1/f^beta spectrum: tiles by construction."""
    fy = np.fft.fftfreq(size)[:, None] * stretch[1]
    fx = np.fft.fftfreq(size)[None, :] * stretch[0]
    f = np.sqrt(fx * fx + fy * fy)
    f[0, 0] = 1.0
    spectrum = (rng.normal(size=(size, size)) + 1j * rng.normal(size=(size, size))) / f ** beta
    spectrum[0, 0] = 0
    n = np.fft.ifft2(spectrum).real
    n -= n.min()
    return n / n.max()


def scratches():
    big = SIZE * SS
    img = Image.new("L", (big, big), 0)
    draw = ImageDraw.Draw(img)
    for i in range(1500):
        long_one = i < 40
        length = (rng.uniform(500, 1500) if long_one else rng.lognormal(3.6, 0.7)) * SS
        angle = rng.normal(0.0, 0.16) if rng.random() < 0.8 else rng.uniform(0, math.pi)
        x, y = rng.uniform(0, big, 2)
        # a scratch is a hand movement: a shallow arc, not a ruler line
        bend = rng.normal(0.0, 0.22) / length  # the whole stroke turns by about this many radians
        pts = []
        steps = max(4, int(length / (12 * SS)))
        for k in range(steps + 1):
            t = k / steps * length
            a = angle + bend * t
            pts.append((x + math.cos(angle) * t - math.sin(a) * bend * t * t * 0.5, y + math.sin(angle) * t + math.cos(a) * bend * t * t * 0.5))
        value = int(255 * (rng.uniform(0.55, 1.0) if long_one else rng.uniform(0.18, 0.9)))
        width = SS if rng.random() < 0.85 else SS * 2
        for ox in (-big, 0, big):
            for oy in (-big, 0, big):
                draw.line([(px + ox, py + oy) for px, py in pts], fill=value, width=width)
    return np.asarray(img.resize((SIZE, SIZE), Image.LANCZOS), dtype=np.float32) / 255.0


def chips():
    n = 0.6 * spectral(1.7, 512) + 0.4 * spectral(0.9, 512)  # half size: it is a threshold, not a picture
    n = (n - n.min()) / (n.max() - n.min())
    # equalise: the hall uses this as a threshold, so its histogram must be flat
    flat = np.argsort(np.argsort(n.ravel())).reshape(n.shape) / (n.size - 1)
    return flat.astype(np.float32)


def swirls():
    """A machine that gets wiped down: faint circular cloth marks instead of scratches, and a few short nicks."""
    big = SIZE * SS
    img = Image.new("L", (big, big), 0)
    draw = ImageDraw.Draw(img)
    for i in range(520):
        r = rng.uniform(30, 260) * SS
        cx, cy = rng.uniform(0, big, 2)
        a0 = rng.uniform(0, 360)
        a1 = a0 + rng.uniform(25, 150)
        value = int(255 * rng.uniform(0.10, 0.5))
        for ox in (-big, 0, big):
            for oy in (-big, 0, big):
                draw.arc([cx - r + ox, cy - r + oy, cx + r + ox, cy + r + oy], a0, a1, fill=value, width=SS)
    for i in range(90):
        x, y = rng.uniform(0, big, 2)
        a, ln = rng.uniform(0, math.pi), rng.uniform(6, 30) * SS
        draw.line([(x, y), (x + math.cos(a) * ln, y + math.sin(a) * ln)], fill=int(255 * rng.uniform(0.5, 1.0)), width=SS)
    return np.asarray(img.resize((SIZE, SIZE), Image.LANCZOS), dtype=np.float32) / 255.0


def pits():
    """Chip height for a machine that was knocked, not rubbed: a few irregular dents first, then soft worn areas.
    Dennis disliked the first version's dots (round dings over a fine speckle): no circles, no salt and pepper."""
    size = 512
    n = spectral(2.0, size)
    yy, xx = np.mgrid[0:size, 0:size]
    for i in range(60):
        cx, cy = rng.uniform(0, size), rng.uniform(0, size)
        long_r, ratio, turn = rng.uniform(3.0, 11.0), rng.uniform(2.0, 5.0), rng.uniform(0, math.pi)
        dx = (xx - cx + size / 2) % size - size / 2
        dy = (yy - cy + size / 2) % size - size / 2
        u = (dx * math.cos(turn) + dy * math.sin(turn)) / long_r
        v = (-dx * math.sin(turn) + dy * math.cos(turn)) / (long_r / ratio)
        d = np.sqrt(u * u + v * v)
        n = np.where(d < 1.0, np.minimum(n, 0.02 + 0.2 * d), n)
    flat = np.argsort(np.argsort(n.ravel())).reshape(n.shape) / (n.size - 1)
    return flat.astype(np.float32)


def scuffs():
    """Knocks and rubs instead of lines: short, broad, soft-ended marks in every direction, in loose clusters."""
    big = SIZE * SS
    img = Image.new("L", (big, big), 0)
    draw = ImageDraw.Draw(img)
    for c in range(46):
        cx, cy = rng.uniform(0, big, 2)
        main = rng.uniform(0, math.pi)
        for i in range(int(rng.uniform(4, 16))):
            x, y = cx + rng.normal(0, 70 * SS), cy + rng.normal(0, 70 * SS)
            a, ln = main + rng.normal(0, 0.5), rng.uniform(8, 60) * SS
            value = int(255 * rng.uniform(0.2, 0.85))
            width = int(rng.uniform(2, 6) * SS)
            for ox in (-big, 0, big):
                for oy in (-big, 0, big):
                    draw.line([(x + ox, y + oy), (x + ox + math.cos(a) * ln, y + oy + math.sin(a) * ln)], fill=value, width=width)
    out = np.asarray(img.resize((SIZE, SIZE), Image.LANCZOS), dtype=np.float32) / 255.0
    return np.clip(out * (0.55 + 0.45 * spectral(1.2)), 0, 1)  # a rub is never evenly deep


def flakes():
    """Chip height for paint that comes off in plates: large angular cells (a periodic Voronoi), edges first."""
    size = 512
    pts = rng.uniform(0, size, (70, 2))
    yy, xx = np.mgrid[0:size, 0:size]
    d1 = np.full((size, size), 1e9)
    d2 = np.full((size, size), 1e9)
    for px_, py_ in pts:
        dx = np.minimum(np.abs(xx - px_), size - np.abs(xx - px_))
        dy = np.minimum(np.abs(yy - py_), size - np.abs(yy - py_))
        d = np.abs(dx) + np.abs(dy) * 0.8  # Manhattan-ish: angular plates
        closer = d < d1
        d2 = np.where(closer, d1, np.minimum(d2, d))
        d1 = np.where(closer, d, d1)
    n = (d2 - d1) + 55.0 * spectral(1.4, size)  # borders are low, but only where the noise agrees: broken seams, not a net
    flat = np.argsort(np.argsort(n.ravel())).reshape(n.shape) / (n.size - 1)
    return flat.astype(np.float32)


base = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'textures', 'hardware')
for name, data in (('wear-scratches-v1', scratches()), ('wear-chips-v1', chips()), ('wear-swirls-v1', swirls()), ('wear-pits-v2', pits()), ('wear-scuffs-v2', scuffs()), ('wear-flakes-v2', flakes())):
    path = os.path.join(base, name + '.webp')
    Image.fromarray((data * 255 + 0.5).astype(np.uint8), 'L').save(path, 'WEBP', quality=88, method=6)
    print('WEAR', os.path.abspath(path), os.path.getsize(path) // 1024, 'KB')

"""
hall-floor-texture.py — the hall's floor as polished concrete (generated, no download).

Dennis, 2026-09-20: "der Boden muss dann auch realistischere bessere Textur haben." The floor before that was a 29 KB
marble tile; v1 replaced it with a power-trowelled slab. v2 (same night, "noch eine Stufe") fixes what v1 got wrong:
its cloudiness sat at the size of the tile, so the 2 m repeat was readable across the hall, and its aggregate was
thresholded white noise — single pixels, the salt-and-pepper "dots" Dennis does not want.

v2 keeps the slab: cloudy cement, the arcs of the trowel, saw-cut joints along the tile's border (the hall repeats the
tile every 2 m, so the joints form the slab grid and hide the repeat), a couple of hairline cracks. New in v2: the
cloudiness is band-limited to under half a metre, the aggregate is ground-flush clusters of stones instead of specks
and only shows where the grinder bit deepest, there are a few faint spill stains, and the sealer is scuffed in short
curved strokes. Everything bigger than the tile — the slow variation of the sealer and the lane people walk in front
of the machines — is analytic and in world space, in floorReflectionShader.ts, where it cannot tile.

    python scripts/assets/hall-floor-texture.py
        ->  public/textures/floor/concrete-v2_{basecolor,normal,orm}.webp

ORM as the hall expects it (three.js): R = occlusion, G = roughness factor (multiplied by the material's 0.44),
B = metalness (0).
"""

import math
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SIZE = 1024
TILE_M = 2.0
rng = np.random.default_rng(77)


def band(cells, seed, aspect=1.0):
    """Tileable band-limited noise (zero mean, unit variance); features are about SIZE / cells pixels."""
    cy = max(2, int(round(cells / aspect)))
    cx = max(2, int(cells))
    r = np.random.default_rng(seed)
    spec = np.fft.rfft2(r.normal(size=(cy, cx)))
    out = np.zeros((SIZE, SIZE // 2 + 1), dtype=complex)
    ky, kx = cy // 2, cx // 2 + 1
    out[:ky, :kx] = spec[:ky, :kx]
    out[SIZE - ky:, :kx] = spec[cy - ky:, :kx]
    n = np.fft.irfft2(out, s=(SIZE, SIZE))
    n -= n.mean()
    s = n.std()
    return n / (s if s > 1e-9 else 1.0)


def fbm(cells, octaves, seed, gain=0.5, aspect=1.0):
    total = np.zeros((SIZE, SIZE), dtype=np.float32)
    amp, norm = 1.0, 0.0
    for o in range(octaves):
        total += band(cells * 2 ** o, seed + o * 101, aspect).astype(np.float32) * amp
        norm += amp * amp
        amp *= gain
    total /= np.sqrt(norm)
    return np.clip(total * 0.26 + 0.5, 0.0, 1.0)


def smooth(t, a, b):
    x = np.clip((t - a) / (b - a), 0.0, 1.0)
    return x * x * (3.0 - 2.0 * x)


def tiled_lines(draw_fn, blur=0.0, ss=2):
    big = SIZE * ss
    img = Image.new("L", (big, big), 0)
    d = ImageDraw.Draw(img)
    for ox in (-big, 0, big):
        for oy in (-big, 0, big):
            draw_fn(d, ox, oy, ss)
    img = img.resize((SIZE, SIZE), Image.LANCZOS)
    if blur:
        img = img.filter(ImageFilter.GaussianBlur(blur))
    return np.asarray(img, dtype=np.float32) / 255.0


# trowel arcs: broad, faint, overlapping
arcs = [(rng.uniform(0, SIZE), rng.uniform(0, SIZE), rng.uniform(140, 420), rng.uniform(0, 360), rng.uniform(40, 110), rng.uniform(0.15, 0.6)) for _ in range(90)]


def draw_arcs(d, ox, oy, ss):
    for cx, cy, r, a0, span, v in arcs:
        d.arc([(cx - r) * ss + ox, (cy - r) * ss + oy, (cx + r) * ss + ox, (cy + r) * ss + oy], a0, a0 + span, fill=int(255 * v), width=int(3 * ss))


# hairline cracks: a few wandering polylines
cracks = []
for _ in range(2):
    x, y, a = rng.uniform(0, SIZE), rng.uniform(0, SIZE), rng.uniform(0, math.tau)
    pts = [(x, y)]
    for _ in range(int(rng.uniform(10, 24))):
        a += rng.normal(0, 0.35)
        x += math.cos(a) * 9
        y += math.sin(a) * 9
        pts.append((x, y))
    cracks.append(pts)


def draw_cracks(d, ox, oy, ss):
    for pts in cracks:
        d.line([(px * ss + ox, py * ss + oy) for px, py in pts], fill=255, width=ss)


# scuffs: short curved strokes where a sole slid over the sealer — roughness only, never a dark mark
scuffs = []
for _ in range(120):
    cx, cy = rng.uniform(0, SIZE), rng.uniform(0, SIZE)
    r = rng.uniform(30, 150)
    a0 = rng.uniform(0, 360)
    scuffs.append((cx, cy, r, a0, rng.uniform(8, 34), rng.uniform(0.25, 0.9)))


def draw_scuffs(d, ox, oy, ss):
    for cx, cy, r, a0, span, v in scuffs:
        d.arc([(cx - r) * ss + ox, (cy - r) * ss + oy, (cx + r) * ss + ox, (cy + r) * ss + oy], a0, a0 + span, fill=int(255 * v), width=int(2 * ss))


trowel = tiled_lines(draw_arcs, blur=2.2)
crack = tiled_lines(draw_cracks, blur=0.0)
scuff = tiled_lines(draw_scuffs, blur=1.1)

# cement: nothing larger than half a metre, or the 2 m tile would read across the hall
cloud = fbm(6, 4, 201)          # 34 cm down to 4 cm
mottle = fbm(20, 3, 202)        # 10 cm
grain = fbm(70, 2, 203)         # 15 px down to 7: the paste itself, never fine enough to read as specks

# saw-cut joint along the tile's border: 3 px wide, soft shoulders
edge = np.minimum.reduce([np.arange(SIZE), SIZE - 1 - np.arange(SIZE)]).astype(np.float32)
joint_1d = np.clip(1.0 - edge / 2.2, 0, 1)
joint = np.maximum(joint_1d[:, None], joint_1d[None, :])
shoulder_1d = np.clip(1.0 - edge / 9.0, 0, 1) ** 2
shoulder = np.maximum(shoulder_1d[:, None], shoulder_1d[None, :])

# aggregate: the grinder opened the paste in patches and exposed clusters of stones, 5-20 mm across.
# Two bands multiplied so a stone is never a single pixel, and a third gates where the floor was cut deep enough.
stone = np.clip((band(150, 211) - 0.55) * 1.2, 0.0, 1.0) * np.clip((band(90, 212) + 0.5) * 0.9, 0.0, 1.0)
opened = smooth(fbm(9, 3, 213), 0.52, 0.80)
aggregate = np.clip(stone * 2.2, 0.0, 1.0) * opened

# spills: a handful of faint, irregular stains that soaked into the slab
stain = np.clip((fbm(11, 4, 221) - 0.66) * 3.4, 0.0, 1.0)

# ---- base colour: cool cement grey, clouded ---------------------------------------------------------------------------
lum = 0.50 + 0.15 * (cloud - 0.5) + 0.13 * (mottle - 0.5) + 0.06 * (grain - 0.5) + 0.05 * trowel
lum = lum * (1 - 0.75 * joint) * (1 - 0.12 * shoulder) * (1 - 0.28 * crack)
# the stones are a shade darker than the paste, but barely: in the albedo they would read as dots, so the
# aggregate does its work in the roughness instead
lum = lum * (1 - 0.06 * aggregate)
lum = lum * (1 - 0.13 * stain)
warm = 0.02 * (cloud - 0.5) + 0.022 * stain
rgb = np.stack([lum * (1.0 + warm), lum * (1.0 + warm * 0.3), lum * (1.03 - warm)], axis=-1)
rgb = np.clip(rgb, 0, 1)

# ---- height -> normal ---------------------------------------------------------------------------------------------
height = (
    0.05 * (cloud - 0.5)
    + 0.02 * (grain - 0.5)
    + 0.03 * trowel
    - 1.0 * joint
    - 0.15 * shoulder
    - 0.35 * crack
    - 0.05 * aggregate
)
gx = (np.roll(height, -1, axis=1) - np.roll(height, 1, axis=1)) * 0.5
gy = (np.roll(height, -1, axis=0) - np.roll(height, 1, axis=0)) * 0.5
strength = 6.0
nx, ny, nz = -gx * strength, gy * strength, np.ones_like(height)
ln = np.sqrt(nx * nx + ny * ny + nz * nz)
normal = np.stack([nx / ln, ny / ln, nz / ln], axis=-1) * 0.5 + 0.5

# ---- ORM -----------------------------------------------------------------------------------------------------------
ao = np.clip(1.0 - 0.8 * joint - 0.25 * shoulder - 0.4 * crack - 0.06 * aggregate, 0, 1)
rough = (
    0.66
    + 0.12 * (mottle - 0.5)
    - 0.10 * trowel
    + 0.35 * joint
    + 0.20 * crack
    + 0.14 * aggregate        # ground stone never polishes up like the paste
    + 0.26 * scuff            # a sole that slid leaves a dull stroke, not a dark one
    + 0.10 * stain
)
orm = np.stack([ao, np.clip(rough, 0.35, 1.0), np.zeros_like(ao)], axis=-1)

out = os.path.join(os.path.dirname(__file__), "..", "..", "public", "textures", "floor")
os.makedirs(out, exist_ok=True)
total = 0
for name, data, q in (("basecolor", rgb, 84), ("normal", normal, 90), ("orm", orm, 84)):
    path = os.path.join(out, f"concrete-v2_{name}.webp")
    Image.fromarray((np.clip(data, 0, 1) * 255 + 0.5).astype(np.uint8), "RGB").save(path, "WEBP", quality=q, method=6)
    total += os.path.getsize(path)
    print("FLOOR", os.path.basename(path), os.path.getsize(path) // 1024, "KB")
print("FLOOR total", total // 1024, "KB — tile", TILE_M, "m")

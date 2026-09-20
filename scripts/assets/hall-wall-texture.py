"""
hall-wall-texture.py — the hall's back wall as a real brick wall (generated, no download).

Dennis, 2026-09-20 ("noch eine Stufe"): the Quaternius tile the wall used was painted, its bricks were 60 cm long and
its normal map carried almost no relief, so the wall — the surface that fills most of every frame — read flat and CG.

This builds a running-bond wall of real masonry proportions: bricks of 240 x 73 mm with 10 mm joints, a course pitch of
83.3 mm. One tile is exactly 2.00 x 2.00 m (8 bricks x 24 courses at 2048 px, so about 1 px per mm), and the hall
repeats it 90 x 12 over the 180 x 24 m plane, which puts the bricks at their real size on the wall.

v2 (same night, after the first look at hall distance): v1 read flatter than the wall it replaced. What makes a brick
wall read as brick from six metres is not fine grain — the mip chain averages that away — but RELIEF at brick scale: a
joint that is clearly recessed and clearly darker, and faces that are domed so the station lights rake across them. So
v2 rakes the joint 10 mm deep with a 6 mm roll-over at the arris, keeps the normal map at full 2048, makes the mortar
darker than the faces (this is a dark painted wall: the joint is the shadow line) and puts strong occlusion in it.
Everything that read as grey fog is gone: no lime bloom, no mortar smears, no repaired bricks. Per-brick value spread
is half of v1's with no bright outliers, and over-fired bricks are rarer and much less dark.

Second pass on v2: the wall was still laid too well. A perfect rectangle on a perfect grid reads as a CG grid from six
metres, however good the relief is. So no brick is quite the length of its neighbour (joints move by up to 3.5 mm),
the bed drifts slowly along each course (about 2 mm over a quarter of a metre), every brick is turned by a fraction of
a degree, and no arris is a straight line — it wobbles by a millimetre or two over three to eight centimetres, and a
few corners per tile are worn round (in the relief only, never as a spot in the albedo). The face colour also moved a
little back towards the warm dark brown of the wall this replaced, which took the brand light more warmly.

What the tile carries: per-brick value, warmth and roughness; a domed face that is never square to the wall; rounded
arrises, in places knocked out; a raked, sandy mortar joint; sparse pitting; and soot in patches, never an even film.
No salt-and-pepper speckle in the albedo (Dennis dislikes dots) and no blotchy fog.

    python scripts/assets/hall-wall-texture.py
        ->  public/textures/wall/brick-v2_{basecolor,normal,orm}.webp

ORM as the hall expects it (three.js): R = occlusion, G = roughness factor, B = metalness (0).
"""

import os

import numpy as np
from PIL import Image

SIZE = 2048            # px per tile
NORMAL_SIZE = 2048     # the joint walls carry the wall; halving them is what flattened v1 at hall distance
ORM_SIZE = 1024        # the ORM carries no detail the eye can find at wall distance
TILE_M = 2.00          # metres per tile -> 1024 px/m, about 1 px per mm
COLS = 8               # 8 bricks x 250 mm pitch  = 2.00 m
ROWS = 24              # 24 courses x 83.33 mm    = 2.00 m
BW = SIZE / COLS       # 256 px brick pitch
BH = SIZE / ROWS       # 85.33 px course pitch
JOINT = 10.5           # px = mm of mortar joint
MM = SIZE / (TILE_M * 1000.0)  # px per mm


# ---- tileable band-limited noise -------------------------------------------------------------------------------------
def band(cells, seed, aspect=1.0):
    """White noise on a cells x cells grid, band-limited up to SIZE by zero padding in the frequency domain.

    Periodic by construction (so the tile never seams) and, unlike 1/f^beta noise, it puts its energy exactly at the
    feature size asked for: SIZE / cells pixels. `aspect` > 1 stretches the features vertically (soot runs)."""
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
    """Sum of bands, normalised to roughly [0, 1]."""
    total = np.zeros((SIZE, SIZE), dtype=np.float32)
    amp = 1.0
    norm = 0.0
    for o in range(octaves):
        total += band(cells * 2 ** o, seed + o * 101, aspect).astype(np.float32) * amp
        norm += amp * amp
        amp *= gain
    total /= np.sqrt(norm)
    return np.clip(total * 0.26 + 0.5, 0.0, 1.0)


def smooth(t, a, b):
    x = np.clip((t - a) / (b - a), 0.0, 1.0)
    return x * x * (3.0 - 2.0 * x)


# ---- the bond --------------------------------------------------------------------------------------------------------
yy, xx = np.mgrid[0:SIZE, 0:SIZE].astype(np.float32)

c_rng = np.random.default_rng(1848)
course_wave = c_rng.normal(0.0, 1.0, ROWS) * 1.1        # the bricklayer's line is never exactly level
course_joint = c_rng.normal(0.0, 1.0, ROWS) * 0.9       # nor is every bed joint the same thickness

course = np.floor(yy / BH).astype(np.int32)
fy = yy - course * BH
shift = np.where(course % 2 == 1, BW * 0.5, 0.0)
sx = np.mod(xx + shift, SIZE)
col = np.floor(sx / BW).astype(np.int32)
fx = sx - col * BW
brick = course * COLS + col                              # unique id per brick in the tile
N = ROWS * COLS


def per_brick(values):
    return np.asarray(values, dtype=np.float32)[brick]


def per_course(values):
    return np.asarray(values, dtype=np.float32)[course]


b_rng = np.random.default_rng(4711)
# one batch of bricks, not a mosaic: half of v1's spread, tightly clipped, so no single brick lights up and betrays
# the tile when it repeats every two metres
b_value = np.clip(b_rng.normal(0.0, 1.0, N), -1.5, 1.5)
b_warm = b_rng.normal(0.0, 1.0, N)                       # iron-warm vs. ash-cool burn
b_rough = b_rng.uniform(0.0, 1.0, N)
b_tiltx = b_rng.normal(0.0, 1.0, N)                      # no face is square to the wall
b_tilty = b_rng.normal(0.0, 1.0, N)
b_proud = b_rng.normal(0.0, 1.0, N)                      # laid a little proud of or behind the line
b_bow = b_rng.normal(0.0, 1.0, N)                        # the face is slightly dished or bellied
b_chip = b_rng.uniform(0.0, 1.0, N) ** 2.6               # how badly the arrises are knocked about (most bricks: hardly)
b_len = b_rng.normal(0.0, 1.0, N)                        # length tolerance: no two bricks the same
b_rot = np.clip(b_rng.normal(0.0, 1.0, N), -2.0, 2.0)    # every brick is turned a fraction of a degree
b_worn = b_rng.uniform(0.0, 1.0, N) ** 3.0               # a few corners per tile are worn round
b_corner = b_rng.integers(0, 4, N)
b_grain = b_rng.uniform(0.0, 1.0, N)                     # how coarse the sanded face is

fired = b_rng.uniform(0, 1, N) < 0.022                   # over-fired: a shade darker, a little glassier

# ---- the face of each brick ------------------------------------------------------------------------------------------
half_j = JOINT * 0.5
# the bed drifts slowly along the course: about 2 mm over a quarter of a metre, the same for every brick it passes
# under, which is what a levelled-by-eye course actually does
bed = band(10, 76, aspect=9.0) * 1.05
x0 = half_j - per_brick(b_len) * 3.5
x1 = BW - half_j + per_brick(b_len) * 3.5
y0 = half_j + per_course(course_joint) * 0.8 - per_course(course_wave) * 0.35 + bed
y1 = BH - half_j - per_course(np.roll(course_joint, 1)) * 0.8 - per_course(course_wave) * 0.35 + bed

# ... and every brick is turned a fraction of a degree in its bed (0.4 deg at most)
ang = per_brick(b_rot) * 0.0035
ca, sa = np.cos(ang), np.sin(ang)
ox, oy = fx - BW * 0.5, fy - BH * 0.5
fx = BW * 0.5 + ox * ca + oy * sa
fy = BH * 0.5 - ox * sa + oy * ca

# rounded-rectangle distance: positive inside the brick face, in px (= mm)
radius = 4.0
qx = np.maximum(x0 + radius - fx, fx - (x1 - radius))
qy = np.maximum(y0 + radius - fy, fy - (y1 - radius))
outside = np.sqrt(np.maximum(qx, 0.0) ** 2 + np.maximum(qy, 0.0) ** 2) - radius
insid = np.minimum(np.maximum(qx, qy), 0.0) - radius
face_d = -(outside + insid)                               # > 0 inside the face, 0 on the arris

# no arris is a straight line: one to two millimetres of wobble over three to eight centimetres of edge
face_d = face_d - band(96, 74) * 0.45 - band(48, 75) * 0.85 - band(26, 77) * 0.70

# chipped and knocked edges, only where a brick took a knock: a shallow bite out of the arris, 2-5 mm deep.
# The bite stays a step in the face — it must not drop all the way to the mortar, or the joint grows black teeth.
chip_fine = band(256, 71)                                 # 8 px teeth
chip_mid = band(64, 72)                                   # 32 px bites
chip_big = band(20, 73)                                   # where along the brick the damage sits at all
chip_amt = np.clip((chip_fine * 0.45 + chip_mid * 0.95 + chip_big * 0.8 - 0.95) * 0.9, 0.0, 1.0)
chip_amt = chip_amt * per_brick(b_chip)

face = smooth(face_d, 0.30, 2.2)                          # 1 on the brick, 0 in the mortar (albedo edge: crisp)
# the HEIGHT rolls over six millimetres instead. That rounded arris is what catches the raking station light and
# survives the mip chain, where a two-pixel cliff averages itself away to nothing.
face_h = smooth(face_d, -1.0, 6.5)
arris = smooth(face_d, -0.5, 4.5) * (1.0 - smooth(face_d, 4.5, 11.0))   # the rounded edge itself
# the damage clings to the edge and dies out towards the middle of the face
chip = chip_amt * (1.0 - smooth(face_d, 1.0, 26.0)) * face

# a handful of corners per tile are simply worn round — relief only, never a bright spot in the albedo
cx_pick = np.where(per_brick(b_corner % 2) > 0.5, x1, x0)
cy_pick = np.where(per_brick(b_corner // 2) > 0.5, y1, y0)
corner_d = np.sqrt((fx - cx_pick) ** 2 + ((fy - cy_pick) * 1.6) ** 2)
worn = per_brick(b_worn) * (1.0 - smooth(corner_d, 4.0, 30.0)) * face

# ---- height field (in mm) --------------------------------------------------------------------------------------------
face_dish = band(16, 11)                                  # 128 px: the face is dished across its width
face_lump = fbm(32, 3, 12)                                # 64..16 px lumps from the mould
face_sand = fbm(96, 2, 13)                                # 21..10 px: the coarsest sanding, the rest only mips away
mortar_sand = fbm(128, 3, 15)                             # the joint is a sand mortar, coarse and open
mortar_rake = band(24, 16)                                # the trowel raked it unevenly deep
pit_field = band(160, 17)

u = (fx - BW * 0.5) / (BW * 0.5)
v = (fy - BH * 0.5) / (BH * 0.5)
tilt = per_brick(b_tiltx) * 0.55 * u + per_brick(b_tilty) * 0.38 * v
# every face is domed, the amount varies: a brick-wide gradient is the one piece of relief the mip chain keeps, and
# it is what lets the station lights rake across the wall instead of washing it flat
bow = (1.05 + per_brick(b_bow) * 0.45) * (1.0 - u * u) * (1.0 - v * v)
proud = per_brick(b_proud) * 0.9

brick_h = (
    tilt
    + bow
    + proud
    + face_dish * 0.45
    + (face_lump - 0.5) * 1.05
    + (face_sand - 0.5) * (0.45 + 0.55 * per_brick(b_grain))
    - chip * 4.5
    - worn * 2.6
)
# pitting: sparse holes where a grain of lime blew out, deep enough for the normal map to catch them
# sparse, irregular blow-outs where a grain of lime burst; two bands multiplied so they are never round dots
pits = np.clip((pit_field - 1.85) * 1.5, 0.0, 1.0) * np.clip((band(96, 19) + 0.6) * 1.2, 0.0, 1.0)
pits *= smooth(fbm(24, 2, 18), 0.52, 0.74)
brick_h -= pits * 0.95

# a raked joint, 10 mm behind the face and deepest in its middle
mortar_h = (
    -10.0
    + (mortar_sand - 0.5) * 2.2
    + mortar_rake * 1.6
)
mortar_h -= 2.2 * (1.0 - smooth(-face_d, half_j * 0.9, 0.0))

height = mortar_h + (brick_h - mortar_h) * face_h

# ---- colour ----------------------------------------------------------------------------------------------------------
# a dark, slightly cool charcoal brick: the hall desaturates the wall to 30 % and multiplies it by 0x858c99, so the
# tile keeps the luminance of the old one and spends its budget on variation instead of on hue.
val = 0.375 + per_brick(b_value) * 0.023
val = np.where(per_brick(fired.astype(np.float32)) > 0.5, val * 0.80, val)

burn = fbm(20, 4, 31)          # fire marks, a few bricks wide
face_cloud = fbm(48, 3, 32)    # the clouding inside one face

brick_lum = val * (0.93 + 0.14 * burn) * (0.95 + 0.10 * face_cloud)
# a knocked arris shows the raw, lighter body of the brick; the pit itself stays in the relief, not in the albedo
brick_lum *= 1.0 + 0.10 * arris * (0.30 + 0.70 * per_brick(b_chip))
brick_lum *= 1.0 + 0.18 * chip          # a fresh break shows the raw, lighter body
brick_lum *= 0.97 + 0.06 * face_sand

# a touch back towards the warm dark brown of the wall this replaced: the hall desaturates the brick to 30 %, so
# what is left of this is roughly the warmth the old tile showed under the brand light
warm = 0.100 + per_brick(b_warm) * 0.045 + (burn - 0.5) * 0.04
warm = np.where(per_brick(fired.astype(np.float32)) > 0.5, warm - 0.04, warm)

# The joint is the shadow line of a dark painted wall: clearly darker than the face it sits between. v1 had it
# lighter, which is what made the wall read as a printed pattern instead of brick.
mortar_lum = 0.185 * (0.90 + 0.20 * mortar_sand) * (0.95 + 0.10 * mortar_rake)
mortar_lum *= 1.0 - 0.34 * (1.0 - smooth(-face_d, half_j, 0.0))    # deepest in the middle, deepest in shadow

lum = mortar_lum + (brick_lum - mortar_lum) * face
cool = np.where(face > 0.5, warm, 0.030 + warm * 0.15)
bloom = np.zeros_like(lum)

# grime: soot in patches and long runs, never an even film. Nothing here is allowed to be much bigger than half a
# metre — anything larger would repeat with the tile every two metres and the eye would find the grid. The large
# scale is done in world space in wallGrime.ts.
soot_patch = fbm(13, 4, 51)
soot_run = fbm(15, 4, 52, aspect=5.0)                     # stretched downwards: rain and dust run down the wall
runs = smooth(soot_run, 0.58, 0.94) * smooth(fbm(10, 2, 53), 0.46, 0.98)
dirt = np.clip(0.34 * smooth(soot_patch, 0.54, 0.96) + 0.26 * runs, 0.0, 1.0)
dirt = dirt * (0.55 + 0.45 * (1.0 - face))                # the mortar holds more dirt than the fired face
lum *= 1.0 - 0.13 * dirt
cool -= 0.020 * dirt

rgb = np.stack([lum * (1.0 + cool), lum * (1.0 + cool * 0.25), lum * (1.0 - cool * 0.55)], axis=-1)
rgb = np.clip(rgb, 0.0, 1.0)

# ---- height -> tangent space normal ------------------------------------------------------------------------------------
h = height.astype(np.float32)
gx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * 0.5 + (np.roll(h, -2, 1) - np.roll(h, 2, 1)) * 0.25
gy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * 0.5 + (np.roll(h, -2, 0) - np.roll(h, 2, 0)) * 0.25
gx *= MM / 1.5
gy *= MM / 1.5
nx, ny, nz = -gx, gy, np.ones_like(h)
ln = np.sqrt(nx * nx + ny * ny + nz * nz)
normal = np.stack([nx / ln, ny / ln, nz / ln], axis=-1) * 0.5 + 0.5

# ---- ORM ---------------------------------------------------------------------------------------------------------------
# occlusion carries the recess at every mip level, where the normal map's two opposite joint walls cancel out
depth = np.clip((0.0 - height) / 11.0, 0.0, 1.0)
blur = depth
for _ in range(3):
    blur = (blur + np.roll(blur, 3, 0) + np.roll(blur, -3, 0) + np.roll(blur, 3, 1) + np.roll(blur, -3, 1)) / 5.0
ao = np.clip(1.0 - 0.72 * blur - 0.45 * depth, 0.10, 1.0)
ao *= 1.0 - 0.22 * pits

rough_brick = 0.76 + 0.12 * per_brick(b_rough) + 0.06 * (face_cloud - 0.5) + 0.08 * (face_sand - 0.5)
rough_brick = np.where(per_brick(fired.astype(np.float32)) > 0.5, rough_brick * 0.80, rough_brick)
rough_mortar = 0.95 + 0.05 * (mortar_sand - 0.5)
rough = rough_mortar + (rough_brick - rough_mortar) * face
rough += 0.16 * arris * (0.3 + 0.7 * per_brick(b_chip)) + 0.14 * pits + 0.14 * chip
rough += 0.08 * dirt
rough = np.clip(rough, 0.30, 1.0)

orm = np.stack([ao, rough, np.zeros_like(ao)], axis=-1)

# ---- write ---------------------------------------------------------------------------------------------------------------
out = os.path.join(os.path.dirname(__file__), "..", "..", "public", "textures", "wall")
os.makedirs(out, exist_ok=True)


def save(name, data, quality, size=None):
    img = Image.fromarray((np.clip(data, 0, 1) * 255 + 0.5).astype(np.uint8), "RGB")
    if size and size != img.size[0]:
        img = img.resize((size, size), Image.LANCZOS)
    path = os.path.join(out, f"brick-v2_{name}.webp")
    img.save(path, "WEBP", quality=quality, method=6)
    return os.path.getsize(path)


total = 0
for name, data, quality, size in (("basecolor", rgb, 82, None), ("normal", normal, 86, NORMAL_SIZE), ("orm", orm, 82, ORM_SIZE)):
    n = save(name, data, quality, size)
    total += n
    print("WALL", f"brick-v2_{name}.webp", n // 1024, "KB")
print("WALL total", total // 1024, "KB")
print("brick", round(BW / MM), "x", round(BH / MM), "mm pitch, joint", round(JOINT / MM, 1), "mm, tile", TILE_M, "m")

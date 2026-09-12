"""Author Blue's clips on the skinned master and export the v2 runtime GLB.

blender --background --python scripts/models/blender/blue_animate.py

Input:  .source-assets/blue/v3/blue-rigged-master.blend (skin from blue_rig.py)
Output: .source-assets/blue/v3/blue-animated-v2.blend, blue-rigged-v2.glb, blue-coat-clean.png

The pose builder works positions-first: torso, legs and tail get target joint
positions per frame, segment lengths are restored along each chain and bone
rotations follow the posed segment directions. Every clip is sampled at 30 fps
without exporter key decimation so slow motion stays continuous.

Clips: idle, walk, settle/sleep/wake (sphinx rest), happy, sit/sitidle (upright
sit in front of a cabinet), jump (in-place crouch, leap, land; the runtime moves
the body), perch/perchidle (lying on a ledge with the front paws hanging over).
"""
import bpy, math, json, struct
import numpy as np
from pathlib import Path
from mathutils import Vector, Matrix, Quaternion

ROOT = Path(__file__).resolve().parents[3]
WORK = ROOT / '.source-assets/blue/v3'
MASTER = WORK / 'blue-rigged-master.blend'
OUT_BLEND = WORK / 'blue-animated-v2.blend'
OUT_GLB = WORK / 'blue-rigged-v2.glb'
FPS = 30

bpy.ops.wm.open_mainfile(filepath=str(MASTER))
arm = bpy.data.objects['BlueRig']; mesh = bpy.data.objects['BlueCoat']; data = arm.data
scene = bpy.context.scene; scene.render.fps = FPS

# ---------------------------------------------------------------- reset
arm.animation_data_clear()
for a in list(bpy.data.actions): bpy.data.actions.remove(a)
blocks = mesh.data.shape_keys.key_blocks
if 'BlueGround' in blocks: mesh.shape_key_remove(blocks['BlueGround'])
for pb in arm.pose.bones: pb.matrix_basis = Matrix.Identity(4)

names = [b.name for b in data.bones]
heads = {b.name: b.head_local.copy() for b in data.bones}
parents = {b.name: (b.parent.name if b.parent else None) for b in data.bones}
rest = {n: data.bones[n].matrix_local.copy() for n in names}
restq = {n: m.to_quaternion() for n, m in rest.items()}
TAIL = [f'Tail{i}' for i in range(6)]
TORSO = ['Pelvis', 'Spine', 'Chest', 'Neck', 'Head']

V = lambda p: Vector(p)
clamp = lambda t: max(0., min(1., t))
def smooth(t):
    t = clamp(t); return t * t * (3 - 2 * t)
def ease(t, a, b): return smooth((t - a) / (b - a))
def pulse(t, start, dur):
    u = (t - start) / dur
    return math.sin(math.pi * u) ** 2 if 0 < u < 1 else 0.
def track(t, keys):
    """Piecewise smoothstep through (time, value) keys; holds the end values."""
    if t <= keys[0][0]: return keys[0][1]
    for (t0, v0), (t1, v1) in zip(keys, keys[1:]):
        if t <= t1: return v0 + (v1 - v0) * smooth((t - t0) / (t1 - t0))
    return keys[-1][1]
def ease_out(t, a, b, power=3.):
    """Fast start, long settle (cubic out by default): reactions, placements, the head acquiring a target."""
    u = clamp((t - a) / (b - a)); return 1 - (1 - u) ** power
def ease_in(t, a, b, power=2.):
    u = clamp((t - a) / (b - a)); return u ** power
def ease_back(t, a, b, s=1.3):
    """Overshoots the target and settles back (ease-out-back): weight arriving somewhere."""
    u = clamp((t - a) / (b - a)) - 1; return 1 + (s + 1) * u ** 3 + s * u ** 2
EASES = {'smooth': lambda u: smooth(u), 'out': lambda u: 1 - (1 - u) ** 3, 'in': lambda u: u * u,
         'back': lambda u: 1 + 2.3 * (u - 1) ** 3 + 1.3 * (u - 1) ** 2, 'snap': lambda u: 1 - (1 - u) ** 5}
def curve(t, keys):
    """Like track(), but every key may name the ease used to reach it: (time, value[, ease])."""
    if t <= keys[0][0]: return keys[0][1]
    for k0, k1 in zip(keys, keys[1:]):
        if t <= k1[0]:
            u = clamp((t - k0[0]) / (k1[0] - k0[0])); return k0[1] + (k1[1] - k0[1]) * EASES[k1[2] if len(k1) > 2 else 'smooth'](u)
    return keys[-1][1]
def jitter(seed, spread=.12):
    """Deterministic ±spread variation so repeated motions never line up on a grid."""
    x = math.sin(seed * 12.9898 + 78.233) * 43758.5453
    return 1 + (x - math.floor(x) - .5) * 2 * spread
def q(axis, angle): return Quaternion(V(axis), angle)
def ik(a, c, l1, l2, bend):
    # The leg never quite locks straight, and when the bend hint is (almost) along the leg the knee keeps a
    # continuous side (a perpendicular built from the lateral axis) instead of flipping frame to frame.
    d = c - a; distance = min(d.length, (l1 + l2) * .985); axis = d.normalized()
    along = (l1 * l1 - l2 * l2 + distance * distance) / (2 * max(distance, .00001))
    height = math.sqrt(max(0, l1 * l1 - along * along))
    b = V(bend); b = b - axis * b.dot(axis)
    if b.length < .1: b = b + V((1, 0, 0)).cross(axis).normalized() * (.1 - b.length)
    return a + axis * along + b.normalized() * height

# Tail shapes as offsets from Tail0 (rest curl, carried upright, resting on the floor beside the body).
TAIL_REST = [heads[n] - heads['Tail0'] for n in TAIL]
TAIL_UP = [V(v) for v in [(0, 0, 0), (0, .038, .06), (0, .044, .136), (0, .025, .192), (0, -.021, .213), (0, -.055, .188)]]
TAIL_FLOOR = [V(v) for v in [(0, 0, 0), (0, .07, -.08), (.045, .11, -.135), (.10, .07, -.138), (.115, -.02, -.138), (.115, -.09, -.138)]]
TAIL_BACK = [V(v) for v in [(0, 0, 0), (0, .075, -.02), (0, .15, -.03), (0, .225, -.035), (0, .30, -.04), (0, .375, -.045)]]
# Torso drops (metres) for the sphinx rest and the upright sit.
DROP = {'Pelvis': .10, 'Spine': .095, 'Chest': .085, 'Neck': .06, 'Head': .05}
SIT_DROP = {'Pelvis': .115, 'Spine': .085, 'Chest': .03, 'Neck': 0., 'Head': 0.}
# Leg targets (x is mirrored per side): sphinx front legs extended forward, hind legs tucked,
# sitting hind legs tucked a little further forward.
FRONT_SPHINX = ((.072, -.365, .023), (0, .35, -1))
HIND_TUCK = ((.088, .035, .023), (0, 1, -.15))
HIND_SIT = ((.085, .05, .023), (0, 1, -.15))
# Ledge perch. The marquee edge runs EDGE_Y in front of the body origin (the runtime places him so the
# cabinet front face sits there). Foreleg length is .22 m; the elbow rests on the top just behind the lip
# (2 cm back, skin on the surface), the wrist crosses the edge 4 cm below it and the paws curl down by
# unequal amounts, so the weight visibly sits on the chest and elbows instead of on two straight legs.
EDGE_Y = -.25
FRONT_HANG = ((.062, -.30, -.04), (0, .3, -1))
HANG_SIDE = {'L': {'dy': 0., 'dz': 0., 'pitch': .75}, 'R': {'dy': .006, 'dz': -.008, 'pitch': .55}}

def base():
    return {
        'drop': {n: 0. for n in TORSO},
        'front': {'amount': 0., 'target': FRONT_SPHINX[0], 'bend': FRONT_SPHINX[1]},
        'hind': {'amount': 0., 'target': HIND_TUCK[0], 'bend': HIND_TUCK[1]},
        'tail_rest': 0., 'tail_back': 0.,
        'bob': 0., 'sway': 0., 'push': 0., 'head_lift': 0.,
        'yaw': {n: 0. for n in TORSO}, 'roll': {n: 0. for n in TORSO},
        'head': {'yaw': 0., 'pitch': 0., 'roll': 0.},
        'ears': {'L': [0., 0.], 'R': [0., 0.]},
        'legs': {(leg, side): {'dx': 0., 'dy': 0., 'dz': 0., 'pitch': 0., 'root_dz': 0.} for leg in ('Front', 'Hind') for side in 'LR'},
        'bend': {n: 0. for n in TORSO},  # yaw curvature per segment: the spine bends into turns and sways in the walk
        'front_side': {'L': 1., 'R': 1.},  # per-side multiplier of the front-leg pose amount (one paw at a time)
        'tail_lift': 0., 'tail_wave': [0.] * 6, 'tail_lift_wave': [0.] * 6,
        'root_yaw': 0.,  # carried by the Root bone; the runtime strips it from the clip and turns the body instead
        'root_move': V((0, 0, 0)),  # likewise for translation: the jump clips carry their own trajectory
        'body_pitch': 0.,  # whole-body pitch about the chest (negative = nose up); stays on the skeleton, not the Root
    }

def solve(P):
    p = {}; rot = {}
    p['Root'] = V((0, 0, 0)); rot['Root'] = Quaternion()
    for n in TORSO:
        v = heads[n].copy()
        v.z += P['bob'] - P['drop'][n]
        v.x += P['sway']; v.y += P['push']
        if n == 'Head': v.z += P['head_lift']
        p[n] = v
    for a, b in zip(TORSO, TORSO[1:]):
        d = p[b] - p[a]; p[b] = p[a] + d.normalized() * (heads[b] - heads[a]).length
    # Curvature: each segment turns a little further than the previous one, so the torso forms a C or an S
    # instead of a rod; planted paws keep their own positions, the leg roots ride on the bent chain.
    straight = {n: p[n].copy() for n in TORSO}; accumulated = 0.
    for a, b in zip(TORSO, TORSO[1:]):
        accumulated += P['bend'][b]
        p[b] = p[a] + q((0, 0, 1), accumulated) @ (straight[b] - straight[a])
    for n, nxt in [('Pelvis', 'Spine'), ('Spine', 'Chest'), ('Chest', 'Neck'), ('Neck', 'Head')]:
        r0 = heads[nxt] - heads[n]; r1 = p[nxt] - p[n]
        rot[n] = q((0, 0, 1), P['yaw'][n]) @ q(r1.normalized(), P['roll'][n]) @ r0.rotation_difference(r1)
    h = P['head']
    rot['Head'] = q((0, 0, 1), h['yaw']) @ q((1, 0, 0), h['pitch']) @ q((0, 1, 0), h['roll']) @ rot['Neck'].slerp(Quaternion(), .5)
    for side in 'LR':
        ear = 'Ear.' + side
        p[ear] = p['Head'] + rot['Head'] @ (heads[ear] - heads['Head'])
        pitch, yaw = P['ears'][side]
        rot[ear] = rot['Head'] @ q((1, 0, 0), pitch) @ q((0, 0, 1), yaw)
    for side in 'LR':
        sx = 1 if side == 'L' else -1
        for leg, parent, spec in [('Front', 'Chest', P['front']), ('Hind', 'Pelvis', P['hind'])]:
            up, low, paw = [f'{leg}{part}.{side}' for part in ('Upper', 'Lower', 'Paw')]
            L = P['legs'][(leg, side)]
            a = p[parent] + rot[parent] @ (heads[up] - heads[parent]) + V((0, 0, L['root_dz']))
            tx, ty, tz = spec['target']
            amount = spec['amount'] * (P['front_side'][side] if leg == 'Front' else 1.)
            # Per-leg offsets apply after the pose target, so resting poses can carry asymmetry and small stirs.
            c = heads[paw].lerp(V((sx * tx, ty, tz)), amount) + V((L['dx'], L['dy'], L['dz']))
            bend = V((0, 1, 0)).lerp(V(spec['bend']), amount)
            b = ik(a, c, (heads[low] - heads[up]).length, (heads[paw] - heads[low]).length, bend)
            p[up], p[low], p[paw] = a, b, c
            rot[up] = (heads[low] - heads[up]).rotation_difference(b - a)
            rot[low] = (heads[paw] - heads[low]).rotation_difference(c - b)
            rot[paw] = q((1, 0, 0), L['pitch'])
    t0 = p['Pelvis'] + rot['Pelvis'] @ (heads['Tail0'] - heads['Pelvis'])
    for i, n in enumerate(TAIL):
        off = TAIL_REST[i].lerp(TAIL_UP[i], P['tail_lift']).lerp(TAIL_FLOOR[i], P['tail_rest']).lerp(TAIL_BACK[i], P['tail_back'])
        off = off + V((P['tail_wave'][i], 0, P['tail_lift_wave'][i]))
        p[n] = t0 + off
    for i in range(1, len(TAIL)):
        prev, n = TAIL[i - 1], TAIL[i]
        p[n] = p[prev] + (p[n] - p[prev]).normalized() * (heads[n] - heads[prev]).length
    for i in range(len(TAIL) - 1):
        rot[TAIL[i]] = (heads[TAIL[i + 1]] - heads[TAIL[i]]).rotation_difference(p[TAIL[i + 1]] - p[TAIL[i]])
    rot['Tail5'] = rot['Tail4']
    mats = {n: Matrix.Translation(p[n]) @ rot[n].to_matrix().to_4x4() @ restq[n].to_matrix().to_4x4() for n in names}
    if P['body_pitch']:
        pivot = V((0, -.05, .2))
        pitch = Matrix.Translation(pivot) @ Matrix.Rotation(P['body_pitch'], 4, 'X') @ Matrix.Translation(-pivot)
        mats = {n: (pitch @ m if n != 'Root' else m) for n, m in mats.items()}
    if P['root_yaw']:
        turn = Matrix.Rotation(P['root_yaw'], 4, 'Z')
        mats = {n: turn @ m for n, m in mats.items()}
    if P['root_move'].length:
        move = Matrix.Translation(P['root_move'])
        mats = {n: move @ m for n, m in mats.items()}
    return mats

# ---------------------------------------------------------------- clips
# A cat's stride is long and its cadence low: 37 cm per cycle at 0.34 m/s (about 0.9 strides/s), not 23 cm at 1.5.
# The runtime scales the clip's time by speed / STRIDE_SPEED, so the roam at 0.21 m/s becomes a slow prowl.
STRIDE_SPEED = .34; WALK_CYCLE = 1.1; STANCE = .62
TROT_SPEED = .9; TROT_CYCLE = .52; TROT_STANCE = .5

def look_around(P, t, D, scale=1.):
    """Shared secondary motion: breathing, weight shift, glances, ear flicks, tail stir."""
    w = math.tau * t / D
    P['bob'] += .0016 * math.sin(math.tau * t / (D / 3))
    P['sway'] += .005 * scale * math.sin(w); P['roll']['Pelvis'] += .02 * scale * math.sin(w); P['roll']['Chest'] += -.012 * scale * math.sin(w)
    look_l = pulse(t, .15 * D, .375 * D); look_r = pulse(t, .65 * D, .325 * D)
    P['head']['yaw'] += .30 * look_l - .24 * look_r
    P['head']['pitch'] += -.05 * look_l + .03 * look_r
    P['head']['roll'] += .05 * look_r
    for side, flick in (('L', pulse(t, .30 * D, .30)), ('R', pulse(t, .8125 * D, .30))):
        P['ears'][side][0] += .40 * flick + .02 * math.sin(w)
        P['ears'][side][1] += (.08 if side == 'L' else -.08) * P['head']['yaw']
    for i in range(6):
        k = i / 5
        P['tail_wave'][i] += math.sin(math.tau * t / (D / 2) - i * .55) * .012 * k * (1 + k) + pulse(t, .575 * D, .55) * .03 * k * k
        P['tail_lift_wave'][i] += math.sin(w - i * .4) * .006 * k

def idle(t, D):
    P = base(); look_around(P, t, D)
    # Weight drifts from one side to the other and the spine follows it; once per loop a front paw is re-planted.
    w = math.tau * t / (D * .8)
    P['sway'] += .009 * math.sin(w); P['roll']['Pelvis'] += .025 * math.sin(w)
    P['bend']['Spine'] += .03 * math.sin(w + .4); P['bend']['Chest'] += .025 * math.sin(w + .9); P['bend']['Neck'] += -.02 * math.sin(w + 1.2)
    P['bob'] += -.003 * math.sin(2 * w)
    step = pulse(t, .44 * D, .9)
    L = P['legs'][('Front', 'R')]; L['dz'] += .022 * step; L['dy'] += -.018 * ease_out(t, .44 * D, .44 * D + .5) + .018 * ease_out(t, .44 * D + .9, .44 * D + 2.6)
    L['pitch'] += .3 * step; L['root_dz'] += .006 * step
    return P

def walk(t, D):
    """Lateral-sequence walk with the things a rod cannot do: hips and shoulders roll and yaw, the spine sways in
    an S behind the head, the weight sits over the stance side, shoulders lift with each swing, paws reach fast
    and are set down slowly."""
    P = base(); ph = math.tau * t / D
    P['bob'] = .006 * math.sin(2 * ph + .4)
    P['sway'] = .008 * math.sin(ph + .2)
    P['roll']['Pelvis'] = .06 * math.sin(ph); P['roll']['Chest'] = .04 * math.sin(ph + .5)
    P['yaw']['Pelvis'] = .05 * math.sin(ph)
    P['bend']['Spine'] = .055 * math.sin(ph + .3); P['bend']['Chest'] = .045 * math.sin(ph + .9)
    P['bend']['Neck'] = -.03 * math.sin(ph + 1.2); P['bend']['Head'] = -.02 * math.sin(ph + 1.5)
    # The head is not bolted to the trunk: it bobs about 2 cm on its own timing and nods a little with each step.
    P['head']['pitch'] = .05 * math.sin(2 * ph + .6); P['head']['roll'] = .02 * math.sin(ph)
    P['head_lift'] = .011 * math.sin(2 * ph + 2.0)
    stride = STRIDE_SPEED * D * STANCE
    for (leg, side), offset in {('Hind', 'L'): 0, ('Front', 'L'): .25, ('Hind', 'R'): .5, ('Front', 'R'): .75}.items():
        L = P['legs'][(leg, side)]; cycle = (t / D + offset) % 1
        if cycle < STANCE:
            L['dy'] = -stride / 2 + stride * cycle / STANCE
        else:
            u = (cycle - STANCE) / (1 - STANCE)
            reach = 1 - (1 - u) ** 2.4  # fast forward, decelerating onto the ground
            L['dy'] = stride / 2 - stride * reach
            L['dz'] = math.sin(math.pi * u ** .8) * (.045 if leg == 'Front' else .038)
            L['pitch'] = .55 * math.sin(math.pi * u) * (1 - u) ** .5
            L['root_dz'] = (.012 if leg == 'Front' else .008) * math.sin(math.pi * u)
    # Tail carried relaxed, not hooked: a low lift with a lazy lateral wave that grows towards the tip.
    P['tail_lift'] = .10
    for i in range(6):
        k = i / 5; P['tail_wave'][i] = math.sin(ph - i * .55) * .03 * k; P['tail_lift_wave'][i] = .006 * k * math.sin(2 * ph + 1)
    for side, flick in (('L', pulse(t, .1 * D, .25)), ('R', pulse(t, .6 * D, .25))): P['ears'][side][0] += .12 * flick
    return P

def trot(t, D):
    """Two-beat diagonal trot for crossing the hall: bouncing back, flexing spine, long reaching strides."""
    P = base(); ph = math.tau * t / D
    stride = TROT_SPEED * D * TROT_STANCE
    P['bob'] = .014 * math.sin(2 * ph + .3)
    P['drop']['Chest'] = .008 * math.sin(2 * ph); P['drop']['Pelvis'] = -.008 * math.sin(2 * ph)
    P['roll']['Pelvis'] = .03 * math.sin(ph); P['roll']['Chest'] = .02 * math.sin(ph + .4)
    P['bend']['Spine'] = .02 * math.sin(ph + .3); P['bend']['Chest'] = .015 * math.sin(ph + .8)
    P['head']['pitch'] = .03 * math.sin(2 * ph + .5); P['head_lift'] = -.004 * math.sin(2 * ph)
    for (leg, side), offset in {('Front', 'L'): 0, ('Hind', 'R'): 0, ('Front', 'R'): .5, ('Hind', 'L'): .5}.items():
        L = P['legs'][(leg, side)]; cycle = (t / D + offset) % 1
        if cycle < TROT_STANCE:
            L['dy'] = -stride / 2 + stride * cycle / TROT_STANCE
        else:
            u = (cycle - TROT_STANCE) / (1 - TROT_STANCE)
            reach = 1 - (1 - u) ** 2.2
            L['dy'] = stride / 2 - stride * reach
            L['dz'] = math.sin(math.pi * u ** .85) * (.07 if leg == 'Front' else .06)
            L['pitch'] = .7 * math.sin(math.pi * u) * (1 - u) ** .5
            L['root_dz'] = (.015 if leg == 'Front' else .01) * math.sin(math.pi * u)
    P['tail_lift'] = .3; P['tail_back'] = .25
    for i in range(6):
        k = i / 5; P['tail_wave'][i] = math.sin(ph - i * .5) * .012 * k; P['tail_lift_wave'][i] = .006 * k * math.sin(2 * ph)
    for side in 'LR': P['ears'][side][0] = .08
    return P

def apply_rest(P, front, torso, hind, tail, head):
    """Sphinx rest amounts per body part."""
    for n in TORSO: P['drop'][n] = DROP[n] * (torso if n in ('Pelvis', 'Spine', 'Chest') else head)
    P['front'] = {'amount': front, 'target': FRONT_SPHINX[0], 'bend': FRONT_SPHINX[1]}
    P['hind'] = {'amount': hind, 'target': HIND_TUCK[0], 'bend': HIND_TUCK[1]}
    P['tail_rest'] = tail

def settle(t, D):
    """Lying down takes a cat about a second and a half: front folds, the torso arrives with a small overshoot, the
    hindquarters tuck, the tail lies down last."""
    P = base()
    apply_rest(P, ease(t, .12, 1.0), min(1, ease_back(t, .3, 1.25, 1.1)), ease(t, .5, 1.45), ease(t, .65, 1.6), ease_out(t, .4, 1.3))
    P['head']['pitch'] = .10 * ease_out(t, .4, 1.3)
    P['bob'] += -.006 * pulse(t, .25, .8)  # a quick dip as the front end folds
    return P

def sleep(t, D):
    P = base(); apply_rest(P, 1, 1, 1, 1, 1)
    droop = (1 - math.cos(math.tau * t / D)) / 2
    P['bob'] = .002 * math.sin(math.tau * t / (D / 2))
    P['head']['pitch'] = .10 + .06 * droop; P['head']['roll'] = .03 * droop
    for side in 'LR': P['ears'][side][0] = .08 * droop
    P['tail_wave'][5] = .004 * math.sin(math.tau * t / D); P['tail_wave'][4] = .002 * math.sin(math.tau * t / D)
    return P

def wake(t, D):
    """Quick wake: the head comes up first with a small shake, the front pushes up, the hindquarters follow."""
    P = base()
    apply_rest(P, 1 - ease_out(t, .3, 1.1), 1 - ease(t, .35, 1.2), 1 - ease(t, .5, 1.4), 1 - ease(t, .6, 1.5), 1 - ease_out(t, 0, .45))
    P['head']['pitch'] = .10 * (1 - ease_out(t, 0, .45)) - .06 * pulse(t, .15, .5)
    shake = pulse(t, .45, .5)
    P['head']['yaw'] += .14 * math.sin(math.tau * (t - .45) / .25) * shake; P['head']['roll'] += .06 * math.sin(math.tau * (t - .45) / .25) * shake
    for side in 'LR': P['ears'][side][0] += .3 * shake
    P['bob'] += .004 * pulse(t, .6, .6)
    return P

def happy(t, D):
    P = base(); w = math.tau * t / D
    P['head']['yaw'] = .10 * math.sin(2 * w); P['head']['pitch'] = -.10 + .05 * math.sin(2 * w); P['head']['roll'] = .18 * math.sin(w)
    P['head_lift'] = .006; P['push'] = -.006; P['roll']['Chest'] = .02 * math.sin(w)
    P['ears']['L'] = [.16, .05]; P['ears']['R'] = [.16, -.05]
    P['tail_lift'] = .95
    for i in range(6):
        k = i / 5; P['tail_wave'][i] = math.sin(2 * w - i * .45) * .02 * k
    return P

SIT_FRONT_BACK = .035  # the forepaws step in under the chest as the rear comes down
def apply_sit(P, hind, torso, tail, front=None):
    """Upright sit: rear lowered onto tucked hind legs, front legs straight, tail on the floor. Nothing is quite
    symmetrical: one forepaw a little ahead of the other, the head a touch off axis."""
    if front is None: front = torso
    for n in TORSO: P['drop'][n] = SIT_DROP[n] * torso
    P['hind'] = {'amount': hind, 'target': HIND_SIT[0], 'bend': HIND_SIT[1]}
    P['tail_rest'] = tail
    P['head']['pitch'] += -.04 * torso
    P['legs'][('Front', 'L')]['dy'] += SIT_FRONT_BACK * front; P['legs'][('Front', 'R')]['dy'] += (SIT_FRONT_BACK - .012) * front
    P['head']['yaw'] += .05 * torso; P['head']['roll'] += .03 * torso

def sit(t, D):
    """Down in under a second: the weight rocks back with a small nod, the rear folds, the forepaws step in, the
    tail lies down last."""
    P = base(); apply_sit(P, ease_out(t, .08, .55, 2.2), min(1, ease_back(t, .12, .72, 1.15)), ease(t, .4, .9), ease(t, .3, .8))
    P['push'] += .014 * pulse(t, .0, .5)
    P['head']['pitch'] += .06 * pulse(t, .1, .5)
    return P

def sitidle(t, D):
    P = base(); apply_sit(P, 1, 1, 1); look_around(P, t, D, scale=.6)
    P['tail_wave'][5] += .012 * pulse(t, .45 * D, .6) + .008 * pulse(t, .9 * D, .5)
    return P

def sitarch(t, D):
    """Stroked along the back while seated: the back rounds up into the hand, the head dips, the tail lifts."""
    P = base(); apply_sit(P, 1, 1, 1); a = ease(t, .1, .55) * (1 - ease(t, 1.1, 1.6))
    P['drop']['Spine'] += -.03 * a; P['drop']['Chest'] += -.018 * a; P['drop']['Pelvis'] += -.01 * a
    P['head']['pitch'] += .22 * a; P['head_lift'] += -.006 * a
    P['tail_rest'] = 1 - .6 * a; P['tail_lift'] = .5 * a
    for side in 'LR': P['ears'][side][0] += .14 * a
    return P

# ---------------------------------------------------------------- jumps with root motion
# The Root bone carries the trajectory (JUMP_UP: 1.95 m up and 1.03 m forward onto the claw cabinet, JUMP_DOWN the
# reverse from the lying spot to the floor in front). The runtime strips the Root track, replays the curve on the
# body and warps it to the actual take-off and landing points, so the pose and the flight can never disagree.
JUMP_UP = (.63, 1.95)
JUMP_DOWN = (.63, 1.95)
G = 9.81

def jumpup(t, D):
    """Onto the ledge, the way a cat does it: sit back and stare at the spot, load the hindquarters, launch almost
    straight up on a real parabola from 38 cm in front of the cabinet, hook the lip with the forepaws just short of
    the top, haul the chest up and over while the hind legs scramble, then a soft landing crouch. Timings: crouch
    .08-.40, launch .40-.46, flight .46-.98 (hook), pull-up .98-1.30, land 1.30-1.65. Every key uses `curve()`, so
    the flight has no zero-velocity hitches; the old smoothstep tracks rose like a lift and slid forward at the top."""
    P = base()
    T0, TH, TP, TL = .46, .98, 1.30, 1.65
    HOOK_Y, HOOK_Z, OVER_Y = 1.62, .08, 2.10  # body origin at the hook (36 cm below the top, still 30 cm out) and over the lip
    flight = TH - T0; tau = max(0., min(flight, t - T0))
    vy = (HOOK_Y + .5 * G * flight * flight) / flight  # ≈ 5.7 m/s, still rising a little at the hook
    if t < TH:
        up = vy * tau - .5 * G * tau * tau; forward = HOOK_Z * tau / flight
    else:
        up = curve(t, [(TH, HOOK_Y), (TP, OVER_Y, 'out'), (TL - .12, JUMP_UP[1], 'smooth')])
        forward = curve(t, [(TH, HOOK_Z), (TP - .06, .18, 'in'), (TL - .15, JUMP_UP[0], 'out')])
    P['root_move'] = V((0, -forward, up))
    # Sit back and load, pitch nose-up through the launch and the rise, level out at the hook, over the edge in the pull-up.
    load = curve(t, [(.08, 0), (.30, 1, 'smooth'), (.40, 1.05), (T0, .2, 'snap'), (.7, 0)])
    for n, d in (('Pelvis', .09), ('Spine', .075), ('Chest', .05), ('Neck', .02), ('Head', .01)): P['drop'][n] = d * load
    P['push'] = curve(t, [(.05, 0), (.30, .025), (T0, -.03, 'snap'), (.8, -.01), (TH, 0)])
    # The nose-up pitch only starts once the hind paws have left the floor (it rotates about the chest, so an early
    # pitch would push the rear through the ground).
    P['body_pitch'] = curve(t, [(.2, 0), (.38, .06), (T0, .02), (T0 + .09, -.55, 'snap'), (.75, -.62), (TH, -.55), (TP, .25, 'smooth'), (TL - .1, 0, 'out')])
    P['head']['pitch'] = curve(t, [(0, 0), (.14, -.32, 'out'), (.36, -.26), (T0, -.05), (.8, .10), (TH, .25), (TP, .30), (TL - .2, .05), (TL, 0)])
    land = curve(t, [(TP - .02, 0), (TP + .12, 1, 'out'), (TL, 0, 'back')])
    for n, d in (('Pelvis', .05), ('Spine', .045), ('Chest', .04), ('Neck', .015)): P['drop'][n] += d * land
    for side in 'LR':
        P['ears'][side][0] = curve(t, [(.3, 0), (T0, .15), (.85, .05), (TH, .12), (TP, .18), (TL, 0)])
        F, H = P['legs'][('Front', side)], P['legs'][('Hind', side)]
        # Forepaws fold at launch, reach forward-up, hook the lip, then hold it while the body rises to meet them.
        # (the body's own nose-up pitch already carries the paws upward, so the reach here is mostly forward)
        F['dy'] = curve(t, [(T0 - .02, 0), (T0 + .1, -.05), (.8, -.15), (TH, -.20), (TP, -.10), (TL - .15, 0, 'out')])
        F['dz'] = curve(t, [(T0 - .02, 0), (T0 + .1, .06), (.8, .12), (TH, .16), (TP, .02, 'out'), (TL - .15, 0)])
        F['pitch'] = curve(t, [(T0, 0), (T0 + .15, .5), (.85, .25), (TH, -.35), (TP, -.1), (TL - .2, 0)])
        # Hind legs drive, trail, then scramble up over the lip.
        H['dy'] = curve(t, [(.36, 0), (T0 + .08, .13), (.85, .10), (TH, .08), (TP - .05, .04), (TL - .2, 0)])
        H['dz'] = curve(t, [(.36, 0), (T0 + .04, 0), (.7, .12), (TH, .10), (TP - .10, .14, 'smooth'), (TP + .06, .02, 'out'), (TL - .2, 0)])
        H['pitch'] = curve(t, [(T0, 0), (T0 + .1, .3), (TH, .1), (TL - .2, 0)])
    P['tail_back'] = curve(t, [(.3, 0), (T0 + .1, .9, 'out'), (TH, .8), (TP, .5), (TL, 0, 'out')])
    P['tail_lift'] = curve(t, [(0, 0), (.3, .3), (T0, 0)])
    return P

def jumpdown(t, D):
    """Off the ledge: peer down, gather, hop off with a little forward push, fall under gravity nose-down, the
    forelimbs take the landing with a deep crouch, the hind paws follow, up and away. Timings: peer 0-.30, push
    .30-.42, flight .42-1.10, landing crouch 1.10-1.45."""
    P = base()
    T0, TL, TE = .42, 1.10, 1.45
    flight = TL - T0; tau = max(0., min(flight, t - T0))
    hop = .35  # m/s upward at the push-off
    fall = -(hop * tau - .5 * G * tau * tau); fall_end = -(hop * flight - .5 * G * flight * flight)
    # The forepaws touch down with the body still 12 cm up and pitched nose-down; the last 12 cm are the legs
    # flexing under it, not gravity (a body that reached the floor with the legs extended put the paws through it).
    CONTACT = JUMP_DOWN[1] - .12
    down = CONTACT * fall / fall_end if t >= T0 else 0.
    if t >= TL: down = curve(t, [(TL, CONTACT), (TL + .12, JUMP_DOWN[1], 'out')])
    forward = curve(t, [(T0 - .06, 0), (T0, .02), (TL, .58, 'smooth'), (TE - .15, JUMP_DOWN[0], 'out')])
    P['root_move'] = V((0, -forward, -down))
    P['head']['pitch'] = curve(t, [(0, 0), (.16, .38, 'out'), (T0, .30), (.8, .45), (TL, .40), (TL + .1, .25), (TE, 0, 'out')])
    gather = curve(t, [(.05, 0), (.30, .8, 'smooth'), (T0, .3, 'snap'), (T0 + .1, 0)])
    for n, d in (('Pelvis', .05), ('Spine', .06), ('Chest', .06), ('Neck', .03), ('Head', .015)): P['drop'][n] = d * gather
    # Forelimbs first: the deep crouch peaks 0.1 s after contact, the hindquarters land and fold a beat later.
    land_f = curve(t, [(TL - .02, 0), (TL + .10, 1, 'out'), (TE, 0, 'back')])
    land_h = curve(t, [(TL + .04, 0), (TL + .16, 1, 'out'), (TE + .05, 0, 'back')])
    P['drop']['Chest'] += .09 * land_f; P['drop']['Neck'] += .05 * land_f; P['drop']['Head'] += .02 * land_f
    P['drop']['Spine'] += .06 * (.5 * land_f + .5 * land_h); P['drop']['Pelvis'] += .05 * land_h
    P['push'] = curve(t, [(.1, 0), (.30, -.02), (T0, -.04, 'snap'), (.7, 0)])
    P['body_pitch'] = curve(t, [(T0 - .1, 0), (T0 + .15, .30), (.85, .50), (TL, .55), (TL + .12, .15, 'out'), (TE, 0, 'out')])
    for side in 'LR':
        P['ears'][side][0] = curve(t, [(.3, 0), (T0, .1), (.9, .14), (TE, 0)])
        F, H = P['legs'][('Front', side)], P['legs'][('Hind', side)]
        F['dy'] = curve(t, [(T0 - .05, 0), (T0 + .1, -.08), (.9, -.10), (TL, -.06), (TE, 0, 'out')])
        F['dz'] = curve(t, [(T0 - .05, 0), (T0 + .15, -.03), (.9, -.09), (TL - .02, -.10), (TL + .10, .07, 'out'), (TE, 0)])
        F['pitch'] = curve(t, [(T0, 0), (.6, -.3), (TL, -.15), (TL + .1, .1), (TE, 0)])
        H['dy'] = curve(t, [(T0 - .05, 0), (T0 + .1, .06), (.9, .08), (TL + .04, .05), (TE, 0, 'out')])
        H['dz'] = curve(t, [(T0 - .08, 0), (T0 + .05, 0), (.65, .10), (TL, .11), (TL + .06, .0), (TE, 0)])
    P['tail_back'] = curve(t, [(.3, 0), (T0 + .1, .8), (.9, .9), (TL + .1, .3), (TE, 0, 'out')])
    return P

# ---------------------------------------------------------------- touch reactions
def arch(t, D):
    """Stroked along the back: the spine arches up, the hindquarters rise, the tail goes up, the head dips."""
    P = base(); a = ease(t, .15, .8) * (1 - ease(t, 1.7, 2.5))
    P['drop']['Pelvis'] = -.035 * a; P['drop']['Spine'] = -.04 * a; P['drop']['Chest'] = -.012 * a
    P['head']['pitch'] = .14 * a; P['head_lift'] = -.004 * a; P['push'] = .01 * a
    P['tail_lift'] = a
    for i in range(6):
        k = i / 5; P['tail_wave'][i] = math.sin(math.tau * 1.5 * t / D - i * .4) * .012 * k * a
    for side in 'LR': P['ears'][side][0] = .10 * a
    return P

def flick(t, D):
    """Tail touched: the tail lashes, the ears go back, a glance over the shoulder, a small flinch. Played additively."""
    P = base(); on = ease(t, 0, .12) * (1 - ease(t, 1.1, 1.7))
    lash = math.sin(math.tau * 1.4 * t) * on
    for i in range(6):
        k = i / 5; P['tail_wave'][i] = lash * .06 * k ** 1.3
    P['tail_lift'] = .35 * ease(t, 0, .15) * (1 - ease(t, 1.2, 1.8))
    for side in 'LR': P['ears'][side][0] = .35 * ease(t, .02, .15) * (1 - ease(t, 1.0, 1.6))
    look = ease(t, .05, .35) * (1 - ease(t, .9, 1.4))
    P['head']['yaw'] = .5 * look; P['head']['pitch'] = .05 * look; P['head']['roll'] = .08 * look
    P['bob'] = -.008 * pulse(t, .05, .4); P['sway'] = .006 * pulse(t, .05, .5)
    return P

def jump(t, D):
    """In place: crouch (0-.30), launch (.30-.42), airborne (.42-1.10), land (1.10-1.40)."""
    P = base()
    crouch = track(t, [(0, 0), (.30, .07), (.42, -.03), (.60, -.02), (1.10, -.01), (1.22, .05), (1.40, 0)])
    for n in TORSO: P['drop'][n] = crouch * (1 if n in ('Pelvis', 'Spine', 'Chest') else .6)
    P['head']['pitch'] = track(t, [(.25, 0), (.42, -.25), (.75, -.10), (1.10, .12), (1.40, 0)])
    for side in 'LR':
        P['ears'][side][0] = track(t, [(0, 0), (.30, .14), (.45, .05), (1.10, .12), (1.40, 0)])
        F, H = P['legs'][('Front', side)], P['legs'][('Hind', side)]
        F['dy'] = track(t, [(.30, 0), (.42, -.04), (.60, -.10), (1.05, -.09), (1.18, 0)])
        F['dz'] = track(t, [(.30, 0), (.42, .08), (.60, .06), (1.05, .04), (1.18, 0)])
        F['pitch'] = track(t, [(.30, 0), (.42, .5), (.70, .2), (1.05, -.1), (1.18, 0)])
        H['dy'] = track(t, [(.28, 0), (.42, .11), (.60, .09), (1.05, .08), (1.30, 0)])
        H['dz'] = track(t, [(.28, 0), (.45, .00), (.60, .06), (1.05, .05), (1.30, 0)])
    P['tail_back'] = track(t, [(.30, 0), (.55, .9), (1.10, .8), (1.40, 0)])
    P['tail_lift'] = track(t, [(0, 0), (.30, .25), (.55, 0)])
    return P

def apply_perch(P, front, torso, hind, tail, head):
    apply_rest(P, 0, torso, hind, tail, head)
    P['front'] = {'amount': front, 'target': FRONT_HANG[0], 'bend': FRONT_HANG[1]}
    P['push'] += -.012 * torso  # shoulders protract towards the lip once the chest is down
    for side in 'LR':
        L, H = P['legs'][('Front', side)], HANG_SIDE[side]
        L['dy'] += H['dy'] * front; L['dz'] += H['dz'] * front; L['pitch'] += H['pitch'] * front
    P['head']['pitch'] += .06 * head; P['head_lift'] += .01 * head

def perch(t, D):
    # Chest first, then the elbows slide to the lip and the wrists drop over it; the neck relaxes
    # after the chest has settled and the tail finishes last.
    P = base(); apply_perch(P, ease(t, .5, 1.7), ease(t, .1, 1.3), ease(t, .4, 1.9), ease(t, 1.1, 2.0), ease(t, .9, 2.0)); return P

def perchidle(t, D):
    P = base(); apply_perch(P, 1, 1, 1, 1, 1); w = math.tau * t / D
    P['bob'] = .0016 * math.sin(math.tau * t / (D / 3))
    P['head']['yaw'] += .06 * math.sin(w); P['head']['pitch'] += .03 * math.sin(2 * w); P['head']['roll'] += .02 * math.sin(w)
    P['ears']['L'][0] += .35 * pulse(t, .43 * D, .3); P['ears']['R'][0] += .35 * pulse(t, .82 * D, .3)
    P['legs'][('Front', 'L')]['dz'] += .012 * pulse(t, .23 * D, .5); P['legs'][('Front', 'R')]['dy'] += -.008 * pulse(t, .62 * D, .6)
    P['tail_wave'][5] += .010 * math.sin(2 * w); P['tail_wave'][4] += .005 * math.sin(2 * w)
    return P

def stand(t, D):
    """Up from the sit: weight rocks forward, the hind legs push, the rear rises, the tail lifts off last."""
    P = base(); apply_sit(P, 1 - ease(t, .1, .62), 1 - ease(t, .18, .75), 1 - ease(t, .35, .85), 1 - ease(t, .25, .8))
    P['push'] += -.012 * pulse(t, .03, .65); P['head_lift'] += .006 * pulse(t, .12, .6)
    P['head']['pitch'] += -.05 * pulse(t, .06, .55)
    for side in 'LR': P['ears'][side][0] += .06 * pulse(t, .06, .5)
    return P

def unperch(t, D):
    """Off the ledge: one front paw after the other comes back onto the top, the chest lifts, then the hindquarters."""
    P = base()
    front_l, front_r = 1 - ease(t, .1, .75), 1 - ease(t, .35, 1.0)
    apply_perch(P, 1, 1 - ease(t, .45, 1.35), 1 - ease(t, .7, 1.55), 1 - ease(t, .55, 1.45), 1 - ease(t, .2, .95))
    P['front_side'] = {'L': front_l, 'R': front_r}
    for side, amount in (('L', front_l), ('R', front_r)):
        L, H = P['legs'][('Front', side)], HANG_SIDE[side]
        L['pitch'] += H['pitch'] * (amount - 1)  # the curl follows its own paw, not the shared amount
        L['dz'] += .025 * pulse(t, .1 if side == 'L' else .35, .65)  # lift over the lip
    P['head']['pitch'] += -.06 * pulse(t, .05, .8); P['head_lift'] += .008 * pulse(t, .1, .9)
    return P

# ---------------------------------------------------------------- turning in place
# Explicit choreography instead of a schedule: the body only rotates while a diagonal pair of paws is in the
# air, in two (45°) or four (90°) distinct steps with a pause between them, so the turn reads as stepping
# around rather than as a turntable. Authored in the turning frame: planted paws keep their world position,
# the Root bone carries the yaw, the runtime strips it and rotates the body by the same curve.
PIVOT = V((0, -.03, 0))
# A cat turns in one motion: the head goes first, the body follows in a single decelerating sweep (about 0.4 s for
# 45°, 0.6 s for 90°) and two or three quick diagonal steps reposition the paws while it happens. The old version
# (four equal beats with full stops between them and a dead half second at the end) measured 2.1 s for 90° and
# read as a turntable that ticks.
TURN_LEAD, TURN_SETTLE = .10, .12
TURN_LIFT = {'Front': .05, 'Hind': .04}

def turn_plan(theta, sign):
    """A sweep length and a list of steps (start, end, pair, lead). `lead` is how far past the body's yaw at the
    moment of landing the paw is set down, so the last step leaves every paw squared up to the new heading."""
    big = theta >= math.radians(60)
    sweep = .62 if big else .42
    inner, outer = ('L', 'R') if sign > 0 else ('R', 'L')
    A = [('Front', inner), ('Hind', outer)]; B = [('Front', outer), ('Hind', inner)]
    steps = [(TURN_LEAD + .02, TURN_LEAD + .24, A, .10), (TURN_LEAD + .20, TURN_LEAD + .42, B, .12 if big else .10)]
    if big: steps.append((TURN_LEAD + .40, TURN_LEAD + .62, A, 0.))
    steps = [(s * jitter(i * 7 + 3, .05), min(e * jitter(i * 7 + 5, .05), TURN_LEAD + sweep), pair, lead) for i, (s, e, pair, lead) in enumerate(steps)]
    return {'sweep': sweep, 'steps': steps}, TURN_LEAD + sweep + TURN_SETTLE

def turn_yaw(t, plan, theta):
    u = clamp((t - TURN_LEAD) / plan['sweep'])
    return theta * smooth(u ** .85)  # launches quickly, settles slowly

def turn_paw(t, plan, foot, theta):
    """World angle, lift and pitch of one paw: planted until its step, then swung to a spot a little ahead of the body."""
    angle = 0.
    for start, stop, pair, lead in plan['steps']:
        if foot not in pair: continue
        landing = min(theta, turn_yaw(stop, plan, theta) + theta * lead)
        if t >= stop: angle = landing
        elif t >= start:
            u = (t - start) / (stop - start)
            return angle + (landing - angle) * (1 - (1 - u) ** 2.4), math.sin(math.pi * u ** .9), .5 * math.sin(math.pi * u) * (1 - u) ** .5
    return angle, 0., 0.

def turn(t, D, theta, sign, plan):
    P = base(); y = turn_yaw(t, plan, theta); P['root_yaw'] = sign * y
    u = clamp(t / D); arc = math.sin(math.pi * u)
    scale = theta / (math.pi / 2)
    # Eyes and head go first, the spine bends into a C behind them and unwinds as the body catches up.
    lead = curve(t, [(0, 0), (.12, .55, 'snap'), (TURN_LEAD + plan['sweep'] * .55, .22), (D - .05, 0, 'out')]) * sign * scale
    P['head']['yaw'] = lead * .6
    P['bend']['Neck'] = lead * .22; P['bend']['Chest'] = lead * .38; P['bend']['Spine'] = lead * .28
    P['head']['roll'] = sign * .05 * arc; P['head']['pitch'] = -.04 * ease_out(t, 0, .2) * (1 - ease(t, D - .3, D))
    P['yaw']['Pelvis'] = -sign * .05 * arc
    P['roll']['Chest'] = -sign * .07 * arc
    inner = 'L' if sign > 0 else 'R'
    P['ears'][inner][1] += sign * .14 * arc; P['ears'][inner][0] += .06 * arc
    for side in 'LR': P['ears'][side][0] += .10 * ease_out(t, 0, .15) * (1 - ease(t, .25, .6))
    P['tail_lift'] = .2 * arc
    for i in range(6):
        k = i / 5
        P['tail_wave'][i] += -sign * .08 * k ** 1.4 * math.sin(math.pi * clamp((t - .05) / (D - .1))) + sign * .02 * k * k * pulse(t, .55 * D, .35)
        P['tail_lift_wave'][i] += .01 * k * pulse(t, .3 * D, .4)
    # Weight rocks onto the planted diagonal while a pair swings, and the body dips as it lands.
    for k, (start, stop, pair, lead_) in enumerate(plan['steps']):
        swing = pulse(t, start, stop - start)
        P['bob'] += -.005 * swing - .006 * pulse(t, stop - .04, .16)
        P['sway'] += (sign if k % 2 == 0 else -sign) * .012 * swing
        P['roll']['Pelvis'] += (1 if k % 2 == 0 else -1) * sign * .035 * swing
    for leg in ('Front', 'Hind'):
        for side in 'LR':
            paw = f'{leg}Paw.{side}'
            a, lift, pitch = turn_paw(t, plan, (leg, side), theta)
            rel = heads[paw] - PIVOT
            pos = PIVOT + Matrix.Rotation(sign * (a - y), 4, 'Z') @ rel + V((0, 0, TURN_LIFT[leg] * lift))
            outward = pos - PIVOT; outward.z = 0; outward = outward.normalized() * .02 * lift
            pos = pos + outward
            L = P['legs'][(leg, side)]; L['dx'], L['dy'], L['dz'], L['pitch'] = (pos - heads[paw]).x, (pos - heads[paw]).y, (pos - heads[paw]).z, pitch
            L['root_dz'] = (.012 if leg == 'Front' else .008) * lift
    return P

TURNS = []
for degrees in (45, 90):
    for side, sign in (('L', 1), ('R', -1)):
        theta = math.radians(degrees); plan, D = turn_plan(theta, sign)
        TURNS.append((f'turn{side}{degrees}', round(D, 2), (lambda th, sg, pl: lambda t, D: turn(t, D, th, sg, pl))(theta, sign, plan)))

CLIPS = [('idle', 8.0, idle), ('walk', WALK_CYCLE, walk), ('trot', TROT_CYCLE, trot), ('settle', 1.6, settle), ('sleep', 6.0, sleep), ('wake', 1.5, wake), ('happy', 4.0, happy),
         ('sit', .9, sit), ('sitidle', 6.0, sitidle), ('sitarch', 1.6, sitarch), ('stand', .9, stand), ('jumpup', 1.7, jumpup), ('jumpdown', 1.5, jumpdown), ('perch', 2.0, perch), ('perchidle', 6.0, perchidle), ('arch', 2.6, arch), ('flick', 1.8, flick),
         ('unperch', 1.6, unperch)] + TURNS

# ---------------------------------------------------------------- floor contact correctives
# Pose-space morphs lift whatever the folded pose pushes below the surface: the sphinx rest,
# the upright sit and the ledge perch (where the hanging front legs are meant to be below it).
for key in ('BlueGround', 'BlueSit', 'BluePerch'):
    if key in mesh.data.shape_keys.key_blocks: mesh.shape_key_remove(mesh.data.shape_keys.key_blocks[key])
groups = {g.index: g.name for g in mesh.vertex_groups}
FRONT_LEG = {f'Front{part}.{side}' for part in ('Upper', 'Lower', 'Paw') for side in 'LR'}
# The face never touches the surface in these poses; excluding it guarantees a corrective can never move the eyes.
FACE = {'Head', 'Neck', 'Ear.L', 'Ear.R'}
lifted = {}
# shape_key_add copies the current mix unless told otherwise; v2 correctives silently carried the full blink
# displacement (15 mm on every eye vertex) and each other's lifts, which is what deformed the eyes at rest.
for block in mesh.data.shape_keys.key_blocks: block.value = 0.
for key, pose, skip in (('BlueGround', sleep(0, 6.0), FACE), ('BlueSit', sitidle(0, 6.0), FACE), ('BluePerch', perchidle(0, 6.0), FRONT_LEG | FACE)):
    corrective = mesh.shape_key_add(name=key, from_mix=False)
    mats = solve(pose)
    skin = {n: mats[n] @ rest[n].inverted() for n in names}
    lifted[key] = 0
    for v, cv in zip(mesh.data.vertices, corrective.data):
        if sum(g.weight for g in v.groups if groups[g.group] in skip) > .5: continue
        # Same rule as the armature modifier: whatever weight is missing keeps the vertex at rest.
        total = sum(g.weight for g in v.groups)
        matrix = Matrix.Identity(4) * (1 - total)
        for g in v.groups: matrix += skin[groups[g.group]] * g.weight
        posed = matrix @ v.co
        if posed.z < .002:
            cv.co += matrix.to_3x3().inverted_safe() @ V((0, 0, .002 - posed.z)); lifted[key] += 1

# ---------------------------------------------------------------- bake clips
arm.animation_data_create()
actions = []
for label, duration, fn in CLIPS:
    action = bpy.data.actions.new(label); arm.animation_data.action = action
    frames = round(duration * FPS)
    for frame in range(frames + 1):
        mats = solve(fn(frame / FPS, duration))
        for n, pb in arm.pose.bones.items():
            parent = parents[n]
            basis = rest[n].inverted() @ (rest[parent] @ mats[parent].inverted() if parent else Matrix.Identity(4)) @ mats[n]
            pb.rotation_mode = 'QUATERNION'; pb.matrix_basis = basis
            pb.keyframe_insert('location', frame=frame); pb.keyframe_insert('rotation_quaternion', frame=frame)
    action.use_fake_user = True; actions.append(action)
arm.animation_data.action = None
for a in actions:
    track_ = arm.animation_data.nla_tracks.new(); track_.name = a.name
    track_.strips.new(a.name, 0, a); track_.mute = True
for pb in arm.pose.bones: pb.matrix_basis = Matrix.Identity(4)

# ---------------------------------------------------------------- coat cleanup
# The Meshy atlas carries streaky fur highlights and warm specks. Replace the dark coat
# with a smoothed, neutral satin black while keeping the eyes and the inner ears.
src = bpy.data.images['Image_0']
W = src.size[0]
px = np.empty(W * W * 4, dtype=np.float32); src.pixels.foreach_get(px)
img = px.reshape(W, W, 4)[:, :, :3]
S = 1024; f = W // S
img = img.reshape(S, f, S, f, 3).mean(axis=(1, 3))
lum = img @ np.array([.2126, .7152, .0722], dtype=np.float32)
sat = img.max(axis=2) - img.min(axis=2)
def sstep(x, a, b):
    t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)
def blur(a, radius):
    pad = np.pad(a, ((radius, radius), (radius, radius)) + ((0, 0),) * (a.ndim - 2), mode='edge')
    cs = np.cumsum(pad, axis=0); a = (cs[2 * radius:] - cs[:-2 * radius]) / (2 * radius)
    cs = np.cumsum(a, axis=1); return (cs[:, 2 * radius:] - cs[:, :-2 * radius]) / (2 * radius)
# The atlas is fragmented, so the amber eyes are found through the UVs of the eye polygons rather than by colour;
# baked highlight specks elsewhere would otherwise survive any colour threshold and glint under the hall lights.
uv_layer = mesh.data.uv_layers.active.data
yy, xx = np.mgrid[0:S, 0:S]
def rasterize(select):
    mask = np.zeros((S, S), dtype=np.float32)
    for polygon in mesh.data.polygons:
        if not select(polygon): continue
        pts = [np.array(uv_layer[l].uv, dtype=np.float64) * S for l in polygon.loop_indices]
        for i in range(1, len(pts) - 1):
            a, b, c = pts[0], pts[i], pts[i + 1]
            x0, x1 = int(max(0, min(a[0], b[0], c[0]) - 2)), int(min(S - 1, max(a[0], b[0], c[0]) + 2))
            y0, y1 = int(max(0, min(a[1], b[1], c[1]) - 2)), int(min(S - 1, max(a[1], b[1], c[1]) + 2))
            px = xx[y0:y1 + 1, x0:x1 + 1] + .5; py = yy[y0:y1 + 1, x0:x1 + 1] + .5
            edge = lambda p, q: (q[0] - p[0]) * (py - p[1]) - (q[1] - p[1]) * (px - p[0])
            e0, e1, e2 = edge(a, b), edge(b, c), edge(c, a)
            inside = ((e0 >= 0) & (e1 >= 0) & (e2 >= 0)) | ((e0 <= 0) & (e1 <= 0) & (e2 <= 0))
            mask[y0:y1 + 1, x0:x1 + 1] = np.maximum(mask[y0:y1 + 1, x0:x1 + 1], inside)
    # No dilation: atlas polygons are only a few texels wide, so any margin paints the neighbouring island.
    return mask
eye = rasterize(lambda polygon: polygon.material_index == 1)
# Cap the eye texels so the white catchlight cannot bleed into adjacent islands at coarse mip levels;
# the glossy eye material provides the real reflection at runtime.
eye_scale = np.where(eye > 0, np.minimum(1, .5 / np.maximum(lum, 1e-4)), 1)[:, :, None]
img = img * eye_scale
# Ear interiors: forward-facing polygons weighted to the ear bones. Only their pink survives; warm fur
# highlights elsewhere in the atlas are the specks that glinted on the face and chest.
ear_groups = {mesh.vertex_groups['Ear.L'].index, mesh.vertex_groups['Ear.R'].index}
def ear_weight(v): return sum(g.weight for g in v.groups if g.group in ear_groups)
inner_ear = rasterize(lambda polygon: polygon.normal.y < -.15 and sum(ear_weight(mesh.data.vertices[i]) for i in polygon.vertices) / len(polygon.vertices) > .5)
pink = (img[:, :, 0] > img[:, :, 2] + .06) & (img[:, :, 0] > img[:, :, 1]) & (lum > .16) & (sat > .08)
keep = inner_ear * pink  # the eye islands go black: the eyes are separate eyeball meshes now
coat = 1 - keep
m3 = coat[:, :, None]
# The coat is one even, deep, slightly cool black. Any trace of the Meshy atlas (its island blotches and warm
# specks) read as dirt on a black cat; the fur structure comes from the runtime's tiled grain normal and the
# velvet sheen, not from the albedo.
flat = np.array([.040, .037, .046], dtype=np.float32)
clean = img * (1 - m3) + flat[None, None, :] * m3
out = np.ones((S, S, 4), dtype=np.float32); out[:, :, :3] = np.clip(clean, 0, 1)
cleaned = bpy.data.images.new('BlueCoatClean', S, S, alpha=False)
cleaned.pixels.foreach_set(out.ravel()); cleaned.pack()
cleaned.filepath_raw = str(WORK / 'blue-coat-clean.png'); cleaned.file_format = 'PNG'; cleaned.save()
for mat in mesh.data.materials:
    for node in mat.node_tree.nodes:
        if node.type == 'TEX_IMAGE' and node.image == src: node.image = cleaned
# The Meshy normal map is noise on the black body (sparkle under the hall's rect lights); the runtime tiles its
# own fine fur-grain normal there. The face keeps the sculpted nose, mouth and brow through a cleaned copy.
for mat in mesh.data.materials:
    for link in list(mat.node_tree.links):
        if link.to_socket.name == 'Normal' and link.to_node.type == 'BSDF_PRINCIPLED': mat.node_tree.links.remove(link)
    for node in [n for n in mat.node_tree.nodes if n.type == 'NORMAL_MAP' or (n.type == 'TEX_IMAGE' and n.image and n.image.name == 'Image_2')]:
        mat.node_tree.nodes.remove(node)

# ---------------------------------------------------------------- face material
# Polygons weighted to head, neck and ears get their own material with a denoised, softened copy of the Meshy
# normal map at 2048², so the sculpted face detail survives without the body's speck noise.
group_index = {g.name: g.index for g in mesh.vertex_groups}
FACE_GROUPS = {group_index[n] for n in ('Head', 'Neck', 'Ear.L', 'Ear.R') if n in group_index}
def dominant_group(v):
    g = max(v.groups, key=lambda g: g.weight, default=None); return g.group if g else -1
nsrc = bpy.data.images['Image_2']; NW = nsrc.size[0]
npx = np.empty(NW * NW * 4, dtype=np.float32); nsrc.pixels.foreach_get(npx)
NS = 2048; nf = max(1, NW // NS)
nimg = npx.reshape(NW, NW, 4)[:, :, :3].reshape(NS, nf, NS, nf, 3).mean(axis=(1, 3))
u8 = (np.clip(nimg, 0, 1) * 255).astype(np.uint8)
median = np.median(np.stack([np.roll(np.roll(u8, dy, 0), dx, 1) for dy in (-1, 0, 1) for dx in (-1, 0, 1)]), axis=0).astype(np.float32) / 255
flat_normal = np.array([.5, .5, 1.], dtype=np.float32)
face_n = np.ones((NS, NS, 4), dtype=np.float32); face_n[:, :, :3] = np.clip(flat_normal + (median - flat_normal) * .7, 0, 1)
face_normal = bpy.data.images.new('BlueFaceNormal', NS, NS, alpha=False); face_normal.colorspace_settings.name = 'Non-Color'
face_normal.pixels.foreach_set(face_n.ravel()); face_normal.pack()
face_normal.filepath_raw = str(WORK / 'blue-face-normal.png'); face_normal.file_format = 'PNG'; face_normal.save()
face_material = mesh.data.materials[0].copy(); face_material.name = 'Blue face'
tree = face_material.node_tree; bsdf = tree.nodes['Principled BSDF']
tex = tree.nodes.new('ShaderNodeTexImage'); tex.image = face_normal
nmap = tree.nodes.new('ShaderNodeNormalMap'); nmap.inputs['Strength'].default_value = 1.0
tree.links.new(tex.outputs['Color'], nmap.inputs['Color']); tree.links.new(nmap.outputs['Normal'], bsdf.inputs['Normal'])
# Eye islands are measured before they are folded into the face material.
eye_islands = {}
for side, sign in (('L', 1), ('R', -1)):
    polys = [p for p in mesh.data.polygons if p.material_index == 1 and p.center.x * sign > 0]
    verts = {i for p in polys for i in p.vertices}
    centre = sum((mesh.data.vertices[i].co for i in verts), Vector()) / len(verts)
    normal = sum((p.normal * p.area for p in polys), Vector()).normalized()
    eye_islands[side] = (centre, normal)
    # The middle of the old eye island becomes the socket floor; its outer ring stays as the eyelids that frame the eye.
    for i in verts:
        v = mesh.data.vertices[i]; d = (v.co - centre).length
        v.co -= v.normal * .0035 * (1 - smooth((d - .009) / .006))
mesh.data.materials.append(face_material); face_index = len(mesh.data.materials) - 1
for polygon in mesh.data.polygons:
    votes = sum(1 for i in polygon.vertices if dominant_group(mesh.data.vertices[i]) in FACE_GROUPS)
    if polygon.material_index == 1 or votes * 2 >= len(polygon.vertices): polygon.material_index = face_index
# The outside of the ears shares atlas texels with the pink inside and came out skin-coloured; it gets a plain
# black material with no texture at all.
ear_back = bpy.data.materials.new('Blue ear back'); ear_back.use_nodes = True
ear_bsdf = ear_back.node_tree.nodes['Principled BSDF']
ear_bsdf.inputs['Base Color'].default_value = (.035, .032, .04, 1); ear_bsdf.inputs['Roughness'].default_value = .85
mesh.data.materials.append(ear_back); ear_index = len(mesh.data.materials) - 1
ear_groups_ids = {group_index[n] for n in ('Ear.L', 'Ear.R') if n in group_index}
for polygon in mesh.data.polygons:
    weight = sum(g.weight for i in polygon.vertices for g in mesh.data.vertices[i].groups if g.group in ear_groups_ids) / len(polygon.vertices)
    if weight > .5 and polygon.normal.y > -.15: polygon.material_index = ear_index

# ---------------------------------------------------------------- eyeballs
# Real eyes: two smooth spheres parented to the head bone, each with a 512² generated iris (amber gradient,
# radial fibres, dark limbal ring, vertical slit pupil). The atlas eyes were a few dozen blurry texels.
IR = 512
yy, xx = np.mgrid[0:IR, 0:IR]; u_ = (xx + .5) / IR; v_ = (yy + .5) / IR
theta = (1 - v_) * math.pi; phi = u_ * 2 * math.pi   # theta 0 at the +Z pole, which faces out of the head
tx, ty = theta * np.cos(phi), theta * np.sin(phi)
IRIS_R = .95; t = np.clip(theta / IRIS_R, 0, 1.2)
inner, outer, ring = np.array([.95, .66, .22]), np.array([.70, .38, .10]), np.array([.14, .06, .03])
fibres = 1 + .10 * np.sin(phi * 48 + 3 * np.sin(phi * 7)) * np.clip((t - .15) / .5, 0, 1) * np.clip(1 - t, 0, 1)
colour = (inner[None, None, :] * (1 - np.clip(t, 0, 1))[..., None] + outer[None, None, :] * np.clip(t, 0, 1)[..., None]) * fibres[..., None]
ring_mix = np.clip((t - .78) / .12, 0, 1)[..., None]; colour = colour * (1 - ring_mix) + ring[None, None, :] * ring_mix
# Big and round, dilated in the dim hall, but with a clear amber margin all round so the eye reads as an eye and not
# as a ring; a small catchlight near the top gives it the wet look of the photos at any size.
pupil = np.clip((1 - ((tx / .50) ** 2 + (ty / .50) ** 2)) * 8, 0, 1)[..., None]
colour = colour * (1 - pupil) + np.array([.012, .012, .015])[None, None, :] * pupil
catch = np.clip((1 - ((tx / .085) ** 2 + ((ty - .26) / .075) ** 2)) * 5, 0, 1)[..., None]
colour = colour * (1 - catch) + np.array([.96, .95, .92])[None, None, :] * catch
outside = np.clip((t - 1.0) / .04, 0, 1)[..., None]; colour = colour * (1 - outside) + np.array([.03, .028, .03])[None, None, :] * outside
iris = bpy.data.images.new('BlueIris', IR, IR, alpha=False)
iris_px = np.ones((IR, IR, 4), dtype=np.float32); iris_px[:, :, :3] = np.clip(colour, 0, 1)
iris.pixels.foreach_set(iris_px.ravel()); iris.pack()
iris.filepath_raw = str(WORK / 'blue-iris.png'); iris.file_format = 'PNG'; iris.save()
eyeball_material = bpy.data.materials.new('Blue amber eyeball'); eyeball_material.use_nodes = True
ebsdf = eyeball_material.node_tree.nodes['Principled BSDF']
etex = eyeball_material.node_tree.nodes.new('ShaderNodeTexImage'); etex.image = iris
eyeball_material.node_tree.links.new(etex.outputs['Color'], ebsdf.inputs['Base Color'])
ebsdf.inputs['Roughness'].default_value = .2
if 'Coat Weight' in ebsdf.inputs: ebsdf.inputs['Coat Weight'].default_value = 1.0
EYE_RADIUS = .0185
eye_objects = []
for side, (centre, normal) in eye_islands.items():
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=20, radius=EYE_RADIUS, location=(0, 0, 0))
    eye = bpy.context.object; eye.name = 'Eye.' + side; eye.data.name = 'Eye.' + side
    bpy.ops.object.shade_smooth()
    eye.data.materials.append(eyeball_material)
    z = normal.normalized(); y = (V((0, 0, 1)) - z * z.z).normalized(); x = y.cross(z)
    placement = Matrix.Translation(centre - normal * .0105) @ Matrix((x, y, z)).transposed().to_4x4()
    eye.parent = arm; eye.parent_type = 'BONE'; eye.parent_bone = 'Head'
    eye.matrix_world = placement
    eye_objects.append(eye)
    # Eyelids: two spherical caps a hair larger than the eyeball, hinged on the eye's lateral axis. The Meshy head has
    # no lid geometry (its blink morph only squashes the socket rim, and the eye stayed visibly open while he slept),
    # so these carry the blink. The runtime rotates them about local X by `blink` × LID_CLOSE; here they rest open.
    # Whatever sits inside the head is hidden by the skin; only the part that swings over the visible cap shows.
    for lid, pole, cap_deg, open_deg in (('U', 1, 78, 12), ('D', -1, 62, 6)):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=48, radius=EYE_RADIUS + (.0014 if lid == 'U' else .0008), location=(0, 0, 0))
        cap = bpy.context.object; cap.name = f'Lid.{lid}.{side}'; cap.data.name = cap.name
        bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='DESELECT'); bpy.ops.object.mode_set(mode='OBJECT')
        limit = math.cos(math.radians(cap_deg))
        for v in cap.data.vertices: v.select = (v.co.normalized().y * pole) < limit
        bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.delete(type='VERT'); bpy.ops.object.mode_set(mode='OBJECT')
        bpy.ops.object.shade_smooth()
        cap.data.materials.append(ear_back)
        cap.parent = arm; cap.parent_type = 'BONE'; cap.parent_bone = 'Head'
        # Same bone-relative transform as the eyeball (assigning matrix_world here evaluated the bone at a different
        # depsgraph state and put the caps 12 mm above the eye), tipped back a little further than the pole so the
        # open lid only hoods the top (or bottom) of the visible cap.
        cap.matrix_parent_inverse = eye.matrix_parent_inverse.copy()
        cap.matrix_basis = eye.matrix_basis @ Matrix.Rotation(math.radians(-pole * open_deg), 4, 'X')
        eye_objects.append(cap)

bpy.context.view_layer.update()
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(OUT_BLEND))
bpy.ops.object.select_all(action='DESELECT')
arm.select_set(True); mesh.select_set(True); bpy.context.view_layer.objects.active = arm
for eye in eye_objects: eye.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT_GLB), export_format='GLB', use_selection=True,
    export_animations=True, export_animation_mode='ACTIONS', export_force_sampling=True,
    export_optimize_animation_size=False, export_morph=True, export_morph_normal=False, export_skins=True, export_all_influences=False,
    export_image_format='WEBP', export_image_quality=90)
# ---------------------------------------------------------------- GLB post-processing
# 1. Retain the amber multiply constant as the standard baseColorFactor (the exporter drops linked MixRGB constants).
# 2. Drop sampled channels that never leave the node's rest value (every scale channel, static translations)
#    and repack the binary chunk so the file only carries data that is referenced.
raw = OUT_GLB.read_bytes(); json_length = struct.unpack_from('<I', raw, 12)[0]
document = json.loads(raw[20:20 + json_length])
bin_length = struct.unpack_from('<I', raw, 20 + json_length)[0]; binary = raw[28 + json_length:28 + json_length + bin_length]
for material in document['materials']:
    if material.get('name') == 'Blue amber eyes': material['pbrMetallicRoughness']['baseColorFactor'] = [1, .58, .18, 1]
def accessor_values(index):
    accessor = document['accessors'][index]; view = document['bufferViews'][accessor['bufferView']]
    dtype = {5126: np.float32, 5123: np.uint16, 5125: np.uint32, 5121: np.uint8}[accessor['componentType']]
    width = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}[accessor['type']]
    offset = view.get('byteOffset', 0) + accessor.get('byteOffset', 0)
    return np.frombuffer(binary, dtype=dtype, count=accessor['count'] * width, offset=offset).reshape(accessor['count'], width)
REST = {'translation': [0, 0, 0], 'rotation': [0, 0, 0, 1], 'scale': [1, 1, 1]}
dropped = 0
for animation in document['animations']:
    kept = []
    for channel in animation['channels']:
        sampler = animation['samplers'][channel['sampler']]; values = accessor_values(sampler['output'])
        target = channel['target']; node = document['nodes'][target['node']]
        rest_value = np.array(node.get(target['path'], REST[target['path']]), dtype=np.float32)
        if np.ptp(values, axis=0).max() < 1e-5 and np.abs(values[0] - rest_value).max() < 1e-5: dropped += 1; continue
        kept.append(channel)
    used = sorted({channel['sampler'] for channel in kept}); remap = {old: new for new, old in enumerate(used)}
    animation['samplers'] = [animation['samplers'][old] for old in used]
    for channel in kept: channel['sampler'] = remap[channel['sampler']]
    animation['channels'] = kept
used_accessors = set()
for m in document['meshes']:
    for primitive in m['primitives']:
        used_accessors.update(primitive['attributes'].values())
        if 'indices' in primitive: used_accessors.add(primitive['indices'])
        for target in primitive.get('targets', []): used_accessors.update(target.values())
for skin_ in document.get('skins', []):
    if 'inverseBindMatrices' in skin_: used_accessors.add(skin_['inverseBindMatrices'])
for animation in document['animations']:
    for sampler in animation['samplers']: used_accessors.update((sampler['input'], sampler['output']))
order = sorted(used_accessors); accessor_map = {old: new for new, old in enumerate(order)}
document['accessors'] = [document['accessors'][old] for old in order]
for m in document['meshes']:
    for primitive in m['primitives']:
        primitive['attributes'] = {k: accessor_map[v] for k, v in primitive['attributes'].items()}
        if 'indices' in primitive: primitive['indices'] = accessor_map[primitive['indices']]
        if 'targets' in primitive: primitive['targets'] = [{k: accessor_map[v] for k, v in target.items()} for target in primitive['targets']]
for skin_ in document.get('skins', []):
    if 'inverseBindMatrices' in skin_: skin_['inverseBindMatrices'] = accessor_map[skin_['inverseBindMatrices']]
for animation in document['animations']:
    for sampler in animation['samplers']: sampler['input'] = accessor_map[sampler['input']]; sampler['output'] = accessor_map[sampler['output']]
used_views = []
def view_index(old):
    if old not in used_views: used_views.append(old)
    return used_views.index(old)
for accessor in document['accessors']:
    if 'bufferView' in accessor: accessor['bufferView'] = view_index(accessor['bufferView'])
    sparse = accessor.get('sparse')  # morph targets are exported sparse: indices and values live in their own views
    if sparse:
        sparse['indices']['bufferView'] = view_index(sparse['indices']['bufferView'])
        sparse['values']['bufferView'] = view_index(sparse['values']['bufferView'])
for image in document.get('images', []):
    if 'bufferView' in image: image['bufferView'] = view_index(image['bufferView'])
packed = bytearray(); views = []
for old in used_views:
    view = document['bufferViews'][old]; start = view.get('byteOffset', 0)
    while len(packed) % 4: packed += b'\0'
    fresh = dict(view); fresh['byteOffset'] = len(packed); views.append(fresh)
    packed += binary[start:start + view['byteLength']]
while len(packed) % 4: packed += b'\0'
document['bufferViews'] = views; document['buffers'] = [{'byteLength': len(packed)}]
encoded = json.dumps(document, separators=(',', ':')).encode(); encoded += b' ' * ((-len(encoded)) % 4)
body = struct.pack('<II', len(encoded), 0x4e4f534a) + encoded + struct.pack('<II', len(packed), 0x004e4942) + bytes(packed)
OUT_GLB.write_bytes(struct.pack('<III', 0x46546c67, 2, 12 + len(body)) + body)
(WORK / 'rig-report-v2.json').write_text(json.dumps({'clips': [{'name': a.name, 'frames': list(a.frame_range)} for a in actions],
    'ground_lifted_vertices': lifted, 'dropped_static_channels': dropped, 'glb_bytes': OUT_GLB.stat().st_size, 'coat_texture': S}, indent=2))
print('BLUE_ANIMATE_EXPORTED', OUT_GLB.stat().st_size, flush=True)

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
STRIDE_SPEED = .19; WALK_CYCLE = 1.2; STANCE = .65
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
    P['head']['pitch'] = .025 * math.sin(2 * ph + .6); P['head']['roll'] = .02 * math.sin(ph)
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
    P['tail_lift'] = .15
    for i in range(6):
        k = i / 5; P['tail_wave'][i] = math.sin(ph - i * .55) * .022 * k
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
    P = base()
    apply_rest(P, ease(t, .2, 1.5), min(1, ease_back(t, .5, 1.9, 1.1)), ease(t, .8, 2.2), ease(t, 1.0, 2.4), ease_out(t, .6, 2.0))
    P['head']['pitch'] = .10 * ease_out(t, .6, 2.0)
    P['bob'] += -.006 * pulse(t, .4, 1.2)  # a quick dip as the front end folds
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

def apply_sit(P, hind, torso, tail):
    """Upright sit: rear lowered onto tucked hind legs, front legs straight, tail on the floor."""
    for n in TORSO: P['drop'][n] = SIT_DROP[n] * torso
    P['hind'] = {'amount': hind, 'target': HIND_SIT[0], 'bend': HIND_SIT[1]}
    P['tail_rest'] = tail
    P['head']['pitch'] += -.04 * torso

def sit(t, D):
    P = base(); apply_sit(P, ease(t, .1, 1.5), min(1, ease_back(t, .2, 1.7, 1.2)), ease(t, .6, 1.8))
    P['push'] += .012 * pulse(t, .05, 1.0)  # weight rocks back before the hindquarters come down
    return P

def sitidle(t, D):
    P = base(); apply_sit(P, 1, 1, 1); look_around(P, t, D, scale=.6)
    P['tail_wave'][5] += .012 * pulse(t, .45 * D, .6) + .008 * pulse(t, .9 * D, .5)
    return P

# ---------------------------------------------------------------- jumps with root motion
# The Root bone carries the trajectory (JUMP_UP: 1.95 m up and 1.03 m forward onto the claw cabinet, JUMP_DOWN the
# reverse from the lying spot to the floor in front). The runtime strips the Root track, replays the curve on the
# body and warps it to the actual take-off and landing points, so the pose and the flight can never disagree.
JUMP_UP = (.63, 1.95)
JUMP_DOWN = (.63, 1.95)

def jumpup(t, D):
    """Onto the ledge: look up, load the hindquarters, launch nose-up, rise past the marquee, hook the front paws
    over its top and swing the body in, hind paws follow, absorb, settle. Forward travel only starts once the body
    is above the top, so nothing passes through the marquee front."""
    P = base()
    P['head']['pitch'] = track(t, [(0, 0), (.15, -.30), (.45, -.22), (.6, -.05), (.9, .05), (1.05, .22), (1.25, .05), (1.5, 0)])
    load = track(t, [(.12, 0), (.42, 1), (.55, -.3), (.7, 0), (1.05, 0), (1.22, .7), (1.5, 0)])
    for n, d in (('Pelvis', .085), ('Spine', .07), ('Chest', .045), ('Neck', .02), ('Head', .012)): P['drop'][n] = d * load
    P['push'] = track(t, [(.12, 0), (.42, .022), (.55, -.03), (.8, -.01), (1.5, 0)])
    P['body_pitch'] = track(t, [(.28, 0), (.42, .08), (.58, -.36), (.85, -.28), (1.0, -.08), (1.14, .16), (1.36, 0)])
    up = track(t, [(.5, 0), (.8, 1.6), (.97, 2.12), (1.2, JUMP_UP[1])])
    forward = track(t, [(.5, 0), (.9, .03), (.97, .1), (1.2, JUMP_UP[0])])
    P['root_move'] = V((0, -forward, up))
    for side in 'LR':
        P['ears'][side][0] = track(t, [(.35, 0), (.55, .16), (.9, .05), (1.1, .12), (1.5, 0)])
        F, H = P['legs'][('Front', side)], P['legs'][('Hind', side)]
        F['dy'] = track(t, [(.42, 0), (.58, -.06), (.85, -.11), (.97, -.09), (1.2, 0)])
        F['dz'] = track(t, [(.42, 0), (.55, .06), (.8, .14), (.9, .04), (.97, -.05), (1.2, 0)])
        F['pitch'] = track(t, [(.45, 0), (.6, .5), (.85, .3), (.97, -.25), (1.2, 0)])
        H['dy'] = track(t, [(.4, 0), (.56, .14), (.85, .10), (1.15, .06), (1.32, 0)])
        H['dz'] = track(t, [(.4, 0), (.5, 0), (.64, .12), (1.05, .14), (1.22, .02), (1.32, 0)])
    P['tail_back'] = track(t, [(.3, 0), (.55, .9), (1.1, .8), (1.35, .2), (1.5, 0)])
    P['tail_lift'] = track(t, [(0, 0), (.35, .3), (.55, 0)])
    return P

def jumpdown(t, D):
    """Off the ledge: peer down, push off forward first so the hindquarters clear the marquee, then drop nose-down,
    the front paws take the landing, the hindquarters follow."""
    P = base()
    P['head']['pitch'] = track(t, [(0, 0), (.2, .35), (.4, .25), (.55, .1), (.85, .28), (1.05, .05), (1.3, 0)])
    load = track(t, [(.05, 0), (.32, .7), (.42, .2), (.55, 0), (.9, 0), (1.02, 1), (1.3, 0)])
    for n, d in (('Pelvis', .05), ('Spine', .065), ('Chest', .07), ('Neck', .03), ('Head', .015)): P['drop'][n] = d * load
    P['push'] = track(t, [(.1, 0), (.32, -.02), (.45, -.04), (.7, 0)])
    P['body_pitch'] = track(t, [(.2, 0), (.42, .12), (.62, .36), (.85, .3), (.98, .05), (1.1, -.08), (1.3, 0)])
    down = track(t, [(.4, 0), (.55, .05), (.7, .5), (.85, 1.3), (.95, JUMP_DOWN[1])])
    forward = track(t, [(.4, 0), (.55, .3), (.75, .5), (.95, JUMP_DOWN[0])])
    P['root_move'] = V((0, -forward, -down))
    for side in 'LR':
        P['ears'][side][0] = track(t, [(.3, 0), (.5, .1), (.9, .14), (1.3, 0)])
        F, H = P['legs'][('Front', side)], P['legs'][('Hind', side)]
        F['dy'] = track(t, [(.35, 0), (.5, -.08), (.85, -.10), (1.0, 0)])
        F['dz'] = track(t, [(.35, 0), (.55, -.04), (.85, -.08), (.95, 0)])
        F['pitch'] = track(t, [(.4, 0), (.6, -.3), (.9, .1), (1.05, 0)])
        H['dy'] = track(t, [(.35, 0), (.5, .06), (.9, .08), (1.12, 0)])
        H['dz'] = track(t, [(.3, 0), (.45, 0), (.6, .10), (.92, .12), (1.04, .02), (1.14, 0)])
    P['tail_back'] = track(t, [(.3, 0), (.55, .8), (.9, .9), (1.1, .3), (1.3, 0)])
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
    P = base(); apply_sit(P, 1 - ease(t, .15, 1.05), 1 - ease(t, .3, 1.25), 1 - ease(t, .55, 1.35))
    P['push'] += -.012 * pulse(t, .05, 1.1); P['head_lift'] += .006 * pulse(t, .2, 1.0)
    P['head']['pitch'] += -.05 * pulse(t, .1, .9)
    for side in 'LR': P['ears'][side][0] += .06 * pulse(t, .1, .8)
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
# Authored in the turning frame: the body yaws by yaw(t) around PIVOT while planted paws stay where they are in
# the world, so in body space they sweep backwards until their next step. The Root bone carries yaw(t); the
# runtime strips that track from the clip and turns the body by the same curve, so heading stays continuous.
PIVOT = V((0, -.03, 0))
TURN_STEP = {'Front': math.radians(45), 'Hind': math.radians(45)}  # a paw steps once per this much body yaw
TURN_SWING = {'Front': .12, 'Hind': .15}
TURN_LIFT = {'Front': .03, 'Hind': .025}

def turn_yaw(t, D, theta, start=.1, tail=.15, ramp_in=.22, ramp_out=.5):
    """Yaw profile with a quick start and a long settle: the rate ramps up fast, holds, and eases out slowly."""
    T = D - tail - start; u = clamp((t - start) / T) * T
    if u < ramp_in: f = u * u / (2 * ramp_in)
    elif u < T - ramp_out: f = u - ramp_in / 2
    else: f = (T - ramp_in / 2 - ramp_out / 2) - (T - u) ** 2 / (2 * ramp_out)
    return theta * f / (T - (ramp_in + ramp_out) / 2)

def turn_schedule(theta, D, sign):
    """Per paw: list of (start, end, from_angle, to_angle) swings, found by simulating the step rule."""
    inner, outer = ('L', 'R') if sign > 0 else ('R', 'L')
    feet = [('Front', inner), ('Hind', outer), ('Front', outer), ('Hind', inner)]
    first = {('Front', inner): .2, ('Hind', outer): .24, ('Front', outer): .5, ('Hind', inner): .54}  # diagonal pairs start together
    planted = {f: 0. for f in feet}; swings = {f: [] for f in feet}; last_start = -1.
    t = 0.
    while t < D:
        y = turn_yaw(t, D, theta)
        active = [f for f in feet if swings[f] and swings[f][-1][1] > t]
        # The paw furthest behind the body steps first, so no single paw can hog consecutive steps.
        for f in sorted(feet, key=lambda f: planted[f] - y):
            if f in active or theta - planted[f] < 1e-4: continue
            step = TURN_STEP[f[0]]; remaining = theta - planted[f]
            threshold = min(step * (first[f] if not swings[f] else .5), remaining * .5)
            if y - planted[f] <= threshold or t - last_start < .02: continue
            # Only a diagonal pair may swing together: never both front, both hind or the same side.
            if any(g[0] == f[0] or g[1] == f[1] for g in active): continue
            to = min(theta, y + step * .5)  # land half a step ahead of the body, wherever it is now
            swings[f].append((t, t + TURN_SWING[f[0]] * jitter(t * 7 + len(swings[f])), planted[f], to)); planted[f] = to; last_start = t
            active.append(f)
        t += 1 / 240
    return swings

def turn_foot(swings, t):
    """Planted angle, lift and paw pitch of one paw at time t."""
    a = 0.
    for s, e, a0, a1 in swings:
        if t >= e: a = a1; continue
        if t >= s:
            u = (t - s) / (e - s)
            return a0 + (a1 - a0) * smooth(u), math.sin(math.pi * u), .45 * math.sin(math.pi * u) * (1 - u) ** .5
        break
    return a, 0., 0.

def turn(t, D, theta, sign, swings):
    """The head snaps to the new direction, the spine bends into a C behind it, the weight shifts onto the inside
    then rolls out as the paws step around in arcs, and the tail whips out and settles; the root yaw underneath
    starts quickly and settles slowly."""
    P = base(); y = turn_yaw(t, D, theta); P['root_yaw'] = sign * y
    u = clamp(t / D); arc = math.sin(math.pi * u)
    scale = theta / (math.pi / 2)  # the 45° turn bends about half as much
    lead = curve(t, [(0, 0), (.16, .5, 'snap'), (.55 * D, .28), (D - .08, 0, 'out')]) * sign * scale
    P['head']['yaw'] = lead * .55
    P['bend']['Neck'] = lead * .25; P['bend']['Chest'] = lead * .42; P['bend']['Spine'] = lead * .3
    P['head']['roll'] = sign * .06 * arc; P['head']['pitch'] = -.04 * ease_out(t, 0, .25) * (1 - ease(t, D - .5, D))
    P['yaw']['Pelvis'] = -sign * .05 * arc
    P['roll']['Chest'] = -sign * .06 * arc; P['roll']['Pelvis'] = sign * .03 * math.sin(math.tau * u)
    P['sway'] = sign * .012 * math.sin(math.tau * u + .3); P['bob'] = -.009 * arc; P['push'] = .006 * arc
    inner = 'L' if sign > 0 else 'R'
    P['ears'][inner][1] += sign * .14 * arc; P['ears'][inner][0] += .06 * arc
    for side in 'LR': P['ears'][side][0] += .10 * ease_out(t, 0, .2) * (1 - ease(t, .3, .8))
    P['tail_lift'] = .2 * arc
    for i in range(6):
        k = i / 5
        P['tail_wave'][i] += -sign * .07 * k ** 1.4 * math.sin(math.pi * clamp((t - .1) / (D - .2))) + sign * .02 * k * k * pulse(t, .55 * D, .5)
        P['tail_lift_wave'][i] += .01 * k * pulse(t, .3 * D, .6)
    for leg in ('Front', 'Hind'):
        for side in 'LR':
            paw = f'{leg}Paw.{side}'
            a, lift, pitch = turn_foot(swings[(leg, side)], t)
            rel = heads[paw] - PIVOT
            pos = PIVOT + Matrix.Rotation(sign * (a - y), 4, 'Z') @ rel + V((0, 0, TURN_LIFT[leg] * lift))
            # Swinging paws arc outward instead of sliding straight to the next spot, and the shoulder lifts with them.
            outward = (pos - PIVOT); outward.z = 0; outward = outward.normalized() * .02 * lift
            pos = pos + outward
            L = P['legs'][(leg, side)]; L['dx'], L['dy'], L['dz'], L['pitch'] = (pos - heads[paw]).x, (pos - heads[paw]).y, (pos - heads[paw]).z, pitch
            L['root_dz'] = (.012 if leg == 'Front' else .008) * lift
    return P

TURNS = []
for degrees, D in ((45, 1.15), (90, 1.7)):
    for side, sign in (('L', 1), ('R', -1)):
        theta = math.radians(degrees); swings = turn_schedule(theta, D, sign)
        TURNS.append((f'turn{side}{degrees}', D, (lambda th, sg, sw: lambda t, D: turn(t, D, th, sg, sw))(theta, sign, swings)))

CLIPS = [('idle', 8.0, idle), ('walk', WALK_CYCLE, walk), ('trot', TROT_CYCLE, trot), ('settle', 2.4, settle), ('sleep', 6.0, sleep), ('wake', 1.5, wake), ('happy', 4.0, happy),
         ('sit', 1.8, sit), ('sitidle', 6.0, sitidle), ('stand', 1.4, stand), ('jumpup', 1.5, jumpup), ('jumpdown', 1.3, jumpdown), ('perch', 2.0, perch), ('perchidle', 6.0, perchidle), ('arch', 2.6, arch), ('flick', 1.8, flick),
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
keep = np.maximum(eye, inner_ear * pink)
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
# The Meshy normal map is noise on a black coat (sparkle under the hall's rect lights); the runtime tiles its
# own fine fur-grain normal instead, so the material carries no normal texture at all.
for mat in mesh.data.materials:
    for link in list(mat.node_tree.links):
        if link.to_socket.name == 'Normal' and link.to_node.type == 'BSDF_PRINCIPLED': mat.node_tree.links.remove(link)
    for node in [n for n in mat.node_tree.nodes if n.type == 'NORMAL_MAP' or (n.type == 'TEX_IMAGE' and n.image and n.image.name == 'Image_2')]:
        mat.node_tree.nodes.remove(node)

bpy.context.view_layer.update()
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(OUT_BLEND))
bpy.ops.object.select_all(action='DESELECT')
arm.select_set(True); mesh.select_set(True); bpy.context.view_layer.objects.active = arm
bpy.ops.export_scene.gltf(filepath=str(OUT_GLB), export_format='GLB', use_selection=True,
    export_animations=True, export_animation_mode='ACTIONS', export_force_sampling=True,
    export_optimize_animation_size=False, export_morph=True, export_morph_normal=False, export_skins=True, export_all_influences=False,
    export_image_format='WEBP', export_image_quality=88)
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

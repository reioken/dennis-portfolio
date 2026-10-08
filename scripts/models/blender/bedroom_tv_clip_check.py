"""Clipping audit for the TV corner: pairs of objects whose surfaces intersect (BVH overlap), ignoring prints and
labels lying on their own body and intended contacts (plugs in ports, cartridges in slots). Prints one line per pair
with the number of intersecting triangle pairs. blender -b BLEND -P THIS"""
import bpy, re
from mathutils.bvhtree import BVHTree
SMALL = re.compile(r'(print|label|-art$|cover|spine|screen|-ir$|crt-tube|grille-holes|vents|jack|key|led|power|av-panel)')
objs = [o for o in bpy.data.objects if o.type == 'MESH' and o.name != 'studio-floor']
trees = {}
def tree(o):
    if o.name not in trees:
        trees[o.name] = BVHTree.FromPolygons([o.matrix_world @ v.co for v in o.data.vertices], [p.vertices for p in o.data.polygons])
    return trees[o.name]
def box(o):
    vs = [o.matrix_world @ v.co for v in o.data.vertices]
    return [min(v[i] for v in vs) for i in range(3)], [max(v[i] for v in vs) for i in range(3)]
boxes = {o.name: box(o) for o in objs}
hits = []
for i, a in enumerate(objs):
    if SMALL.search(a.name): continue
    for b in objs[i + 1:]:
        if SMALL.search(b.name): continue
        (a0, a1), (b0, b1) = boxes[a.name], boxes[b.name]
        if any(a1[k] < b0[k] or b1[k] < a0[k] for k in range(3)): continue
        n = len(tree(a).overlap(tree(b)))
        if n: hits.append((n, a.name, b.name))
for n, a, b in sorted(hits, reverse=True): print('CLIP %5d  %s  <>  %s' % (n, a, b))
print('CLIP_PAIRS', len(hits))

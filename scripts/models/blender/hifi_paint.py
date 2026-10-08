# Clean paint for the hi-fi's Tripo models (imported by hifi_build.py).
# Dennis, 2026-10-07, on Tripo's own maps: "all look smudged, not accurate". Tripo paints its atlas by AI over
# thousands of tiny UV islands: streaks, baked shading, smeared prints, and mip levels that bleed island into island.
# So no Tripo pixel reaches the hall: every face of the full mesh gets a class from its median-filtered colour and its
# place (the base band by height, the grille by its recess), each class one flat colour, gloss and metal; that paint
# is baked onto the low copy's own large UV islands, multiplied by ambient occlusion baked from the real geometry
# (the vents, gaps and knurls dark where they are deep, not where the AI painted them).
import bpy, os
import numpy as np

def srgb(hexcolour):
    c = [((hexcolour >> s) & 255) / 255 for s in (16, 8, 0)]
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]

def face_samples(mesh, image_path):
    """Per face: centre, normal and the median-filtered Tripo colour (0..255 sRGB) under its UV centre."""
    n = len(mesh.polygons)
    centre = np.zeros(n * 3, np.float32); mesh.polygons.foreach_get('center', centre); centre = centre.reshape(-1, 3)
    normal = np.zeros(n * 3, np.float32); mesh.polygons.foreach_get('normal', normal); normal = normal.reshape(-1, 3)
    start = np.zeros(n, np.int64); mesh.polygons.foreach_get('loop_start', start)
    total = np.zeros(n, np.int64); mesh.polygons.foreach_get('loop_total', total)
    uv = np.zeros(len(mesh.loops) * 2, np.float32); mesh.uv_layers[0].data.foreach_get('uv', uv); uv = uv.reshape(-1, 2)
    fuv = np.add.reduceat(uv, start, axis=0) / total[:, None]
    img = bpy.data.images.load(os.path.abspath(image_path))
    w, h = img.size
    px = np.zeros(w * h * 4, np.float32); img.pixels.foreach_get(px); px = px.reshape(h, w, 4)
    x = np.clip((fuv[:, 0] % 1) * w, 0, w - 1).astype(np.int64)
    y = np.clip((fuv[:, 1] % 1) * h, 0, h - 1).astype(np.int64)
    rgb = px[y, x, :3]
    # image pixels are linear floats for an sRGB file: back to 0..255 sRGB for the thresholds
    rgb = np.where(rgb <= 0.0031308, rgb * 12.92, 1.055 * np.power(np.maximum(rgb, 0), 1 / 2.4) - 0.055) * 255
    bpy.data.images.remove(img)
    return centre, normal, rgb

def paint(mesh, classes, palette):
    """Writes the 'paint' (colour) and 'pbr' (0, roughness, metal) corner attributes from per-face class indices."""
    colour = np.array([srgb(p[0]) + [1] for p in palette], np.float32)
    pbr = np.array([[0, p[1], p[2], 1] for p in palette], np.float32)
    start = np.zeros(len(mesh.polygons), np.int64); mesh.polygons.foreach_get('loop_start', start)
    total = np.zeros(len(mesh.polygons), np.int64); mesh.polygons.foreach_get('loop_total', total)
    per_loop = np.repeat(classes, total)
    for name, table in (('paint', colour), ('pbr', pbr)):
        if name in mesh.color_attributes: mesh.color_attributes.remove(mesh.color_attributes[name])
        attr = mesh.color_attributes.new(name, 'FLOAT_COLOR', 'CORNER')
        attr.data.foreach_set('color', table[per_loop].ravel())
    counts = np.bincount(classes, minlength=len(palette))
    print('PAINT', {palette[i][3]: int(c) for i, c in enumerate(counts) if c})

def bake_clean(lows, hi, name, size, ao_strength=0.75, cage=0.006, device='CPU', ao_samples=48):
    """Bakes hi's paint (times its AO) and its pbr onto `lows`, which share one new UV space; gives them the material.
    `cage`: how far outside the low copy the bake looks for the full mesh (a remesh that cut a corner needs more)."""
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = device
    bake = scene.render.bake
    bake.use_selected_to_active = True
    bake.margin = 8
    for x in bpy.context.selected_objects: x.select_set(False)
    for lo in lows:
        while lo.data.uv_layers: lo.data.uv_layers.remove(lo.data.uv_layers[0])
        lo.data.uv_layers.new(name='UVMap')
        lo.select_set(True)
    bpy.context.view_layer.objects.active = lows[0]
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=np.radians(58), island_margin=0.004, area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    imgs = {k: bpy.data.images.new(f'hifi-{name}-{k}', size, size, alpha=False, float_buffer=(k == 'ao')) for k in ('paint', 'pbr', 'ao')}
    imgs['pbr'].colorspace_settings.name = 'Non-Color'
    imgs['ao'].colorspace_settings.name = 'Non-Color'
    target = bpy.data.materials.new('bake-target'); target.use_nodes = True
    tnode = target.node_tree.nodes.new('ShaderNodeTexImage')
    for lo in lows:
        lo.data.materials.clear(); lo.data.materials.append(target)
    # the source: emission from an attribute, or the plain surface for AO
    src = bpy.data.materials.new('bake-source'); src.use_nodes = True
    nt = src.node_tree
    out = [n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL'][0]
    bsdf = nt.nodes['Principled BSDF']
    attr = nt.nodes.new('ShaderNodeAttribute'); emit = nt.nodes.new('ShaderNodeEmission')
    nt.links.new(attr.outputs['Color'], emit.inputs['Color'])
    hi.data.materials.clear(); hi.data.materials.append(src)
    def run(kind, bake_type, samples, attribute=None):
        tnode.image = imgs[kind]; target.node_tree.nodes.active = tnode
        scene.cycles.samples = samples
        bake.use_clear = True
        if attribute:
            attr.attribute_name = attribute
            nt.links.new(emit.outputs['Emission'], out.inputs['Surface'])
        else:
            nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
        for i, lo in enumerate(lows):
            for x in bpy.context.selected_objects: x.select_set(False)
            hi.select_set(True); lo.select_set(True); bpy.context.view_layer.objects.active = lo
            bake.use_clear = i == 0
            bake.cage_extrusion = cage; bake.max_ray_distance = cage * 3 + 0.012
            bpy.ops.object.bake(type=bake_type)
        print('BAKED', name, kind)
    run('paint', 'EMIT', 4, 'paint')
    run('pbr', 'EMIT', 4, 'pbr')
    scene.world = scene.world or bpy.data.worlds.new('w')
    scene.world.light_settings.distance = 0.04
    run('ao', 'AO', ao_samples)
    # paint x AO, softened: deep crevices go dark, open faces keep their colour
    p = np.zeros(size * size * 4, np.float32); imgs['paint'].pixels.foreach_get(p)
    a = np.zeros(size * size * 4, np.float32); imgs['ao'].pixels.foreach_get(a)
    ao = 1 - ao_strength * (1 - np.clip(a[0::4], 0, 1))
    for c in range(3): p[c::4] *= ao
    imgs['paint'].pixels.foreach_set(p)
    for k in ('paint', 'pbr'): imgs[k].pack()
    bpy.data.images.remove(imgs['ao'])
    # the glTF-shaped material the hall reads
    mat = bpy.data.materials.new('hifi-' + name); mat.use_nodes = True
    mt = mat.node_tree; pb = mt.nodes['Principled BSDF']
    tc = mt.nodes.new('ShaderNodeTexImage'); tc.image = imgs['paint']
    tr = mt.nodes.new('ShaderNodeTexImage'); tr.image = imgs['pbr']
    sep = mt.nodes.new('ShaderNodeSeparateColor')
    mt.links.new(tc.outputs['Color'], pb.inputs['Base Color'])
    mt.links.new(tr.outputs['Color'], sep.inputs['Color'])
    mt.links.new(sep.outputs['Green'], pb.inputs['Roughness'])
    mt.links.new(sep.outputs['Blue'], pb.inputs['Metallic'])
    imgs['paint'].name = f'hifi-{name}-basecolor'; imgs['pbr'].name = f'hifi-{name}-rm'
    for lo in lows:
        lo.data.materials.clear(); lo.data.materials.append(mat)
    bpy.data.materials.remove(target); bpy.data.materials.remove(src)
    return mat

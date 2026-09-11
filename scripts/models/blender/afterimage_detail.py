"""Reusable construction-detail pass for every generated hall machine.
Keeps named moving groups/pivots intact; never loads or edits character assets.
"""
from mathutils import Matrix
import cabinet_gen as cg

def enrich(parts, generator=None):
    global cg
    if generator is not None:
        cg = generator
    metal = cg.material("afterimage_fastener", cg.hex_rgb("#727883"), rough=0.32, metal=0.85)
    recess = cg.material("afterimage_recess", cg.hex_rgb("#080A0D"), rough=0.75)
    target = parts.setdefault("construction", [])
    artwork = cg.material("afterimage_front_art", cg.grey(.05), rough=.58,
                          base_tex=cg.tiny_tex("afterimage_front_tex", (.05,.05,.05)))
    # Dedicated UV-mapped inserts sit just above the metal panel. The live hall
    # supplies each project's artwork; the original panel and controls remain.
    for objects in list(parts.values()):
        for ob in list(objects):
            if ob.name not in ("ped_panel", "lower_panel", "cp_plate", "ledge", "selector_plate", "selector_strip"): continue
            if ob.name == "ledge" and "carriage" in parts: continue
            vertices = [v.co for v in ob.data.vertices]
            lo = [min(v[i] for v in vertices) for i in range(3)]
            hi = [max(v[i] for v in vertices) for i in range(3)]
            frame = ob.matrix_world @ Matrix.Translation(((lo[0]+hi[0])/2, (lo[1]+hi[1])/2, hi[2]+.0008))
            key = "deck_art" if ob.name in ("cp_plate", "ledge", "selector_plate", "selector_strip") else "front_art"
            parts.setdefault(key, []).append(cg.quad(key, hi[0]-lo[0]-.016, hi[1]-lo[1]-.016, artwork, frame))
    # Fasteners sit on the original part's local front surface. All screws stay
    # with stationary panels rather than expanding the moving control hit boxes.
    for objects in list(parts.values()):
        for ob in list(objects):
            if ob.name not in ("cp_plate", "coin_door", "mq_surround", "control_plate", "keyboard_plate", "selector_plate", "selector_strip"):
                continue
            vertices = [v.co for v in ob.data.vertices]
            if not vertices: continue
            lo = [min(v[i] for v in vertices) for i in range(3)]
            hi = [max(v[i] for v in vertices) for i in range(3)]
            if hi[0]-lo[0] < .06 or hi[1]-lo[1] < .035: continue
            margin = min(.014, (hi[1]-lo[1])*.18)
            for x in (lo[0]+margin, hi[0]-margin):
                for y in (lo[1]+margin, hi[1]-margin):
                    frame = ob.matrix_world @ Matrix.Translation((x,y,hi[2]+.0012))
                    target.append(cg.cylinder("fastener", .0038, .0024, metal, frame, segs=24, bevel=.0006, bevel_seg=3))
                    target.append(cg.box("fastener_slot", .0042,.0008,.0003,recess,frame @ Matrix.Translation((0,0,.0013))))
    # Stationary button sockets receive an extra machined rim; the cap group
    # itself and its established origin are kept untouched.
    for key, objects in list(parts.items()):
        if not (key.startswith("btn_") or key.startswith("start_") or key.startswith("tbtn_") or key.startswith("kbtn_") or key.startswith("sel_")):
            continue
        for ob in objects:
            if "ring" not in ob.name: continue
            verts=[v.co for v in ob.data.vertices]
            r=max(abs(v.x) for v in verts)
            # Thin collar around the socket, outside the cap's travel.
            matrix=ob.matrix_world.copy()
            target.append(cg.cylinder("socket_collar",r*1.08,.0015,metal,matrix,segs=36,bevel=.0005,bevel_seg=3))
            break

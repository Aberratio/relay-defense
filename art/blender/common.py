"""Shared helpers for rendering game sprites in Blender (run with `blender --background`).

Every sprite uses the same orthographic camera, lights and outline, so characters from
different packs sit together on the board.
"""
import math
import os

import bpy
import mathutils


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    try:
        scene.render.engine = 'BLENDER_EEVEE'
    except TypeError:  # Blender 4.2 to 4.5 call it EEVEE Next
        scene.render.engine = 'BLENDER_EEVEE_NEXT'
    scene.render.film_transparent = True
    scene.view_settings.view_transform = 'Standard'
    world = bpy.data.worlds.new('world')
    scene.world = world
    world.use_nodes = True
    background = world.node_tree.nodes['Background']
    background.inputs[0].default_value = (0.55, 0.6, 0.7, 1)
    background.inputs[1].default_value = 0.7
    return scene


def import_model(path):
    before = set(bpy.data.objects)
    lower = path.lower()
    if lower.endswith(('.glb', '.gltf')):
        bpy.ops.import_scene.gltf(filepath=path)
    elif lower.endswith('.fbx'):
        bpy.ops.import_scene.fbx(filepath=path)
    else:
        raise ValueError(f'unsupported model format: {path}')
    return [o for o in bpy.data.objects if o not in before]


def wire_textures(tex_dir, aliases):
    """FBX files from the RPG pack name their materials after the texture files; link them."""
    for material in bpy.data.materials:
        name = aliases.get(material.name, material.name)
        path = os.path.join(tex_dir, name + '.png')
        if not os.path.exists(path) or not material.use_nodes:
            continue
        nodes = material.node_tree.nodes
        links = material.node_tree.links
        bsdf = next((n for n in nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if not bsdf:
            continue
        tex = nodes.new('ShaderNodeTexImage')
        tex.image = bpy.data.images.load(path)
        links.new(tex.outputs[0], bsdf.inputs['Base Color'])
        # a soft self-light keeps painted textures readable at sprite size
        links.new(tex.outputs[0], bsdf.inputs['Emission Color'])
        bsdf.inputs['Emission Strength'].default_value = 0.35
        for link in list(bsdf.inputs['Normal'].links):
            links.remove(link)
        bsdf.inputs['Metallic'].default_value = 0.0
        bsdf.inputs['Roughness'].default_value = 0.85


def matte(objs):
    """Stock models ship with some metalness, which turns dark under the sprite lights."""
    for o in objs:
        if o.type != 'MESH':
            continue
        for m in o.data.materials:
            if not m or not m.use_nodes:
                continue
            for n in m.node_tree.nodes:
                if n.type == 'BSDF_PRINCIPLED':
                    n.inputs['Metallic'].default_value = 0.0
                    n.inputs['Roughness'].default_value = max(0.7, n.inputs['Roughness'].default_value)


def pose_idle(objs):
    """Puts every armature in the first frames of its idle animation, when there is one."""
    actions = list(bpy.data.actions)
    pick = next((a for a in actions if 'idle' in a.name.lower()), None)
    if not pick:
        return
    for o in objs:
        if o.type != 'ARMATURE':
            continue
        o.animation_data_create()
        o.animation_data.action = pick
        try:
            if pick.slots:
                o.animation_data.action_slot = pick.slots[0]
        except AttributeError:
            pass
    bpy.context.scene.frame_set(int(pick.frame_range[0]) + 5)


def vertices(objs):
    graph = bpy.context.evaluated_depsgraph_get()
    points = []
    for o in objs:
        if o.type != 'MESH':
            continue
        evaluated = o.evaluated_get(graph)
        mesh = evaluated.to_mesh()
        points += [evaluated.matrix_world @ v.co for v in mesh.vertices]
        evaluated.to_mesh_clear()
    return points


def bounds(objs):
    bpy.context.view_layer.update()
    points = vertices(objs)
    if not points:
        raise ValueError('the model has no mesh to measure')
    lo = mathutils.Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
    hi = mathutils.Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
    return lo, hi


def normalise(objs, size):
    """Fits the import into `size` (largest side), centred on the origin and standing on the ground.

    Two empties: `centre` scales and shifts the model, `pivot` sits at the world origin and is the
    one to turn, so a heading never moves the model off its pedestal.
    """
    pivot = bpy.data.objects.new('pivot', None)
    centre = bpy.data.objects.new('centre', None)
    bpy.context.scene.collection.objects.link(pivot)
    bpy.context.scene.collection.objects.link(centre)
    centre.parent = pivot
    for o in objs:
        if o.parent is None:
            o.parent = centre
    lo, hi = bounds(objs)
    extent = hi - lo
    k = size / max(extent.x, extent.y, extent.z)
    mid = (lo + hi) / 2
    centre.scale = (k, k, k)
    centre.location = (-mid.x * k, -mid.y * k, -lo.z * k)
    bpy.context.view_layer.update()
    return pivot


def attach(objects, root):
    """Parents props to the model's root without moving them, so they turn with the model."""
    bpy.context.view_layer.update()
    for o in objects:
        world = o.matrix_world.copy()
        o.parent = root
        o.matrix_world = world


def material(name, rgb, emit=0.0, metal=0.0, rough=0.6, alpha=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*rgb, 1)
    bsdf.inputs['Metallic'].default_value = metal
    bsdf.inputs['Roughness'].default_value = rough
    if emit:
        bsdf.inputs['Emission Color'].default_value = (*rgb, 1)
        bsdf.inputs['Emission Strength'].default_value = emit
    if alpha < 1:
        bsdf.inputs['Alpha'].default_value = alpha
        m.surface_render_method = 'BLENDED'
    return m


def tint(objs, rgb, amount):
    """Mixes every material's base colour towards `rgb` by `amount` (0..1)."""
    seen = set()
    for o in objs:
        if o.type != 'MESH':
            continue
        for m in o.data.materials:
            if not m or m.name in seen or m.name == 'outline' or not m.use_nodes:
                continue
            seen.add(m.name)
            tree = m.node_tree
            bsdf = next((n for n in tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
            if not bsdf:
                continue
            mix = tree.nodes.new('ShaderNodeMix')
            mix.data_type = 'RGBA'
            mix.blend_type = 'MIX'
            mix.inputs['Factor'].default_value = amount
            mix.inputs[7].default_value = (*rgb, 1)
            base = bsdf.inputs['Base Color']
            if base.links:
                tree.links.new(base.links[0].from_socket, mix.inputs[6])
            else:
                mix.inputs[6].default_value = tuple(base.default_value)
            tree.links.new(mix.outputs[2], base)


def add(primitive, name, mat, **kwargs):
    getattr(bpy.ops.mesh, 'primitive_' + primitive + '_add')(**kwargs)
    o = bpy.context.object
    o.name = name
    o.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    return o


def outline(objs, colour, width):
    """Inverted-hull outline: a flipped, slightly larger shell that only shows its back faces."""
    m = bpy.data.materials.get('outline')
    if not m:
        m = bpy.data.materials.new('outline')
        m.use_nodes = True
        tree = m.node_tree
        tree.nodes.clear()
        emission = tree.nodes.new('ShaderNodeEmission')
        emission.inputs[0].default_value = colour
        out = tree.nodes.new('ShaderNodeOutputMaterial')
        tree.links.new(emission.outputs[0], out.inputs[0])
        m.use_backface_culling = True
    bpy.context.view_layer.update()
    for o in objs:
        if o.type != 'MESH':
            continue
        slots = len(o.data.materials)
        o.data.materials.append(m)
        mod = o.modifiers.new('outline', 'SOLIDIFY')
        mod.thickness = width / max(o.matrix_world.to_scale())
        mod.offset = 1
        mod.use_flip_normals = True
        mod.material_offset = slots
        mod.use_rim = False


def lights(scene):
    for name, rotation, energy, colour in [
        ('key', (45, 0, -35), 3.2, (1, 0.96, 0.9)),
        ('fill', (55, 0, 60), 1.2, (0.9, 0.95, 1)),
        ('rim', (60, 0, 170), 2.0, (0.75, 0.85, 1)),
    ]:
        light = bpy.data.objects.new(name, bpy.data.lights.new(name, 'SUN'))
        scene.collection.objects.link(light)
        light.rotation_euler = tuple(math.radians(v) for v in rotation)
        light.data.energy = energy
        light.data.color = colour


def camera(scene, elevation, ortho_scale, target_z):
    cam = bpy.data.objects.new('camera', bpy.data.cameras.new('camera'))
    scene.collection.objects.link(cam)
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = ortho_scale
    e = math.radians(elevation)
    cam.location = (0, -math.cos(e) * 10, math.sin(e) * 10 + target_z)
    direction = mathutils.Vector((0, 0, target_z)) - cam.location
    cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
    scene.camera = cam


def render(scene, path, pixels):
    scene.render.resolution_x = scene.render.resolution_y = pixels
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)

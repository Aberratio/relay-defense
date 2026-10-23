"""Renders one sprite described in art/sprites.json.

    blender --background --factory-startup --python art/blender/render_sprite.py -- \
        art/sprites.json <sprite name> <tier> <output.png>

Defenders ("good") stand on a stone pedestal ringed in their own colour; upgrades show as a gold
ring and a banner (tier 2) plus a halo and motes (tier 3). Monsters ("evil") get a thin red ring
on the ground. Recipes add the props that turn a stock model into its role.
"""
import json
import math
import os
import sys

import bpy
import mathutils

sys.path.insert(0, os.path.dirname(__file__))
import common  # noqa: E402

GOLD = (1.0, 0.78, 0.3)


# ---- Recipes: props per role --------------------------------------------------------------


def recipe_unicorn(objs, spec, tier):
    lo, hi = common.bounds(objs)
    points = common.vertices(objs)
    ears = max(points, key=lambda p: p.z)
    forward = 1 if ears.x > (lo.x + hi.x) / 2 else -1
    near = [p for p in points
            if abs(p.x - ears.x) < (hi.x - lo.x) * 0.12 and p.z > ears.z - (hi.z - lo.z) * 0.12]
    top = sum(near, mathutils.Vector()) / len(near)
    top.x += 0.03 * forward
    pearl = common.material('horn', (1.0, 0.85, 0.55), emit=0.3 + tier * 0.3, metal=0.3, rough=0.25)
    horn = common.add('cone', 'horn', pearl, radius1=0.025, depth=0.2, vertices=12,
                      location=top + mathutils.Vector((0.02 * forward, 0, 0.08)))
    horn.rotation_euler = (0, math.radians(30 * forward), 0)
    common.tint(objs, (0.97, 0.94, 1.0), 0.45)
    # a violet glow around the hooves
    aura = common.material('hoofglow', spec['colour'], emit=1.0, alpha=0.6)
    glow = common.add('torus', 'hoofglow', aura, major_radius=(hi.x - lo.x) * 0.32,
                      minor_radius=0.012, location=((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z + 0.02))
    glow.scale = (1, 0.55, 1)
    return [horn, glow]


def recipe_druid(objs, spec, tier):
    lo, hi = common.bounds(objs)
    orb = common.material('storm', spec['colour'], emit=2.0 + tier * 0.6)
    ball = common.add('ico_sphere', 'orb', orb, radius=0.045 + 0.01 * tier, subdivisions=2,
                      location=(hi.x + 0.02, lo.y + (hi.y - lo.y) * 0.3, lo.z + (hi.z - lo.z) * 0.75))
    sparks = []
    for i in range(3):
        a = i * 2.1
        sparks.append(common.add('ico_sphere', 'spark', orb, radius=0.012, subdivisions=1,
                                 location=ball.location + mathutils.Vector((math.cos(a) * 0.08, 0, math.sin(a) * 0.08))))
    return [ball] + sparks


def recipe_ent(objs, spec, tier):
    lo, hi = common.bounds(objs)
    common.tint(objs, (1.0, 0.55, 0.15), 0.55)
    eye = common.material('eye', (1.0, 0.85, 0.3), emit=4.0)
    z = lo.z + (hi.z - lo.z) * 0.3
    trunk = [p for p in common.vertices(objs) if abs(p.z - z) < (hi.z - lo.z) * 0.05]
    front = min(p.y for p in trunk)
    cx = sum(p.x for p in trunk) / len(trunk)
    eyes = [common.add('uv_sphere', 'eye', eye, radius=0.03, location=(cx + dx, front - 0.01, z))
            for dx in (-0.045, 0.045)]
    stone = common.material('boulder', (0.45, 0.43, 0.42), rough=0.95)
    rock = common.add('ico_sphere', 'boulder', stone, radius=0.09, subdivisions=1,
                      location=(hi.x - 0.02, lo.y + 0.05, lo.z + (hi.z - lo.z) * 0.25))
    return eyes + [rock]


def recipe_dryad(objs, spec, tier):
    lo, hi = common.bounds(objs)
    common.tint(objs, (1.0, 0.5, 0.78), 0.45)
    petal = common.material('petal', (1.0, 0.75, 0.9), emit=0.8)
    leaf = common.material('leaf', (0.35, 0.8, 0.35), emit=0.3)
    crown = []
    cx, cy = (lo.x + hi.x) / 2, (lo.y + hi.y) / 2
    for i in range(7):
        a = i * math.tau / 7
        crown.append(common.add('uv_sphere', 'flower', petal if i % 2 else leaf, radius=0.028,
                                location=(cx + math.cos(a) * 0.09, cy + math.sin(a) * 0.09, hi.z - 0.02)))
    vine = common.material('vine', (0.25, 0.65, 0.25), rough=0.8)
    roots = []
    for i in range(5):
        a = i * math.tau / 5 + 0.3
        r = common.add('torus', 'root', vine, major_radius=0.07, minor_radius=0.012,
                       location=(cx + math.cos(a) * 0.2, cy + math.sin(a) * 0.2, lo.z + 0.03))
        r.rotation_euler = (math.radians(90), 0, a)
        roots.append(r)
    return crown + roots


def recipe_fairy(objs, spec, tier):
    lo, hi = common.bounds(objs)
    common.tint(objs, (1.0, 0.88, 0.45), 0.3)
    wing = common.material('wing', (1.0, 0.93, 0.6), emit=1.5, alpha=0.9)
    cx = (lo.x + hi.x) / 2
    cy = (lo.y + hi.y) / 2
    wings = []
    for side in (-1, 1):
        w = common.add('uv_sphere', 'wing', wing, radius=0.18,
                       location=(cx + side * (hi.x - lo.x) * 0.55, cy + 0.02, lo.z + (hi.z - lo.z) * 0.68))
        w.scale = (0.9, 0.06, 0.65)
        w.rotation_euler = (0, math.radians(30 * side), 0)
        wings.append(w)
    light = common.material('lantern', (1.0, 0.8, 0.3), emit=3.0 + tier)
    lamp = common.add('uv_sphere', 'lamp', light, radius=0.065,
                      location=(hi.x + 0.04, lo.y + 0.02, lo.z + (hi.z - lo.z) * 0.45))
    cage = common.material('cage', (0.3, 0.3, 0.33), metal=0.8, rough=0.4)
    ring = common.add('torus', 'cage', cage, major_radius=0.055, minor_radius=0.008, location=lamp.location)
    return wings + [lamp, ring]


def recipe_thorns(objs, spec, tier):
    lo, hi = common.bounds(objs)
    thorn = common.material('thorn', spec['colour'], rough=0.6)
    spikes = []
    for i in range(10):
        x = lo.x + (hi.x - lo.x) * ((i * 0.37) % 1)
        y = lo.y + (hi.y - lo.y) * ((i * 0.61) % 1)
        s = common.add('cone', 'thorn', thorn, radius1=0.025, depth=0.12, vertices=6, location=(x, y, hi.z + 0.04))
        s.rotation_euler = (math.radians((i % 3 - 1) * 20), math.radians((i % 2) * 20 - 10), 0)
        spikes.append(s)
    return spikes


def recipe_troll(objs, spec, tier):
    common.tint(objs, spec['colour'], 0.3)
    steel = common.material('steel', (0.55, 0.58, 0.62), metal=0.9, rough=0.35)
    lo, hi = common.bounds(objs)
    plate = common.add('cylinder', 'plate', steel, radius=(hi.x - lo.x) * 0.12, depth=0.04, vertices=6,
                       location=((lo.x + hi.x) / 2, lo.y + 0.03, lo.z + (hi.z - lo.z) * 0.55))
    plate.rotation_euler = (math.radians(90), 0, 0)
    return [plate]


def recipe_brood(objs, spec, tier):
    lo, hi = common.bounds(objs)
    sac = common.material('sac', spec['colour'], emit=0.2, rough=0.8)
    r = (hi.y - lo.y) * 0.14
    body = common.add('uv_sphere', 'sac', sac, radius=r,
                      location=((lo.x + hi.x) / 2, hi.y - r, lo.z + (hi.z - lo.z) * 0.9))
    body.scale = (1, 1.2, 0.85)
    spot = common.material('spot', (0.55, 0.1, 0.12), emit=0.6)
    spots = [common.add('uv_sphere', 'spot', spot, radius=0.022,
                        location=body.location + mathutils.Vector((math.cos(i * 1.3) * r * 0.7, math.sin(i * 1.3) * r * 0.7, r * 0.5)))
             for i in range(5)]
    return [body] + spots


def recipe_spiderling(objs, spec, tier):
    common.tint(objs, spec['colour'], 0.5)
    return []


def recipe_goblin(objs, spec, tier):
    common.tint(objs, spec['colour'], 0.6)
    return []


def recipe_wraith(objs, spec, tier):
    common.tint(objs, spec['colour'], 0.25)
    lo, hi = common.bounds(objs)
    eye = common.material('wraitheye', (0.7, 0.9, 1.0), emit=4.0)
    cx = (lo.x + hi.x) / 2
    return [common.add('uv_sphere', 'eye', eye, radius=0.02,
                       location=(cx + dx, lo.y + 0.01, lo.z + (hi.z - lo.z) * 0.72)) for dx in (-0.05, 0.05)]


def recipe_shaman(objs, spec, tier):
    common.tint(objs, spec['colour'], 0.3)
    lo, hi = common.bounds(objs)
    heal = common.material('heal', (0.35, 1.0, 0.55), emit=3.0)
    return [common.add('ico_sphere', 'heal', heal, radius=0.05, subdivisions=2,
                       location=(lo.x - 0.01, lo.y + 0.05, lo.z + (hi.z - lo.z) * 0.7))]


def recipe_ogre(objs, spec, tier):
    common.tint(objs, spec['colour'], 0.6)
    lo, hi = common.bounds(objs)
    gold = common.material('crown', GOLD, metal=0.9, rough=0.3, emit=0.3)
    cx, cy = (lo.x + hi.x) / 2, (lo.y + hi.y) / 2
    band = common.add('cylinder', 'crown', gold, radius=0.09, depth=0.05, vertices=16,
                      location=(cx, cy, hi.z + 0.0))
    points = [common.add('cone', 'crownpoint', gold, radius1=0.02, depth=0.06, vertices=4,
                         location=(cx + math.cos(i * math.tau / 5) * 0.08, cy + math.sin(i * math.tau / 5) * 0.08, hi.z + 0.05))
              for i in range(5)]
    steel = common.material('spikes', (0.35, 0.35, 0.38), metal=0.8, rough=0.4)
    spikes = []
    for side in (-1, 1):
        s = common.add('cone', 'spike', steel, radius1=0.04, depth=0.14, vertices=6,
                       location=(cx + side * (hi.x - lo.x) * 0.38, cy, lo.z + (hi.z - lo.z) * 0.78))
        s.rotation_euler = (0, math.radians(35 * side), 0)
        spikes.append(s)
    return [band] + points + spikes


def recipe_heart_tree(objs, spec, tier):
    lo, hi = common.bounds(objs)
    common.tint(objs, (0.4, 0.85, 0.4), 0.55)
    glow = common.material('heartglow', spec['colour'], emit=3.0)
    cx, cy = (lo.x + hi.x) / 2, (lo.y + hi.y) / 2
    heart = common.add('uv_sphere', 'heart', glow, radius=0.06, location=(cx, lo.y + 0.12, lo.z + (hi.z - lo.z) * 0.3))
    motes = [common.add('uv_sphere', 'mote', glow, radius=0.018,
                        location=(cx + math.cos(i * 1.1) * 0.3, cy + math.sin(i * 1.1) * 0.3, lo.z + (hi.z - lo.z) * (0.3 + 0.08 * (i % 5))))
             for i in range(8)]
    return [heart] + motes


def recipe_portal(objs, spec, tier):
    common.tint(objs, (0.25, 0.22, 0.3), 0.4)
    lo, hi = common.bounds(objs)
    void = common.material('void', spec['colour'], emit=0.7)
    cx = (lo.x + hi.x) / 2
    disc = common.add('circle', 'void', void, radius=(hi.x - lo.x) * 0.3, vertices=32, fill_type='NGON',
                      location=(cx, (lo.y + hi.y) / 2, lo.z + (hi.z - lo.z) * 0.42))
    disc.rotation_euler = (math.radians(90), 0, 0)
    disc.scale = (1, 1.35, 1)
    return [disc]


RECIPES = {name[len('recipe_'):]: fn for name, fn in globals().items() if name.startswith('recipe_')}


# ---- Shared staging ------------------------------------------------------------------------


def pedestal(colour, tier):
    stone = common.material('stone', (0.16, 0.17, 0.2), rough=0.9)
    common.add('cylinder', 'pedestal', stone, radius=0.36, depth=0.08, vertices=24, location=(0, 0, -0.04))
    rim = common.material('rim', GOLD if tier >= 2 else colour, emit=0.5 if tier >= 2 else 0.6, metal=0.6, rough=0.3)
    common.add('torus', 'rim', rim, major_radius=0.36, minor_radius=0.022 + 0.01 * (tier - 1), location=(0, 0, 0))
    gem = common.material('gem', colour, emit=1.2)
    for i in range(tier):
        a = math.radians(-90 + (i - (tier - 1) / 2) * 28)
        common.add('uv_sphere', 'gem', gem, radius=0.035, location=(math.cos(a) * 0.36, math.sin(a) * 0.36, 0.03))
    if tier >= 2:
        wood = common.material('wood', (0.35, 0.22, 0.1), rough=0.9)
        common.add('cylinder', 'pole', wood, radius=0.012, depth=0.75, vertices=8, location=(0.26, 0.3, 0.37))
        cloth = common.material('cloth', colour, emit=0.4, rough=0.8)
        flag = common.add('cube', 'flag', cloth, size=1, location=(0.35, 0.3, 0.62))
        flag.scale = (0.18, 0.01, 0.2 if tier == 2 else 0.26)
        common.add('uv_sphere', 'finial', common.material('finial', GOLD, metal=0.9, rough=0.3),
                   radius=0.025, location=(0.26, 0.3, 0.76))


def crown_of_light(objs, colour):
    """Level 3: a halo over the head (returned, to turn with the model) and motes around it."""
    top = max(common.vertices(objs), key=lambda p: p.z)
    halo = common.material('halo', (1.0, 0.8, 0.35), emit=1.5, metal=0.8)
    ring = common.add('torus', 'halo', halo, major_radius=0.13, minor_radius=0.018,
                      location=(top.x, top.y, top.z + 0.08))
    mote = common.material('mote', colour, emit=1.5)
    for i in range(6):
        a = i * math.pi / 3
        common.add('uv_sphere', 'mote', mote, radius=0.02,
                   location=(math.cos(a) * 0.32, math.sin(a) * 0.32, 0.25 + 0.15 * (i % 2)))
    return [ring]


def main():
    args = sys.argv[sys.argv.index('--') + 1:]
    manifest_path, name, tier, out = args[0], args[1], int(args[2]), args[3]
    with open(manifest_path, encoding='utf-8') as f:
        manifest = json.load(f)
    spec = next(s for s in manifest['sprites'] if s['name'] == name)
    models = os.path.join(os.path.dirname(manifest_path), 'models')
    cam = manifest['camera']

    scene = common.reset_scene()
    objs = common.import_model(os.path.join(models, spec['model']))
    if 'textures' in spec:
        common.wire_textures(os.path.join(models, spec['textures']), spec.get('textureAliases', {}))
    common.matte(objs)
    common.pose_idle(objs)

    size = spec['size']
    if spec.get('tiers', 1) > 1:
        size *= {1: 0.78, 2: 0.92, 3: 1.05}[tier]
    root = common.normalise(objs, size)
    if 'recipe' in spec and spec['recipe'] not in RECIPES:
        raise KeyError(f"unknown recipe {spec['recipe']!r} for {name}")
    recipe = RECIPES.get(spec.get('recipe', ''))
    if recipe:
        common.attach(recipe(objs, spec, tier), root)

    colour = tuple(spec['colour'])
    if spec['side'] == 'good':
        if spec.get('pedestal', True):
            pedestal(colour, tier)
        if tier == 3:
            common.attach(crown_of_light(objs, colour), root)
        if spec.get('outline', True):
            common.outline(objs, (0.04, 0.05, 0.03, 1), 0.015)
    elif spec['side'] == 'evil':
        ring = common.material('menace', (0.9, 0.08, 0.15), emit=0.5)
        common.add('torus', 'menace', ring, major_radius=0.32 * spec['size'] / 0.95, minor_radius=0.01,
                   location=(0, 0, 0.004))
        common.outline(objs, (0.12, 0.0, 0.03, 1), 0.012)
    elif spec.get('outline', True):
        common.outline(objs, (0.04, 0.04, 0.06, 1), 0.012)

    root.rotation_euler = (0, 0, math.radians(spec['yaw']))
    common.lights(scene)
    common.camera(scene, cam['elevation'], cam['orthoScale'], cam['targetZ'])
    common.render(scene, out, cam['pixels'])


main()

# Art

The board characters are pre-rendered sprites. Each one starts as a free 3D model (all CC0,
public domain), gets a role-specific set of props in Blender and is rendered with one camera,
one set of lights and one outline, so models from different packs look like one cast.

```
art/models/          the source models, unchanged (CC0)
art/blender/         common.py (scene, camera, lights, outline) and render_sprite.py (recipes)
art/sprites.json     one entry per sprite: model, heading, size, side, colour, levels, recipe
src/assets/sprites/  the sprites the game loads, as WebP (committed; CI never runs Blender)
```

Render with `npm run sprites` (all) or `npm run sprites -- archer ogre` (some). It needs
Blender 4.2 or newer (made with 5.2); set `BLENDER` to its executable if it is not in the default place.
Blender writes PNG to a temporary folder and `scripts/webp.ts` encodes it to WebP at quality 0.85
in headless Chromium (Playwright): a seventh of the PNG weight, with the alpha kept lossless.

## Conventions

- Orthographic camera, 35 degrees above the ground, 1.45 units wide, aimed 0.45 units up;
  256 × 256 px with a transparent background. The renderer relies on these numbers to stand a
  sprite on its tile, so change them together with `src/render`.
- Defenders stand on a stone pedestal ringed in their own colour. Level 2 turns the ring gold
  and adds a banner; level 3 adds a halo and motes. Monsters get a thin red ring on the ground.
- Every defender has its own colour: archer green, druid blue, unicorn violet, ent amber,
  dryad pink, fairy gold.
- The unicorn's levels also differ by the colour of the mane and tail: violet, magenta, then a
  glowing gold.
- Colours in the recipes are linear, as Blender takes them: sRGB 0.5 is about linear 0.21, so a
  dark brown is written as something like (0.08, 0.045, 0.02).

## Sources

Every model is CC0 1.0 (public domain dedication): free for commercial use, no attribution
required. Credit is given anyway.

| File in `art/models/`                      | Original                            | Author     | Source                                                 |
| ------------------------------------------ | ----------------------------------- | ---------- | ------------------------------------------------------ |
| `quaternius-rpg-characters/Ranger.fbx`     | RPG Characters (Nov 2020): Ranger   | Quaternius | https://opengameart.org/content/lowpoly-rpg-characters |
| `quaternius-rpg-characters/Wizard.fbx`     | RPG Characters (Nov 2020): Wizard   | Quaternius | https://opengameart.org/content/lowpoly-rpg-characters |
| `quaternius-rpg-characters/Rogue.fbx`      | RPG Characters (Nov 2020): Rogue    | Quaternius | https://opengameart.org/content/lowpoly-rpg-characters |
| `quaternius-rpg-characters/Cleric.fbx`     | RPG Characters (Nov 2020): Cleric   | Quaternius | https://opengameart.org/content/lowpoly-rpg-characters |
| `quaternius-rpg-characters/textures/*.png` | RPG Characters (Nov 2020): textures | Quaternius | https://opengameart.org/content/lowpoly-rpg-characters |
| `poly-pizza/horse.glb`                     | White Horse                         | Quaternius | https://poly.pizza/m/bEdE4rmZy9                        |
| `poly-pizza/orc.glb`                       | Orc                                 | Quaternius | https://poly.pizza/m/5vO2YJsPEf                        |
| `poly-pizza/spider.glb`                    | Spider                              | Quaternius | https://poly.pizza/m/yRYJiAJyiM                        |
| `poly-pizza/imp.glb`                       | Blue Demon                          | Quaternius | https://poly.pizza/m/S7jYW6Amye                        |
| `poly-pizza/ghost.glb`                     | Ghost                               | Quaternius | https://poly.pizza/m/Iip30bDHmu                        |
| `poly-pizza/mushroom-king.glb`             | Mushroom King                       | Quaternius | https://poly.pizza/m/grnFTziU8u                        |
| `poly-pizza/yeti.glb`                      | Yeti                                | Quaternius | https://poly.pizza/m/ceRHrn8HHE                        |
| `poly-pizza/tree-gnarled.glb`              | Tree                                | Quaternius | https://poly.pizza/m/qZtx0AHhcy                        |
| `poly-pizza/tree-round.glb`                | Tree                                | Quaternius | https://poly.pizza/m/aVOxaHRPWe                        |
| `poly-pizza/hedge.glb`                     | Hedge                               | Quaternius | https://poly.pizza/m/df8uCl1YpK                        |
| `poly-pizza/arch-round.glb`                | Arch Round                          | Quaternius | https://poly.pizza/m/B9QABewqLv                        |

The licence text of the RPG pack is in `models/quaternius-rpg-characters/LICENSE.txt`. Poly
Pizza states the licence on each model page. More of Quaternius's work:
https://quaternius.com.

The props added in Blender (horn, banner, halo, wings, crown, thorns, portal and so on) and the
rendered sprites are part of this repository and are released under its MIT licence.

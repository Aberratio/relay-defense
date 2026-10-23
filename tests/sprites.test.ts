import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ENEMY_KINDS, TOWER_KINDS } from '../src/engine/types';
import { ENEMY_ART, SCENERY_ART, TOWER_ART, towerSprite } from '../src/render/art';
import { spriteFiles, type Manifest } from '../scripts/sprites';

interface Spec {
  name: string;
  model: string;
  tiers?: number;
}

const manifest = JSON.parse(readFileSync('art/sprites.json', 'utf8')) as Manifest & {
  sprites: Spec[];
};
const byName = new Map(manifest.sprites.map((s) => [s.name, s]));

describe('sprites', () => {
  it('has a rendered file for everything the manifest describes', () => {
    for (const file of spriteFiles(manifest))
      expect(existsSync(`src/assets/sprites/${file}`), file).toBe(true);
  });

  it('gives every agent a sprite per level and every fault a sprite', () => {
    for (const kind of TOWER_KINDS) {
      const art = TOWER_ART[kind];
      expect(byName.get(art.sprite)?.tiers ?? 1, kind).toBe(art.tiers);
      for (let level = 0; level < art.tiers; level++)
        expect(existsSync(`src/assets/sprites/${towerSprite(kind, level)}.png`)).toBe(true);
    }
    for (const kind of ENEMY_KINDS) expect(byName.has(ENEMY_ART[kind].sprite), kind).toBe(true);
    for (const name of Object.values(SCENERY_ART)) expect(byName.has(name), name).toBe(true);
  });

  it('uses only models that are in the repository and credited in the art README', () => {
    const credits = readFileSync('art/README.md', 'utf8');
    for (const spec of manifest.sprites) {
      expect(existsSync(`art/models/${spec.model}`), spec.model).toBe(true);
      expect(credits.includes(spec.model), `${spec.model} credited`).toBe(true);
    }
  });
});

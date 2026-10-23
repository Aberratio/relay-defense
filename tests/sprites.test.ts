import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
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

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

describe('sprites', () => {
  it('has a rendered file for everything the manifest describes', () => {
    for (const file of spriteFiles(manifest))
      expect(existsSync(`src/assets/sprites/${file}`), file).toBe(true);
  });

  it('gives every agent a sprite per level and every fault and scenery piece one sprite', () => {
    for (const kind of TOWER_KINDS) {
      const art = TOWER_ART[kind];
      expect(byName.has(art.sprite), kind).toBe(true);
      expect(byName.get(art.sprite)?.tiers ?? 1, kind).toBe(art.tiers);
      for (let level = 0; level < art.tiers; level++)
        expect(existsSync(`src/assets/sprites/${towerSprite(kind, level)}.png`)).toBe(true);
    }
    const single = [...ENEMY_KINDS.map((k) => ENEMY_ART[k].sprite), ...Object.values(SCENERY_ART)];
    for (const name of single) {
      expect(byName.has(name), name).toBe(true);
      expect(byName.get(name)?.tiers ?? 1, name).toBe(1);
    }
  });

  it('credits every source model and uses only models in the repository', () => {
    const credits = readFileSync('art/README.md', 'utf8');
    for (const path of files('art/models')) {
      const rel = relative('art/models', path).replaceAll('\\', '/');
      if (rel.endsWith('LICENSE.txt')) continue;
      const dirGlob = rel.replace(/[^/]+$/, '*') + rel.slice(rel.lastIndexOf('.'));
      expect(credits.includes(rel) || credits.includes(dirGlob), `${rel} credited`).toBe(true);
    }
    for (const spec of manifest.sprites)
      expect(existsSync(`art/models/${spec.model}`), spec.model).toBe(true);
  });
});

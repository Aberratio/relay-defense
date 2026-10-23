import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ENEMY_KINDS, TOWER_KINDS } from '../src/engine/types';
import { ENEMY_ART, SCENERY_ART, TOWER_ART, levelSprites, towerSprite } from '../src/render/art';
import { ELEVATION, FRAME, TARGET_Z } from '../src/render/sprite-cache';
import { LEVELS } from '../src/levels/levels';
import { spriteFiles } from '../scripts/sprites';

interface Spec {
  name: string;
  model: string;
  tiers?: number;
  size: number;
  colour: [number, number, number];
}

const hex = (c: number[]) =>
  `#${c
    .map((v) =>
      Math.round(v * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;

const manifest = JSON.parse(readFileSync('art/sprites.json', 'utf8')) as {
  camera: { elevation: number; orthoScale: number; targetZ: number };
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

  it('repeats the manifest colours and sizes the renderer depends on', () => {
    for (const kind of TOWER_KINDS)
      expect(TOWER_ART[kind].colour, kind).toBe(hex(byName.get(TOWER_ART[kind].sprite)!.colour));
    for (const kind of ENEMY_KINDS) {
      const spec = byName.get(ENEMY_ART[kind].sprite)!;
      expect(ENEMY_ART[kind].size, kind).toBe(spec.size);
      expect(ENEMY_ART[kind].colour, kind).toBe(hex(spec.colour));
    }
    expect([ELEVATION, FRAME, TARGET_Z]).toEqual([
      manifest.camera.elevation,
      manifest.camera.orthoScale,
      manifest.camera.targetZ,
    ]);
  });

  it('lists a rendered file for every sprite a level can show', () => {
    for (const level of LEVELS)
      for (const name of levelSprites(level))
        expect(existsSync(`src/assets/sprites/${name}.png`), `${level.id} ${name}`).toBe(true);
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

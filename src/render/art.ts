// Which pre-rendered sprite (src/assets/sprites, made by `npm run sprites`) stands for each
// agent and fault. Defenders have one image per level; walls, faults and scenery have one.
import type { EnemyKind, TowerKind } from '../engine/types';

export const TOWER_ART: Record<TowerKind, { sprite: string; tiers: number }> = {
  pulse: { sprite: 'archer', tiers: 3 },
  arc: { sprite: 'druid', tiers: 3 },
  lance: { sprite: 'unicorn', tiers: 3 },
  mortar: { sprite: 'ent', tiers: 3 },
  throttle: { sprite: 'dryad', tiers: 3 },
  beacon: { sprite: 'fairy', tiers: 3 },
  wall: { sprite: 'thorns', tiers: 1 },
};

export const ENEMY_ART: Record<EnemyKind, { sprite: string }> = {
  spark: { sprite: 'goblin' },
  mite: { sprite: 'spiderling' },
  bulwark: { sprite: 'troll' },
  phantom: { sprite: 'wraith' },
  splitter: { sprite: 'brood' },
  mender: { sprite: 'shaman' },
  colossus: { sprite: 'ogre' },
};

export const SCENERY_ART = { core: 'heart-tree', gate: 'portal' } as const;

/** File name (without extension) of a tower's sprite at a level (0-based). */
export function towerSprite(kind: TowerKind, level: number): string {
  const art = TOWER_ART[kind];
  return art.tiers > 1
    ? `${art.sprite}-${Math.max(0, Math.min(level, art.tiers - 1)) + 1}`
    : art.sprite;
}

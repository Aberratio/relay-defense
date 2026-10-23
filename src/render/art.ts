// Which pre-rendered sprite (src/assets/sprites, made by `npm run sprites`) stands for each
// agent and fault. Defenders have one image per level; walls, faults and scenery have one.
// `colour` and `size` repeat values from art/sprites.json (a test keeps them in step).
import type { EnemyKind, LevelDef, TowerKind } from '../engine/types';

export interface TowerArt {
  sprite: string;
  tiers: number;
  /** The defender's own colour: pedestal ring, range ring, its shots. */
  colour: string;
  /** The sprite looks left; all others look right. */
  facesLeft?: boolean;
}

export const TOWER_ART: Record<TowerKind, TowerArt> = {
  pulse: { sprite: 'archer', tiers: 3, colour: '#40d959' },
  arc: { sprite: 'druid', tiers: 3, colour: '#4d99ff' },
  lance: { sprite: 'unicorn', tiers: 3, colour: '#bf73ff', facesLeft: true },
  mortar: { sprite: 'ent', tiers: 3, colour: '#ff8c26' },
  throttle: { sprite: 'dryad', tiers: 3, colour: '#ff73bf' },
  beacon: { sprite: 'fairy', tiers: 3, colour: '#ffeb66' },
  wall: { sprite: 'thorns', tiers: 1, colour: '#731f1a' },
};

export interface EnemyArt {
  sprite: string;
  /** Model size the sprite was rendered at; its red ground ring has radius 0.32 * size / 0.95. */
  size: number;
  /** The fault's tint: its burst when it falls. */
  colour: string;
}

export const ENEMY_ART: Record<EnemyKind, EnemyArt> = {
  spark: { sprite: 'goblin', size: 0.7, colour: '#598c33' },
  mite: { sprite: 'spiderling', size: 0.45, colour: '#8c5933' },
  bulwark: { sprite: 'troll', size: 0.95, colour: '#384729' },
  phantom: { sprite: 'wraith', size: 0.8, colour: '#594080' },
  splitter: { sprite: 'brood', size: 0.95, colour: '#b3c780' },
  mender: { sprite: 'shaman', size: 0.8, colour: '#734099' },
  colossus: { sprite: 'ogre', size: 1.0, colour: '#73381f' },
};

export const SCENERY_ART = { core: 'heart-tree', gate: 'portal' } as const;

/** File name (without extension) of a tower's sprite at a level (0-based). */
export function towerSprite(kind: TowerKind, level: number): string {
  const art = TOWER_ART[kind];
  return art.tiers > 1
    ? `${art.sprite}-${Math.max(0, Math.min(level, art.tiers - 1)) + 1}`
    : art.sprite;
}

/** Radius of a fault sprite's ground ring, in model units. */
export function enemyRing(kind: EnemyKind): number {
  return (0.32 * ENEMY_ART[kind].size) / 0.95;
}

/** Every sprite a level can show: its defenders at every level, its faults, gates and core. */
export function levelSprites(level: LevelDef): string[] {
  const names = new Set<string>([SCENERY_ART.core, SCENERY_ART.gate]);
  for (const kind of level.towers)
    for (let l = 0; l < TOWER_ART[kind].tiers; l++) names.add(towerSprite(kind, l));
  for (const wave of level.waves)
    for (const group of wave.groups) {
      names.add(ENEMY_ART[group.enemy].sprite);
      // a falling Brood Mother releases Spiderlings
      if (group.enemy === 'splitter') names.add(ENEMY_ART.mite.sprite);
    }
  return [...names];
}

// Shared types of the simulation. The engine is pure TypeScript with no DOM access, so the same
// code runs in the browser, in the tests and in the command-line tools (scripts/).

export const TOWER_KINDS = [
  'pulse',
  'arc',
  'lance',
  'mortar',
  'throttle',
  'beacon',
  'wall',
] as const;
export type TowerKind = (typeof TOWER_KINDS)[number];

export const ENEMY_KINDS = [
  'spark',
  'mite',
  'bulwark',
  'phantom',
  'splitter',
  'mender',
  'colossus',
] as const;
export type EnemyKind = (typeof ENEMY_KINDS)[number];

/** Which enemy in range a tower shoots at. */
export const TARGET_MODES = ['first', 'last', 'strong', 'weak'] as const;
export type TargetMode = (typeof TARGET_MODES)[number];

export interface Cell {
  x: number;
  y: number;
}

export interface Point {
  x: number;
  y: number;
}

/**
 * Map tiles, one character each:
 * `.` floor (walkable, buildable), `#` rock (neither), `=` lane (walkable only),
 * `^` pad (buildable only), `S` spawn, `C` core.
 */
export type TileChar = '.' | '#' | '=' | '^' | 'S' | 'C';

export interface SpawnGroup {
  enemy: EnemyKind;
  count: number;
  /** Seconds between two enemies of the group. */
  gap: number;
  /** Seconds after the wave starts before the first enemy of the group. */
  delay?: number;
  /** Index of the spawn (reading order of `S` on the map). Default 0. */
  spawn?: number;
  /** Hit point multiplier for this group. Default 1. */
  hp?: number;
}

export interface Wave {
  groups: SpawnGroup[];
}

export interface LevelDef {
  id: string;
  /** Rows of the map, all the same length. See `TileChar`. */
  map: string[];
  credits: number;
  lives: number;
  /** Difficulty: multiplies the hit points of every enemy in the level. Default 1. */
  hpScale?: number;
  towers: TowerKind[];
  waves: Wave[];
  /** Credits paid when a wave is cleared: `base + perWave * waveIndex`. */
  waveBonus: { base: number; perWave: number };
}

export type Phase = 'build' | 'wave' | 'won' | 'lost';

/**
 * Why a tower cannot go on a tile (or come off it). `wave`: the maze on walkable floor only changes
 * between waves, so faults cannot be juggled back and forth by opening and closing gaps.
 */
export type PlaceError = 'tile' | 'occupied' | 'blocks' | 'funds' | 'locked' | 'over' | 'wave';

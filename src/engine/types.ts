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
  /** Siege chapters only: what makes this chapter harder, and what is coming later. */
  hazards?: Hazards;
}

/**
 * The hardships of a Siege chapter. Everything that will change later in the campaign is on the
 * board from the start, so nothing is hidden and the placement rule can keep it fair.
 */
export interface Hazards {
  /** Spawns (by index) that send nothing yet. They count for the placement rule all the same. */
  dormant?: number[];
  /**
   * Lane cells that collapse into rock in a later chapter. A placement is refused when it would
   * leave a spawn cut off from the core once they are gone.
   */
  cracked?: Cell[];
  /** Cells under fog: a tower standing on one reaches only `FOG_RANGE` of its range. */
  fog?: Cell[];
  /** Cells that fall under fog in a later chapter: shown, with no effect yet. */
  fogLater?: Cell[];
  /** Added to the armour of every enemy. */
  armour?: number;
}

/** A defender carried into the next Siege chapter. */
export interface CarriedTower {
  kind: TowerKind;
  x: number;
  y: number;
  level: number;
  mode: TargetMode;
}

/** What one Siege chapter hands to the next: the gold and the defenders on the board. */
export interface Carry {
  credits: number;
  towers: CarriedTower[];
}

export type Phase = 'build' | 'wave' | 'won' | 'lost';

/**
 * Why a tower cannot go on a tile (or come off it). `wave`: the maze on walkable floor only changes
 * between waves, so faults cannot be juggled back and forth by opening and closing gaps.
 */
export type PlaceError = 'tile' | 'occupied' | 'blocks' | 'funds' | 'locked' | 'over' | 'wave';

import type { EnemyKind, TowerKind } from './types';

/** Simulation rate. Every duration in the data is in seconds and converted with it. */
export const TICK_RATE = 30;
export const DT = 1 / TICK_RATE;

/** Share of the invested credits returned on a sale (an undo in the same build phase returns all). */
export const SELL_REFUND = 0.7;

/** Share of its range a tower keeps when it stands in fog (Siege). */
export const FOG_RANGE = 0.7;

/** Armour never reduces a hit below this share of its damage. */
export const ARMOUR_FLOOR = 0.25;

export interface TowerLevel {
  /** Credits to build (level 0) or to upgrade into this level. */
  cost: number;
  damage: number;
  /** Shots per second. */
  rate: number;
  range: number;
  /** Arc: how many enemies one discharge reaches. Mortar: blast radius. Throttle: speed cut. */
  special: number;
}

export interface TowerSpec {
  levels: [TowerLevel, ...TowerLevel[]];
  /** Ignores armour. */
  pierceArmour?: boolean;
  /** Cannot fire at enemies closer than this (Mortar). */
  minRange?: number;
  /** Has no target and no targeting mode (Throttle, Beacon, Wall). */
  passive?: boolean;
  /** Blocks walking but is not a real tower (no upgrades). */
  blocker?: boolean;
}

export const TOWERS: Record<TowerKind, TowerSpec> = {
  // Cheap, steady single-target damage. Weak against armour.
  pulse: {
    levels: [
      { cost: 35, damage: 7, rate: 2.5, range: 2.6, special: 0 },
      { cost: 30, damage: 11, rate: 2.5, range: 2.8, special: 0 },
      { cost: 45, damage: 16, rate: 3.2, range: 3.0, special: 0 },
    ],
  },
  // Chain discharge: jumps between enemies standing close together. Answers swarms.
  arc: {
    levels: [
      { cost: 65, damage: 9, rate: 1.0, range: 2.4, special: 4 },
      { cost: 45, damage: 13, rate: 1.0, range: 2.5, special: 5 },
      { cost: 70, damage: 18, rate: 1.1, range: 2.6, special: 6 },
    ],
  },
  // Rail beam: hits everything on the line up to its range and ignores armour. Slow.
  lance: {
    pierceArmour: true,
    levels: [
      { cost: 90, damage: 55, rate: 0.45, range: 4.5, special: 0 },
      { cost: 70, damage: 85, rate: 0.45, range: 5.0, special: 0 },
      { cost: 100, damage: 130, rate: 0.5, range: 5.5, special: 0 },
    ],
  },
  // Lobbed shell with a blast. Leads its target along the route; cannot hit close by.
  mortar: {
    minRange: 1.5,
    levels: [
      { cost: 80, damage: 20, rate: 0.6, range: 3.8, special: 1.0 },
      { cost: 60, damage: 30, rate: 0.6, range: 4.2, special: 1.15 },
      { cost: 85, damage: 44, rate: 0.65, range: 4.6, special: 1.3 },
    ],
  },
  // Slow field. Does not stack with another Throttle: the strongest one applies.
  throttle: {
    passive: true,
    levels: [
      { cost: 50, damage: 0, rate: 0, range: 1.8, special: 0.35 },
      { cost: 40, damage: 0, rate: 0, range: 2.1, special: 0.5 },
      { cost: 60, damage: 0, rate: 0, range: 2.4, special: 0.6 },
    ],
  },
  // Reveals cloaked enemies in range and boosts the damage of the 8 neighbouring towers.
  // Boosts from several Beacons add up. `special` is the damage bonus.
  beacon: {
    passive: true,
    levels: [
      { cost: 45, damage: 0, rate: 0, range: 2.5, special: 0.15 },
      { cost: 40, damage: 0, rate: 0, range: 3.0, special: 0.25 },
      { cost: 55, damage: 0, rate: 0, range: 3.5, special: 0.35 },
    ],
  },
  // A plain block for building mazes on open floor.
  wall: {
    passive: true,
    blocker: true,
    levels: [{ cost: 10, damage: 0, rate: 0, range: 0, special: 0 }],
  },
};

export interface EnemySpec {
  hp: number;
  /** Cells per second. */
  speed: number;
  armour: number;
  bounty: number;
  /** Lives lost when it reaches the core. */
  leak: number;
  /** Hit radius in cells. */
  radius: number;
  cloaked?: boolean;
  /** Mender: hit points per second given to other enemies within `healRange`. */
  heal?: number;
  healRange?: number;
  /** Splitter: what it breaks into. */
  splitInto?: { enemy: EnemyKind; count: number };
  /** Share of a slow that is ignored (0 = full slow, 1 = immune). */
  slowResist?: number;
  /** Colossus: armour added to other enemies within `auraRange`. */
  aura?: number;
  auraRange?: number;
}

export const ENEMIES: Record<EnemyKind, EnemySpec> = {
  spark: { hp: 32, speed: 1.5, armour: 0, bounty: 4, leak: 1, radius: 0.22 },
  mite: { hp: 11, speed: 2.3, armour: 0, bounty: 1, leak: 1, radius: 0.15 },
  bulwark: { hp: 140, speed: 0.85, armour: 6, bounty: 10, leak: 2, radius: 0.32 },
  phantom: { hp: 50, speed: 1.7, armour: 0, bounty: 7, leak: 1, radius: 0.22, cloaked: true },
  splitter: {
    hp: 90,
    speed: 1.15,
    armour: 0,
    bounty: 6,
    leak: 2,
    radius: 0.3,
    splitInto: { enemy: 'mite', count: 3 },
  },
  mender: {
    hp: 75,
    speed: 1.2,
    armour: 0,
    bounty: 9,
    leak: 1,
    radius: 0.26,
    heal: 8,
    healRange: 1.6,
  },
  colossus: {
    hp: 1500,
    speed: 0.55,
    armour: 10,
    bounty: 80,
    leak: 10,
    radius: 0.45,
    slowResist: 0.5,
    aura: 4,
    auraRange: 1.5,
  },
};

/** Total credits put into a tower up to and including `level`. */
export function invested(kind: TowerKind, level: number): number {
  return TOWERS[kind].levels.slice(0, level + 1).reduce((sum, l) => sum + l.cost, 0);
}

/** Damage after armour: armour cuts each hit flatly, down to a floor share of the hit. */
export function afterArmour(damage: number, armour: number, pierce: boolean): number {
  if (pierce || armour <= 0) return damage;
  return Math.max(damage - armour, damage * ARMOUR_FLOOR);
}

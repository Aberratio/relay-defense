import { replay, type Solution } from '../engine/replay';
import { ENEMIES } from '../engine/stats';
import type { EnemyKind, LevelDef, SpawnGroup, TowerKind, Wave } from '../engine/types';
import { levelById } from './levels';
import { SIEGE } from './siege';

// The duel (D-050): two players each build a defence and compose waves against the other's
// defence; whoever takes more lives from the rival's Heart Tree wins. A defence is the actions a
// player took in a sparring run against the visible sparring waves of the map. Everything here is
// pure data and rules, so the solver, the tests and both players' browsers agree on the result.

/** Bumped whenever a change would give an old duel link a different result. */
export const DUEL_VERSION = 1;
/** Gold for each side: the defence starts with it, the attack spends it on all its waves. */
export const DUEL_BUDGET = 560;
/** Gold per bounty point at hit points x1: a monster costs half of what killing it pays. */
export const DUEL_RATE = 0.5;
export const DUEL_WAVE_COUNT = 4;
/** Lives in the sparring run (the rival's waves are scored without a limit, see `score`). */
export const DUEL_LIVES = 20;
/**
 * The life pool of a scored replay. A lost Heart Tree would end the game and cap the score, so
 * the replay runs with more lives than any attack can take: 560 gold buys at most 1 120
 * Spiderlings.
 */
export const SCORE_POOL = 10_000;

export const MAX_GROUPS = 4;
export const MAX_COUNT = 500;
export const HP_STEPS = [1, 1.5, 2, 3, 4] as const;
export const GAP_STEPS = [0.12, 0.3, 0.6, 1, 1.5] as const;
export const DELAY_STEPS = [0, 2, 4, 8] as const;

export const DUEL_MAP_IDS = ['siege', 'two-fronts', 'colossus'] as const;
export type DuelMapId = (typeof DUEL_MAP_IDS)[number];

export function isDuelMap(value: unknown): value is DuelMapId {
  return typeof value === 'string' && (DUEL_MAP_IDS as readonly string[]).includes(value);
}

const TOWERS: TowerKind[] = ['pulse', 'arc', 'lance', 'mortar', 'throttle', 'beacon', 'wall'];

function mapOf(id: DuelMapId): string[] {
  // The Siege meadow with both portals open and no hardship; the other two are their levels' maps.
  if (id === 'siege') return SIEGE.map;
  const level = levelById(id);
  if (!level) throw new Error(`no level "${id}"`);
  return level.map;
}

function g(
  enemy: EnemyKind,
  count: number,
  gap: number,
  spawn: number,
  hp = 1,
  delay = 0,
): SpawnGroup {
  return { enemy, count, gap, spawn, hp, delay };
}

/**
 * The sparring waves, the same on every map: the mixed reference attack of the duel measurement
 * (research/2026-10-24-pojedynek-pomiary.md), priced at the duel rate. Costs 546 of 560 gold.
 */
const SPARRING: Wave[] = [
  { groups: [g('phantom', 12, 0.6, 0), g('spark', 21, 0.6, 1)] },
  { groups: [g('bulwark', 11, 1, 0), g('mite', 112, 0.12, 1)] },
  { groups: [g('phantom', 16, 0.6, 1, 1.5), g('splitter', 18, 1, 0)] },
  {
    groups: [
      g('bulwark', 8, 1, 0, 1.5),
      g('phantom', 12, 0.3, 1, 1.5),
      g('mender', 14, 1.5, 0, 1, 2),
    ],
  },
];

export function sparringWaves(): Wave[] {
  return structuredClone(SPARRING);
}

export function duelLevelId(map: DuelMapId): string {
  return `duel-${map}`;
}

/** A duel map as an ordinary level with the given waves. */
export function duelLevel(map: DuelMapId, waves: Wave[], lives = DUEL_LIVES): LevelDef {
  return {
    id: duelLevelId(map),
    map: mapOf(map),
    credits: DUEL_BUDGET,
    lives,
    hpScale: 1,
    towers: TOWERS,
    waves,
    waveBonus: { base: 25, perWave: 5 },
  };
}

/** The sparring run of a map: the level a defence is recorded in. */
export function sparringLevel(map: DuelMapId): LevelDef {
  return duelLevel(map, sparringWaves());
}

export function sparringById(id: string): LevelDef | undefined {
  const map = DUEL_MAP_IDS.find((m) => duelLevelId(m) === id);
  return map ? sparringLevel(map) : undefined;
}

/** What one monster is worth in bounty points: a Brood Mother pays for her Spiderlings too. */
export function bountyValue(kind: EnemyKind): number {
  const spec = ENEMIES[kind];
  const split = spec.splitInto;
  return spec.bounty + (split ? split.count * ENEMIES[split.enemy].bounty : 0);
}

/** Gold for a group, rounded up to whole gold. */
export function groupCost(group: SpawnGroup): number {
  // Rounded to 1e-9 first so 0.1-style float noise never adds a gold.
  const exact = group.count * bountyValue(group.enemy) * (group.hp ?? 1) * DUEL_RATE;
  return Math.ceil(Math.round(exact * 1e9) / 1e9);
}

export function attackCost(waves: Wave[]): number {
  return waves.reduce((sum, w) => sum + w.groups.reduce((s, grp) => s + groupCost(grp), 0), 0);
}

/** Why an attack is not allowed, or null. Every field comes from a link, so nothing is trusted. */
export type AttackError =
  'waves' | 'groups' | 'enemy' | 'count' | 'hp' | 'gap' | 'delay' | 'spawn' | 'budget';

const KINDS = Object.keys(ENEMIES);

export function validateAttack(waves: Wave[]): AttackError | null {
  if (waves.length !== DUEL_WAVE_COUNT) return 'waves';
  for (const w of waves) {
    if (w.groups.length < 1 || w.groups.length > MAX_GROUPS) return 'groups';
    for (const grp of w.groups) {
      if (!KINDS.includes(grp.enemy)) return 'enemy';
      if (!Number.isInteger(grp.count) || grp.count < 1 || grp.count > MAX_COUNT) return 'count';
      if (!(HP_STEPS as readonly number[]).includes(grp.hp ?? 1)) return 'hp';
      if (!(GAP_STEPS as readonly number[]).includes(grp.gap)) return 'gap';
      if (!(DELAY_STEPS as readonly number[]).includes(grp.delay ?? 0)) return 'delay';
      // Every duel map has two portals.
      if (grp.spawn !== 0 && grp.spawn !== 1) return 'spawn';
    }
  }
  return attackCost(waves) > DUEL_BUDGET ? 'budget' : null;
}

export interface Bout {
  /** Lives the attack took from the defence's Heart Tree, without a limit. */
  taken: number;
  /** Defence actions refused because the gold ran short against these waves. */
  skipped: number;
}

/** One defence against one attack, played to the end of the last wave. */
export function score(map: DuelMapId, defence: Solution, attack: Wave[]): Bout {
  const level = duelLevel(map, attack, SCORE_POOL);
  const result = replay(level, { ...defence, level: level.id });
  return { taken: SCORE_POOL - result.lives, skipped: result.rejected.length };
}

export interface Side {
  defence: Solution;
  attack: Wave[];
}

export interface Rematch {
  /** What the challenger's waves took from the rival's defence. */
  challenger: Bout;
  /** What the rival's waves took from the challenger's defence. */
  rival: Bout;
  winner: 'challenger' | 'rival' | 'draw';
}

/** Both bouts of a duel: each side's waves against the other side's defence. */
export function rematch(map: DuelMapId, challenger: Side, rival: Side): Rematch {
  const c = score(map, rival.defence, challenger.attack);
  const r = score(map, challenger.defence, rival.attack);
  const winner = c.taken > r.taken ? 'challenger' : c.taken < r.taken ? 'rival' : 'draw';
  return { challenger: c, rival: r, winner };
}

// The bestiary: a card for every defender and monster, found the first time the character shows
// up on the board. Saved under its own key, so the older saves never change shape; a guest who
// won levels before the bestiary existed gets the cards of those levels from the progress save.
import { ENEMY_KINDS, TOWER_KINDS, type EnemyKind, type TowerKind } from '../engine/types';
import { LEVELS } from '../levels/levels';
import { BESTIARY_KEY, safeStorage, type Progress } from './progress';

export { BESTIARY_KEY };

export interface Bestiary {
  towers: TowerKind[];
  enemies: EnemyKind[];
}

export const EMPTY_BESTIARY: Bestiary = { towers: [], enemies: [] };

/**
 * The defenders that answer each monster, as its card states them. Every monster has at least
 * one answer available in the level where it is met first (tests/bestiary.test.ts).
 */
export const COUNTERS: Record<EnemyKind, readonly TowerKind[]> = {
  spark: ['pulse'],
  mite: ['arc', 'mortar'],
  bulwark: ['lance', 'mortar'],
  phantom: ['beacon'],
  splitter: ['mortar', 'throttle', 'arc'],
  mender: ['lance', 'mortar'],
  colossus: ['lance', 'beacon'],
};

/** The monsters a defender answers: the monster cards read the other way round. */
export function answers(tower: TowerKind): EnemyKind[] {
  return ENEMY_KINDS.filter((enemy) => COUNTERS[enemy].includes(tower));
}

/** The index of the first of the ten levels where a character appears, or -1. */
export function firstLevel(kind: TowerKind | EnemyKind): number {
  return LEVELS.findIndex(
    (level) =>
      (level.towers as readonly string[]).includes(kind) ||
      level.waves.some((w) => w.groups.some((g) => g.enemy === kind)),
  );
}

function pick<K extends string>(kinds: readonly K[], value: unknown): K[] {
  if (!Array.isArray(value)) return [];
  return kinds.filter((k) => value.includes(k));
}

export function loadBestiary(storage: Pick<Storage, 'getItem'> | null = safeStorage()): Bestiary {
  try {
    const raw = storage?.getItem(BESTIARY_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return EMPTY_BESTIARY;
    const { towers, enemies } = parsed as Record<string, unknown>;
    return { towers: pick(TOWER_KINDS, towers), enemies: pick(ENEMY_KINDS, enemies) };
  } catch {
    return EMPTY_BESTIARY;
  }
}

/** Every card found in either, in roster order. */
export function mergeBestiary(a: Partial<Bestiary>, b: Partial<Bestiary>): Bestiary {
  const towers = new Set([...(a.towers ?? []), ...(b.towers ?? [])]);
  const enemies = new Set([...(a.enemies ?? []), ...(b.enemies ?? [])]);
  return {
    towers: TOWER_KINDS.filter((k) => towers.has(k)),
    enemies: ENEMY_KINDS.filter((k) => enemies.has(k)),
  };
}

/**
 * Records the characters just met. Another tab or frame may have found cards since this one
 * loaded, so the stored bestiary is read again and merged first; nothing is written when no card
 * is new. Returns the updated bestiary.
 */
export function recordFound(
  bestiary: Bestiary,
  found: Partial<Bestiary>,
  storage: Pick<Storage, 'getItem' | 'setItem'> | null = safeStorage(),
): Bestiary {
  const stored = loadBestiary(storage);
  const next = mergeBestiary(mergeBestiary(stored, bestiary), found);
  if (next.towers.length === stored.towers.length && next.enemies.length === stored.enemies.length)
    return next;
  try {
    storage?.setItem(BESTIARY_KEY, JSON.stringify(next));
  } catch {
    // Storage is full or blocked: the cards still count for this session.
  }
  return next;
}

/** The cards of every level won: what a player who won them has met for sure. */
export function foundInWins(progress: Progress): Bestiary {
  const won = LEVELS.filter((level) => (progress[level.id] ?? 0) > 0);
  return mergeBestiary(EMPTY_BESTIARY, {
    towers: won.flatMap((l) => l.towers),
    enemies: won.flatMap((l) => l.waves.flatMap((w) => w.groups.map((g) => g.enemy))),
  });
}

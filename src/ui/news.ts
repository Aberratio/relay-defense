// What a finished level changed, for its result dialog: a better result than the saved one, the
// level the win opened and what waits there, the cards found on the way. Derived from the saves
// before and after, so it needs nothing new in them.
import { ENEMY_KINDS, TOWER_KINDS } from '../engine/types';
import { LEVELS } from '../levels/levels';
import { firstLevel, type Bestiary } from './bestiary';
import type { Progress } from './progress';
import { isUnlocked } from './unlock';

/** A saved win beaten, or null: a first win is not a record. */
export function newBest(before: number, after: number): { from: number; to: number } | null {
  return before > 0 && after > before ? { from: before, to: after } : null;
}

/**
 * The index of the level this result opened: locked before, open after and not won (a level won
 * out of order through ?level= opens itself), or null.
 */
export function openedBy(before: Progress, after: Progress, all: boolean): number | null {
  if (all) return null;
  const ids = LEVELS.map((l) => l.id);
  const i = ids.findIndex(
    (id, n) =>
      !(id in after) && !isUnlocked(n, ids, before, false) && isUnlocked(n, ids, after, false),
  );
  return i >= 0 ? i : null;
}

/** The characters a level brings in for the first time. */
export function introducedIn(index: number): Bestiary {
  return {
    towers: TOWER_KINDS.filter((k) => firstLevel(k) === index),
    enemies: ENEMY_KINDS.filter((k) => firstLevel(k) === index),
  };
}

/** The cards in `after` that `before` did not have, in roster order. */
export function newCards(before: Bestiary, after: Bestiary): Bestiary {
  return {
    towers: TOWER_KINDS.filter((k) => after.towers.includes(k) && !before.towers.includes(k)),
    enemies: ENEMY_KINDS.filter((k) => after.enemies.includes(k) && !before.enemies.includes(k)),
  };
}

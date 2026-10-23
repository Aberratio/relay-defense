// Which levels are open. The first FREE_LEVELS are open from the start; every later level opens
// once the one before it is won. A won level is one with a saved result (only wins are saved), so
// the rule needs nothing new in the save: players who already won levels find them open, and a
// level won is always open.
import type { Progress } from './progress';

export const FREE_LEVELS = 3;

export function isUnlocked(
  index: number,
  ids: readonly string[],
  progress: Progress,
  all: boolean,
): boolean {
  if (index < 0 || index >= ids.length) return false;
  if (all || index < FREE_LEVELS) return true;
  // A level already won stays open, also one won out of order (through ?level=).
  const id = ids[index];
  if (id !== undefined && id in progress) return true;
  const before = ids[index - 1];
  return before !== undefined && before in progress;
}

/** The level to play next: the first open level not won yet, or null when every level is won. */
export function nextLevel(ids: readonly string[], progress: Progress, all: boolean): number | null {
  const i = ids.findIndex((id, n) => !(id in progress) && isUnlocked(n, ids, progress, all));
  return i >= 0 ? i : null;
}

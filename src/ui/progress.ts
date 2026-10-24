// Best result per level, kept in the browser. Storage can be missing or blocked (private mode,
// a sandboxed frame), so every access is guarded and the game works without it.
import { TARGET_MODES, TOWER_KINDS, type Carry } from '../engine/types';

const KEY = 'relay-defense:progress:v1';

export type Progress = Record<string, number>;

export function starsFor(lives: number, maxLives: number): number {
  if (lives <= 0) return 0;
  if (lives >= maxLives) return 3;
  return lives * 2 >= maxLives ? 2 : 1;
}

export function loadProgress(storage: Pick<Storage, 'getItem'> | null = safeStorage()): Progress {
  try {
    const raw = storage?.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Progress = {};
    for (const [id, stars] of Object.entries(parsed)) {
      if (typeof stars === 'number' && stars >= 0 && stars <= 3) out[id] = Math.floor(stars);
    }
    return out;
  } catch {
    return {};
  }
}

/** The better of two saves, level by level. */
export function mergeProgress(a: Progress, b: Progress): Progress {
  const out = { ...a };
  for (const [id, stars] of Object.entries(b)) out[id] = Math.max(out[id] ?? 0, stars);
  return out;
}

/**
 * Records a result; keeps the best. Another tab or frame on this origin may have saved since this
 * one loaded, so the stored progress is read again and merged first. Returns the updated progress.
 */
export function recordResult(
  progress: Progress,
  levelId: string,
  stars: number,
  storage: Pick<Storage, 'getItem' | 'setItem'> | null = safeStorage(),
): Progress {
  const next = mergeProgress(mergeProgress(loadProgress(storage), progress), { [levelId]: stars });
  try {
    storage?.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage is full or blocked: the result still counts for this session.
  }
  return next;
}

/** Whether every level in `ids` has a saved win (any number of stars). */
export function allCleared(ids: readonly string[], progress: Progress): boolean {
  return ids.every((id) => id in progress);
}

// ---- Unlock all ------------------------------------------------------------------------------

const UNLOCK_ALL_KEY = 'relay-defense:unlock-all:v1';

/** Whether the player opened every level from the help, skipping the unlock path. */
export function loadUnlockAll(storage: Pick<Storage, 'getItem'> | null = safeStorage()): boolean {
  try {
    return storage?.getItem(UNLOCK_ALL_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveUnlockAll(
  on: boolean,
  storage: Pick<Storage, 'setItem'> | null = safeStorage(),
): void {
  try {
    storage?.setItem(UNLOCK_ALL_KEY, on ? '1' : '0');
  } catch {
    // Storage is full or blocked: the choice still holds for this session.
  }
}

/**
 * Whether a storage event from another tab or frame touched the saves (null: storage cleared).
 */
export function isSaveKey(key: string | null): boolean {
  return (
    key === null ||
    key === KEY ||
    key === UNLOCK_ALL_KEY ||
    key === SIEGE_KEY ||
    key === BESTIARY_KEY
  );
}

export function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** The characters met so far (src/ui/bestiary.ts); the key lives here with the other saves. */
export const BESTIARY_KEY = 'relay-defense:bestiary:v1';

// ---- Siege ----------------------------------------------------------------------------------

const SIEGE_KEY = 'relay-defense:siege:v1';

/**
 * Siege progress: the best stars per chapter and the checkpoint, the gold and defenders the next
 * chapter starts from. The checkpoint belongs to one version of the campaign; when the campaign
 * changes, an older checkpoint is dropped and the stars stay.
 */
export interface SiegeSave {
  stars: number[];
  checkpoint: { version: number; chapter: number; carry: Carry } | null;
}

export function loadSiege(
  version: number,
  chapters: number,
  storage: Pick<Storage, 'getItem'> | null = safeStorage(),
): SiegeSave {
  const empty: SiegeSave = { stars: [], checkpoint: null };
  try {
    const raw = storage?.getItem(SIEGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!isRecord(parsed)) return empty;
    const stars = readStars(parsed.stars).slice(0, chapters);
    const cp = parsed.checkpoint;
    const checkpoint =
      isRecord(cp) &&
      cp.version === version &&
      typeof cp.chapter === 'number' &&
      Number.isInteger(cp.chapter) &&
      cp.chapter >= 0 &&
      cp.chapter < chapters &&
      isCarry(cp.carry)
        ? { version, chapter: cp.chapter, carry: cp.carry }
        : null;
    return { stars, checkpoint };
  } catch {
    return empty;
  }
}

/**
 * Saves the Siege. Stars another tab or frame saved since this one loaded are kept (best per
 * chapter); the checkpoint is the one given, as it belongs to the run played last. Returns what
 * was saved.
 */
export function saveSiege(
  save: SiegeSave,
  storage: Pick<Storage, 'getItem' | 'setItem'> | null = safeStorage(),
): SiegeSave {
  let stored: number[] = [];
  try {
    const raw = storage?.getItem(SIEGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (isRecord(parsed)) stored = readStars(parsed.stars);
  } catch {
    // Nothing readable stored: this save stands alone.
  }
  const next: SiegeSave = { stars: mergeStars(stored, save.stars), checkpoint: save.checkpoint };
  try {
    storage?.setItem(SIEGE_KEY, JSON.stringify(next));
  } catch {
    // Storage is full or blocked: the campaign still runs for this session.
  }
  return next;
}

/** The better of two star lists, chapter by chapter. */
export function mergeStars(a: readonly number[], b: readonly number[]): number[] {
  return Array.from({ length: Math.max(a.length, b.length) }, (_, i) =>
    Math.max(a[i] ?? 0, b[i] ?? 0),
  );
}

/**
 * The save after winning `chapter` with `stars`: the best stars per chapter, and the checkpoint
 * the next chapter starts from (`carry`), or none after the last chapter (`carry` null).
 */
export function siegeWin(
  save: SiegeSave,
  chapter: number,
  stars: number,
  carry: Carry | null,
  version: number,
): SiegeSave {
  const won = Array.from({ length: chapter + 1 }, (_, i) => (i === chapter ? stars : 0));
  return {
    stars: mergeStars(save.stars, won),
    checkpoint: carry ? { version, chapter: chapter + 1, carry } : null,
  };
}

/**
 * Whether starting a wave gives up the checkpoint: "Start over" opens chapter 1 while a later
 * checkpoint is saved, and the old run is only given up once the new one starts its first wave.
 */
export function startsOver(
  chapter: number | null,
  wave: number,
  checkpoint: SiegeSave['checkpoint'],
): boolean {
  return chapter === 0 && wave === 0 && checkpoint !== null && checkpoint.chapter !== 0;
}

function readStars(v: unknown): number[] {
  if (!Array.isArray(v)) return [];
  return v.map((s) => (typeof s === 'number' && s >= 0 && s <= 3 ? Math.floor(s) : 0));
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isCarry(v: unknown): v is Carry {
  if (!isRecord(v) || typeof v.credits !== 'number' || !Number.isFinite(v.credits)) return false;
  if (!Array.isArray(v.towers)) return false;
  return v.towers.every(
    (t) =>
      isRecord(t) &&
      (TOWER_KINDS as readonly unknown[]).includes(t.kind) &&
      (TARGET_MODES as readonly unknown[]).includes(t.mode) &&
      typeof t.x === 'number' &&
      typeof t.y === 'number' &&
      typeof t.level === 'number',
  );
}

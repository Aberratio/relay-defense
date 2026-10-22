// Best result per level, kept in the browser. Storage can be missing or blocked (private mode,
// a sandboxed frame), so every access is guarded and the game works without it.
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

/** Records a result; keeps the best. Returns the updated progress. */
export function recordResult(
  progress: Progress,
  levelId: string,
  stars: number,
  storage: Pick<Storage, 'setItem'> | null = safeStorage(),
): Progress {
  const next = { ...progress, [levelId]: Math.max(progress[levelId] ?? 0, stars) };
  try {
    storage?.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage is full or blocked: the result still counts for this session.
  }
  return next;
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

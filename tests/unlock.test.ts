import { describe, expect, it } from 'vitest';
import { LEVELS } from '../src/levels/levels';
import { loadUnlockAll, saveUnlockAll } from '../src/ui/progress';
import { FREE_LEVELS, isUnlocked, nextLevel } from '../src/ui/unlock';

const ids = LEVELS.map((l) => l.id);
const open = (progress: Record<string, number>, all = false) =>
  ids.map((_, i) => isUnlocked(i, ids, progress, all));

describe('unlock', () => {
  it('opens the first levels for a new player and nothing else', () => {
    expect(open({}).filter(Boolean)).toHaveLength(FREE_LEVELS);
    expect(open({}).slice(0, FREE_LEVELS).every(Boolean)).toBe(true);
    expect(nextLevel(ids, {}, false)).toBe(0);
  });

  it('opens a level once the one before it is won', () => {
    const progress = { [ids[0]!]: 3, [ids[1]!]: 1, [ids[2]!]: 2 };
    expect(isUnlocked(3, ids, progress, false)).toBe(true);
    expect(isUnlocked(4, ids, progress, false)).toBe(false);
    expect(nextLevel(ids, progress, false)).toBe(3);
  });

  it('keeps a level won out of order open and the one after it too', () => {
    // A player who won level 6 through a link (?level=) or before unlocking existed.
    const progress = { [ids[5]!]: 2 };
    expect(isUnlocked(5, ids, progress, false)).toBe(true);
    expect(isUnlocked(4, ids, progress, false)).toBe(false);
    expect(isUnlocked(6, ids, progress, false)).toBe(true);
  });

  it('opens everything when the player unlocked all, and reports when all are won', () => {
    expect(open({}, true).every(Boolean)).toBe(true);
    const all = Object.fromEntries(ids.map((id) => [id, 1]));
    expect(nextLevel(ids, all, false)).toBeNull();
    expect(isUnlocked(-1, ids, {}, true)).toBe(false);
    expect(isUnlocked(ids.length, ids, {}, true)).toBe(false);
  });

  it('remembers unlock all and survives blocked storage', () => {
    const data = new Map<string, string>();
    const storage = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
    };
    expect(loadUnlockAll(storage)).toBe(false);
    saveUnlockAll(true, storage);
    expect(loadUnlockAll(storage)).toBe(true);
    saveUnlockAll(false, storage);
    expect(loadUnlockAll(storage)).toBe(false);
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadUnlockAll(blocked)).toBe(false);
    expect(() => saveUnlockAll(true, blocked)).not.toThrow();
  });
});

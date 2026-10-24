import { describe, expect, it } from 'vitest';
import {
  allCleared,
  loadProgress,
  mergeProgress,
  recordResult,
  starsFor,
} from '../src/ui/progress';

function memory(): Storage {
  const data = new Map<string, string>();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
    clear: () => data.clear(),
    key: () => null,
    get length() {
      return data.size;
    },
  };
}

describe('progress', () => {
  it('awards stars by the core left', () => {
    expect(starsFor(20, 20)).toBe(3);
    expect(starsFor(10, 20)).toBe(2);
    expect(starsFor(9, 20)).toBe(1);
    expect(starsFor(0, 20)).toBe(0);
  });

  it('keeps the best result and survives a reload', () => {
    const storage = memory();
    let p = recordResult({}, 'handshake', 2, storage);
    p = recordResult(p, 'handshake', 1, storage);
    expect(p.handshake).toBe(2);
    expect(loadProgress(storage)).toEqual({ handshake: 2 });
  });

  it('ignores broken or blocked storage', () => {
    const broken = { getItem: () => '{not json' };
    expect(loadProgress(broken)).toEqual({});
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(recordResult({}, 'x', 3, blocked)).toEqual({ x: 3 });
    expect(loadProgress({ getItem: () => JSON.stringify({ a: 9, b: 'x', c: 2 }) })).toEqual({
      c: 2,
    });
  });

  it('keeps wins from another tab or frame that saved after this one loaded', () => {
    const storage = memory();
    recordResult({}, 'handshake', 3, storage);
    const a = loadProgress(storage);
    const b = loadProgress(storage);
    recordResult(a, 'fan-out', 2, storage);
    const after = recordResult(b, 'bulwark', 2, storage);
    expect(after).toEqual({ handshake: 3, 'fan-out': 2, bulwark: 2 });
    expect(loadProgress(storage)).toEqual(after);
  });

  it('never lowers a level when an older copy is written back', () => {
    const storage = memory();
    const stale = recordResult({}, 'handshake', 1, storage);
    recordResult(loadProgress(storage), 'handshake', 3, storage);
    expect(recordResult(stale, 'handshake', 2, storage).handshake).toBe(3);
    expect(loadProgress(storage)).toEqual({ handshake: 3 });
  });

  it('merges two saves level by level', () => {
    expect(mergeProgress({ a: 1, b: 3 }, { b: 2, c: 2 })).toEqual({ a: 1, b: 3, c: 2 });
  });
});

describe('allCleared', () => {
  const ids = ['a', 'b', 'c'];
  it('needs a win in every level, not only the last one', () => {
    expect(allCleared(ids, { c: 2 })).toBe(false);
    expect(allCleared(ids, { a: 1, c: 3 })).toBe(false);
    expect(allCleared(ids, { a: 1, b: 1, c: 1 })).toBe(true);
  });
  it('ignores saved results of levels that no longer exist', () => {
    expect(allCleared(ids, { a: 1, b: 2, gone: 3 })).toBe(false);
  });
});

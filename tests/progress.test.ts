import { describe, expect, it } from 'vitest';
import { loadProgress, recordResult, starsFor } from '../src/ui/progress';

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
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(recordResult({}, 'x', 3, blocked)).toEqual({ x: 3 });
    expect(loadProgress({ getItem: () => JSON.stringify({ a: 9, b: 'x', c: 2 }) })).toEqual({
      c: 2,
    });
  });
});

import { describe, expect, it } from 'vitest';
import { ENEMY_KINDS, TOWER_KINDS } from '../src/engine/types';
import { LEVELS } from '../src/levels/levels';
import { firstLevel } from '../src/ui/bestiary';
import { clearedBy, introducedIn, newBest, newCards, openedBy } from '../src/ui/news';

describe('newBest', () => {
  it('is a record only when a saved win is beaten', () => {
    expect(newBest(1, 3)).toEqual({ from: 1, to: 3 });
    expect(newBest(2, 3)).toEqual({ from: 2, to: 3 });
  });

  it('is not a record on a first win, an equal or a worse result', () => {
    expect(newBest(0, 3)).toBeNull();
    expect(newBest(2, 2)).toBeNull();
    expect(newBest(3, 1)).toBeNull();
  });
});

describe('openedBy', () => {
  it('names the level a first win opens', () => {
    expect(
      openedBy({ handshake: 3, 'fan-out': 2 }, { handshake: 3, 'fan-out': 2, bulwark: 1 }, false),
    ).toBe(3);
  });

  it('opens nothing among the free levels, on a replay or with every level unlocked', () => {
    expect(openedBy({}, { handshake: 1 }, false)).toBeNull();
    expect(openedBy({ bulwark: 1 }, { bulwark: 3 }, false)).toBeNull();
    expect(openedBy({}, { bulwark: 1 }, true)).toBeNull();
  });

  it('opens nothing after the last level', () => {
    const last = LEVELS[LEVELS.length - 1]!.id;
    const before = Object.fromEntries(LEVELS.slice(0, -1).map((l) => [l.id, 3]));
    expect(openedBy(before, { ...before, [last]: 3 }, false)).toBeNull();
  });

  it('names the next level after a win out of order', () => {
    expect(openedBy({}, { 'two-fronts': 2 }, false)).toBe(7);
  });
});

describe('introducedIn', () => {
  it('lists the characters a level brings in for the first time', () => {
    expect(introducedIn(3)).toEqual({ towers: ['wall'], enemies: [] });
    expect(introducedIn(5)).toEqual({ towers: ['mortar', 'throttle'], enemies: ['splitter'] });
    expect(introducedIn(6)).toEqual({ towers: [], enemies: [] });
  });

  it('covers every character exactly once across the levels', () => {
    const all = LEVELS.map((_, i) => introducedIn(i));
    expect(all.flatMap((b) => b.towers).sort()).toEqual([...TOWER_KINDS].sort());
    expect(all.flatMap((b) => b.enemies).sort()).toEqual([...ENEMY_KINDS].sort());
    for (const k of [...TOWER_KINDS, ...ENEMY_KINDS])
      expect(all.findIndex((b) => [...b.towers, ...b.enemies].includes(k))).toBe(firstLevel(k));
  });
});

describe('newCards', () => {
  it('keeps only the cards missing before, in roster order', () => {
    expect(
      newCards(
        { towers: ['pulse'], enemies: ['spark'] },
        { towers: ['lance', 'pulse', 'arc'], enemies: ['spark', 'bulwark'] },
      ),
    ).toEqual({ towers: ['arc', 'lance'], enemies: ['bulwark'] });
    expect(
      newCards({ towers: ['pulse'], enemies: [] }, { towers: ['pulse'], enemies: [] }),
    ).toEqual({
      towers: [],
      enemies: [],
    });
  });
});

describe('clearedBy', () => {
  const ids = LEVELS.map((l) => l.id);
  const all = Object.fromEntries(ids.map((id) => [id, 1]));
  const allBut5 = Object.fromEntries(ids.filter((_, i) => i !== 4).map((id) => [id, 1]));
  it('is true only for the win that completes the set, whichever level it is', () => {
    expect(clearedBy(allBut5, all)).toBe(true);
  });
  it('is false while a level is unplayed and on a replay after the set is done', () => {
    expect(clearedBy({}, { [ids[9] ?? '']: 2 })).toBe(false);
    expect(clearedBy(all, { ...all, [ids[0] ?? '']: 3 })).toBe(false);
  });
});

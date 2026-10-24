import { describe, expect, it } from 'vitest';
import type { Wave } from '../src/engine/types';
import {
  addGroup,
  fillGroup,
  goldLeft,
  mostAffordable,
  newDraft,
  removeGroup,
  setField,
} from '../src/duel/editor';
import { validateAttack } from '../src/levels/duel';

/** Four waves of one Goblin each: 4 x 2 = 8 gold. */
const small = (): Wave[] =>
  Array.from({ length: 4 }, () => ({
    groups: [{ enemy: 'spark' as const, count: 1, gap: 0.6, spawn: 0, hp: 1, delay: 0 }],
  }));

describe('the wave editor', () => {
  it('starts from the sparring waves: a legal attack with 14 gold left', () => {
    expect(validateAttack(newDraft())).toBeNull();
    expect(goldLeft(newDraft())).toBe(14);
  });

  it('adds a group of ten Goblins, at most four to a wave, and never empties a wave', () => {
    let d = addGroup(small(), 0);
    expect(d[0]?.groups).toHaveLength(2);
    expect(d[0]?.groups[1]).toMatchObject({ enemy: 'spark', count: 10 });
    expect(goldLeft(d)).toBe(560 - 8 - 20);
    d = addGroup(addGroup(addGroup(d, 0), 0), 0);
    expect(d[0]?.groups).toHaveLength(4);
    d = removeGroup(removeGroup(removeGroup(removeGroup(d, 0, 0), 0, 0), 0, 0), 0, 0);
    expect(d[0]?.groups).toHaveLength(1);
  });

  it('keeps a count a whole number between 1 and 500', () => {
    const at = (v: number) => setField(small(), 1, 0, 'count', v)[1]?.groups[0]?.count;
    expect(at(12.7)).toBe(12);
    expect(at(0)).toBe(1);
    expect(at(-3)).toBe(1);
    expect(at(9999)).toBe(500);
    expect(at(Number.NaN)).toBe(1);
  });

  it('changes one field and leaves the draft it came from alone', () => {
    const before = small();
    const after = setField(before, 2, 0, 'hp', 3);
    expect(after[2]?.groups[0]?.hp).toBe(3);
    expect(before[2]?.groups[0]?.hp).toBe(1);
    expect(setField(before, 2, 0, 'enemy', 'colossus')[2]?.groups[0]?.enemy).toBe('colossus');
  });

  it('fills a group with exactly the gold that is left', () => {
    // The other three Goblins cost 6; Trolls cost 5 each: (560 - 6) / 5 = 110.8, so 110.
    const trolls = setField(small(), 0, 0, 'enemy', 'bulwark');
    expect(mostAffordable(trolls, 0, 0)).toBe(110);
    const full = fillGroup(trolls, 0, 0);
    expect(full[0]?.groups[0]?.count).toBe(110);
    expect(goldLeft(full)).toBe(4);
    expect(validateAttack(full)).toBeNull();
    // Spiderlings cost half a gold, rounded up per group: 554 gold buys 500 (the cap).
    expect(mostAffordable(setField(small(), 0, 0, 'enemy', 'mite'), 0, 0)).toBe(500);
  });

  it('fills to one monster when nothing is left, and the attack then says it is over budget', () => {
    const broke = setField(setField(small(), 0, 0, 'enemy', 'colossus'), 0, 0, 'count', 14);
    expect(goldLeft(broke)).toBe(560 - 560 - 6);
    const one = fillGroup(broke, 1, 0);
    expect(one[1]?.groups[0]?.count).toBe(1);
    expect(validateAttack(one)).toBe('budget');
  });
});

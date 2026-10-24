import { describe, expect, it } from 'vitest';
import { ENEMY_KINDS, TOWER_KINDS } from '../src/engine/types';
import { LEVELS } from '../src/levels/levels';
import {
  answers,
  BESTIARY_KEY,
  COUNTERS,
  firstLevel,
  foundInWins,
  loadBestiary,
  mergeBestiary,
  recordFound,
} from '../src/ui/bestiary';
import { isSaveKey } from '../src/ui/progress';

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

const empty = { towers: [], enemies: [] };

describe('bestiary save', () => {
  it('starts empty and survives a reload', () => {
    const storage = memory();
    expect(loadBestiary(storage)).toEqual(empty);
    const b = recordFound(empty, { towers: ['pulse'], enemies: ['spark'] }, storage);
    expect(b).toEqual({ towers: ['pulse'], enemies: ['spark'] });
    expect(loadBestiary(storage)).toEqual(b);
    expect(storage.getItem(BESTIARY_KEY)).toBe('{"towers":["pulse"],"enemies":["spark"]}');
  });

  it('keeps cards in roster order without duplicates', () => {
    const storage = memory();
    recordFound(empty, { enemies: ['bulwark', 'spark'] }, storage);
    const b = recordFound(loadBestiary(storage), { enemies: ['spark', 'mite'] }, storage);
    expect(b.enemies).toEqual(['spark', 'mite', 'bulwark']);
  });

  it('ignores broken, unknown or blocked storage', () => {
    expect(loadBestiary({ getItem: () => '{not json' })).toEqual(empty);
    expect(loadBestiary({ getItem: () => '[1,2]' })).toEqual(empty);
    expect(
      loadBestiary({
        getItem: () => JSON.stringify({ towers: ['pulse', 'cannon', 7], enemies: 'spark' }),
      }),
    ).toEqual({ towers: ['pulse'], enemies: [] });
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadBestiary(blocked)).toEqual(empty);
    expect(recordFound(empty, { towers: ['arc'] }, blocked)).toEqual({
      towers: ['arc'],
      enemies: [],
    });
  });

  it('keeps cards another tab or frame found after this one loaded', () => {
    const storage = memory();
    const a = loadBestiary(storage);
    const b = loadBestiary(storage);
    recordFound(a, { enemies: ['phantom'] }, storage);
    const after = recordFound(b, { enemies: ['mite'] }, storage);
    expect(after.enemies).toEqual(['mite', 'phantom']);
    expect(loadBestiary(storage)).toEqual(after);
  });

  it('does not write when nothing new was found', () => {
    let writes = 0;
    const storage = memory();
    recordFound(empty, { towers: ['pulse'] }, storage);
    const counting = { getItem: storage.getItem, setItem: () => void writes++ };
    recordFound(loadBestiary(storage), { towers: ['pulse'] }, counting);
    expect(writes).toBe(0);
  });

  it('merges two bestiaries card by card', () => {
    expect(
      mergeBestiary(
        { towers: ['lance'], enemies: ['spark'] },
        { towers: ['pulse'], enemies: ['spark'] },
      ),
    ).toEqual({ towers: ['pulse', 'lance'], enemies: ['spark'] });
  });

  it('is a save key for the storage listener; the old keys stay', () => {
    expect(isSaveKey(BESTIARY_KEY)).toBe(true);
    expect(isSaveKey('relay-defense:progress:v1')).toBe(true);
  });

  it('opens the cards of levels won before the bestiary existed', () => {
    // Iron Hides (bulwark) won, Winding Brook (fan-out) not: Iron Hides has its own Spiderlings.
    const b = foundInWins({ handshake: 3, bulwark: 1, 'fan-out': 0 });
    expect(b.towers).toEqual(['pulse', 'arc', 'lance']);
    expect(b.enemies).toEqual(['spark', 'mite', 'bulwark']);
    expect(foundInWins({ handshake: 3 })).toEqual({ towers: ['pulse'], enemies: ['spark'] });
    expect(foundInWins({ 'not-a-level': 3 })).toEqual(empty);
  });
});

describe('bestiary cards', () => {
  it('every character appears in one of the ten levels', () => {
    for (const kind of TOWER_KINDS) expect(firstLevel(kind), kind).toBeGreaterThanOrEqual(0);
    for (const kind of ENEMY_KINDS) expect(firstLevel(kind), kind).toBeGreaterThanOrEqual(0);
  });

  it('every monster has an answer the player already has where it is met first', () => {
    for (const enemy of ENEMY_KINDS) {
      const level = LEVELS[firstLevel(enemy)];
      const ready = COUNTERS[enemy].filter((tower) => level?.towers.includes(tower));
      expect(ready.length, enemy).toBeGreaterThan(0);
    }
  });

  it('a defender card lists the monsters it answers, the inverse of the monster cards', () => {
    expect(answers('beacon')).toContain('phantom');
    for (const tower of TOWER_KINDS)
      for (const enemy of answers(tower)) expect(COUNTERS[enemy]).toContain(tower);
    expect(answers('wall')).toEqual([]);
  });
});

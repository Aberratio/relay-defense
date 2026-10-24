import { describe, expect, it } from 'vitest';
import { parseMap } from '../src/engine/grid';
import { replay, type Solution } from '../src/engine/replay';
import type { EnemyKind, SpawnGroup, Wave } from '../src/engine/types';
import {
  DUEL_BUDGET,
  DUEL_MAP_IDS,
  attackCost,
  bountyValue,
  duelLevel,
  duelLevelId,
  groupCost,
  isDuelMap,
  rematch,
  score,
  sparringById,
  sparringLevel,
  sparringWaves,
  validateAttack,
  type DuelMapId,
} from '../src/levels/duel';
import { levelById } from '../src/levels/levels';
import { SIEGE } from '../src/levels/siege';
import { DUEL_ATTACKS, DUEL_DEFENCES } from './duel-solutions';

function grp(enemy: EnemyKind, count: number, over: Partial<SpawnGroup> = {}): SpawnGroup {
  return { enemy, count, gap: 0.6, spawn: 0, hp: 1, delay: 0, ...over };
}
/** Four waves of `n` Goblins each: 2 gold apiece, nothing else. */
function goblins(n: number): Wave[] {
  return Array.from({ length: 4 }, () => ({ groups: [grp('spark', n)] }));
}
const empty = (map: DuelMapId): Solution => ({ level: duelLevelId(map), waves: [] });
const defenceOf = (map: DuelMapId): Solution => {
  const d = DUEL_DEFENCES.find((s) => s.level === duelLevelId(map));
  if (!d) throw new Error(`no reference defence for ${map}`);
  return d;
};

describe('duel prices', () => {
  it('values a Brood Mother with her three Spiderlings', () => {
    expect(bountyValue('splitter')).toBe(9); // 6 + 3 x 1
    expect(bountyValue('spark')).toBe(4);
  });

  it('charges half the bounty per hit-point step, a group rounded up to whole gold', () => {
    expect(groupCost(grp('phantom', 12))).toBe(42); // 12 x 7 x 0.5
    expect(groupCost(grp('bulwark', 15, { hp: 1.5 }))).toBe(113); // 112.5
    expect(groupCost(grp('mite', 1))).toBe(1); // 0.5
    expect(groupCost(grp('mite', 3, { hp: 1.5 }))).toBe(3); // 2.25
    expect(groupCost(grp('colossus', 1))).toBe(40);
    expect(groupCost(grp('mite', 2))).toBe(1); // exact: no rounding up
  });

  it('prices the sparring waves at 546 of 560 gold, a legal attack', () => {
    // 42 + 42 | 55 + 56 | 84 + 81 | 60 + 63 + 63
    expect(attackCost(sparringWaves())).toBe(546);
    expect(validateAttack(sparringWaves())).toBeNull();
  });
});

describe('what an attack may be', () => {
  const ok = goblins(70); // 4 x 140 = 560: exactly the budget
  const at = (wave: number, group: Partial<SpawnGroup>): Wave[] =>
    ok.map((w, i) => (i === wave ? { groups: [{ ...w.groups[0]!, ...group }] } : w));

  it('accepts an attack that spends exactly the budget', () => {
    expect(attackCost(ok)).toBe(DUEL_BUDGET);
    expect(validateAttack(ok)).toBeNull();
  });

  it('refuses each broken rule with its own reason', () => {
    expect(validateAttack(ok.slice(0, 3))).toBe('waves');
    expect(validateAttack([...ok.slice(0, 3), { groups: [] }])).toBe('groups');
    expect(
      validateAttack([
        ...ok.slice(0, 3),
        { groups: Array.from({ length: 5 }, () => grp('mite', 1)) },
      ]),
    ).toBe('groups');
    expect(validateAttack(at(0, { enemy: 'dragon' as EnemyKind }))).toBe('enemy');
    expect(validateAttack(at(0, { count: 0 }))).toBe('count');
    expect(validateAttack(at(0, { count: 501 }))).toBe('count');
    expect(validateAttack(at(0, { count: 1.5 }))).toBe('count');
    expect(validateAttack(at(0, { hp: 2.5 }))).toBe('hp');
    expect(validateAttack(at(0, { gap: 0.5 }))).toBe('gap');
    expect(validateAttack(at(0, { delay: 1 }))).toBe('delay');
    expect(validateAttack(at(0, { spawn: 2 }))).toBe('spawn');
    expect(validateAttack(at(0, { count: 71 }))).toBe('budget'); // 562
  });
});

describe('duel maps', () => {
  it('plays on the maps the players know: the Siege meadow with its pass open, two levels', () => {
    expect(duelLevel('siege', []).map).toEqual(SIEGE.map);
    expect(SIEGE.map[4]).toContain('='); // the pass through the ridge, before any landslide
    expect(duelLevel('two-fronts', []).map).toEqual(levelById('two-fronts')?.map);
    expect(duelLevel('colossus', []).map).toEqual(levelById('colossus')?.map);
  });

  it('knows its three maps and nothing else', () => {
    expect([...DUEL_MAP_IDS]).toEqual(['siege', 'two-fronts', 'colossus']);
    expect(isDuelMap('two-fronts')).toBe(true);
    expect(isDuelMap('handshake')).toBe(false);
    expect(sparringById('duel-colossus')?.id).toBe('duel-colossus');
    expect(sparringById('duel-handshake')).toBeUndefined();
  });

  it.each(DUEL_MAP_IDS)('%s: two portals, the whole budget and every defender', (map) => {
    const level = duelLevel(map, sparringWaves());
    expect(parseMap(level.map).spawns).toHaveLength(2);
    expect(level.credits).toBe(560);
    expect(level.lives).toBe(20);
    expect(level.towers).toEqual(['pulse', 'arc', 'lance', 'mortar', 'throttle', 'beacon', 'wall']);
    expect(level.hazards).toBeUndefined();
  });
});

describe('scoring a bout', () => {
  it('counts every life taken, past the 20 a Heart Tree has', () => {
    // An empty board kills nothing: 4 x 50 Goblins leak one life each.
    expect(score('siege', empty('siege'), goblins(50))).toEqual({ taken: 200, skipped: 0 });
  });

  it('plays the slowest legal attack to its end', () => {
    // Two waves of 500 Spiderlings, 1.5 s apart after an 8 s delay: about 1 516 s of spawning.
    const slow = (n: number): Wave => ({ groups: [grp('mite', n, { gap: 1.5, delay: 8 })] });
    const waves = [slow(500), slow(500), slow(1), slow(1)];
    expect(validateAttack(waves)).toBeNull();
    for (const map of DUEL_MAP_IDS)
      expect(score(map, defenceOf(map), waves).taken).toBeGreaterThanOrEqual(0);
  });

  it('counts the defence moves the game refused', () => {
    const twice: Solution = {
      level: 'duel-siege',
      waves: [
        [
          ['build', 'lance', 3, 3],
          ['build', 'lance', 3, 3],
        ],
      ],
    };
    expect(score('siege', twice, goblins(1)).skipped).toBe(1);
  });

  it('gives the duel to whoever took more, a draw when equal', () => {
    const side = (n: number) => ({ defence: empty('siege'), attack: goblins(n) });
    expect(rematch('siege', side(50), side(40))).toMatchObject({
      challenger: { taken: 200 },
      rival: { taken: 160 },
      winner: 'challenger',
    });
    expect(rematch('siege', side(40), side(50)).winner).toBe('rival');
    expect(rematch('siege', side(45), side(45)).winner).toBe('draw');
  });
});

// The proof every duel map carries, like the levels and the Siege chapters do.
describe.each(DUEL_MAP_IDS)('duel map %s', (map) => {
  it('can be defended: the reference defence wins its sparring run without a loss', () => {
    const result = replay(sparringLevel(map), defenceOf(map));
    expect(result.outcome).toBe('won');
    expect(result.lives).toBe(20);
    expect(result.rejected).toEqual([]);
  });

  it('can be attacked: waves composed against that defence take lives from it', () => {
    const attack = DUEL_ATTACKS.find((a) => a.map === map);
    expect(attack).toBeDefined();
    expect(validateAttack(attack!.waves)).toBeNull();
    const bout = score(map, defenceOf(map), attack!.waves);
    // Pin: the lives the search reached; a change here is a balance change.
    expect(bout.taken).toBe(attack!.taken);
    expect(bout.taken).toBeGreaterThan(0);
  });
});

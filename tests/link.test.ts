import { describe, expect, it } from 'vitest';
import { rng } from '../src/engine/probe';
import type { Solution } from '../src/engine/replay';
import {
  decodeDuel,
  duelFromHash,
  duelHash,
  encodeAttack,
  encodeDefence,
  encodeDuel,
  type Duel,
} from '../src/duel/link';
import { DUEL_VERSION, duelLevelId, sparringWaves } from '../src/levels/duel';
import { DUEL_ATTACKS, DUEL_DEFENCES } from './duel-solutions';
import { SIEGE_CHAIN, SIEGE_FLOOR } from './siege-solutions';
import { SOLUTIONS } from './solutions';

const defence = (map: 'siege' | 'two-fronts' | 'colossus'): Solution =>
  DUEL_DEFENCES.find((d) => d.level === duelLevelId(map))!;
const attack = (map: string) => DUEL_ATTACKS.find((a) => a.map === map)!.waves;

const challenge: Duel = { map: 'siege', challenger: defence('siege') };
const answer: Duel = {
  ...challenge,
  rival: { attack: attack('siege'), defence: defence('siege') },
};
const result: Duel = { ...answer, reply: sparringWaves() };

describe('the duel link text', () => {
  it('writes a defence as a letter and a hex cell per action, waves split by dots', () => {
    const s: Solution = {
      level: 'duel-siege',
      waves: [
        [
          ['build', 'lance', 5, 4],
          ['up', 5, 4],
        ],
        [],
        [['mode', 5, 4, 'strong']],
        [],
      ],
    };
    expect(encodeDefence(s)).toBe('l54u54..o54s.'); // four build phases, the last empty
    expect(encodeDefence({ level: 'x', waves: [[['sell', 15, 9]]] })).toBe('sf9');
  });

  it('writes a group as a letter, four step indexes and the count', () => {
    const waves = [
      { groups: [{ enemy: 'phantom' as const, count: 12, gap: 0.6, spawn: 0, hp: 1, delay: 0 }] },
      {
        groups: [
          { enemy: 'splitter' as const, count: 500, gap: 1.5, spawn: 1, hp: 4, delay: 8 },
          { enemy: 'mite' as const, count: 1, gap: 0.12, spawn: 0, hp: 1.5, delay: 2 },
        ],
      },
    ];
    expect(encodeAttack(waves)).toBe('p020012.r4431500,m10101');
  });

  it.each([
    ['challenge', challenge],
    ['answer', answer],
    ['result', result],
  ])('reads back a %s exactly', (_, duel) => {
    expect(decodeDuel(encodeDuel(duel))).toEqual({ ok: true, duel });
  });

  it.each(['siege', 'two-fronts', 'colossus'] as const)(
    'reads back the reference defence and attack of %s',
    (map) => {
      const duel: Duel = {
        map,
        challenger: defence(map),
        rival: { attack: attack(map), defence: defence(map) },
        reply: attack(map),
      };
      expect(decodeDuel(encodeDuel(duel))).toEqual({ ok: true, duel });
    },
  );

  it('fits a whole duel in a link with room to spare', () => {
    // Measured (Q-011): the longest reference solution is 132 characters in this format.
    const longest = Math.max(
      ...[...SOLUTIONS, ...SIEGE_FLOOR, ...SIEGE_CHAIN, ...DUEL_DEFENCES].map(
        (s) => encodeDefence(s).length,
      ),
    );
    expect(longest).toBe(132);
    expect(duelHash(result).length).toBeLessThan(600);
  });

  it('says when a link comes from another version of the game', () => {
    const [, , ...rest] = encodeDuel(challenge).split('~');
    expect(decodeDuel(['2', String(DUEL_VERSION), ...rest].join('~'))).toEqual({
      ok: false,
      reason: 'version',
    });
    expect(decodeDuel(['1', String(DUEL_VERSION + 1), ...rest].join('~'))).toEqual({
      ok: false,
      reason: 'version',
    });
  });

  it('refuses a link that is not a fair duel', () => {
    const good = encodeDuel(answer).split('~');
    const swap = (i: number, text: string) => good.map((p, j) => (j === i ? text : p)).join('~');
    const bad = [
      '',
      'hello',
      good.slice(0, 5).join('~'), // a rival's waves without a defence
      swap(2, 'x'), // no such map
      swap(3, 'l00'), // a Unicorn on the rock in the corner
      swap(3, 'l54z'), // trailing garbage
      swap(3, 'l54.l55.l56.l57.l58'), // five build phases
      swap(4, 'c000014.s00001.s00001.s00001'), // 14 Ogre Warlords: 560 + 6 gold
      swap(4, 'p02000.s00001.s00001.s00001'), // a group with no count
      swap(4, 'p020012'), // one wave
      swap(4, 'x00001.s00001.s00001.s00001'), // no such monster
      swap(4, 'p520012.s00001.s00001.s00001'), // no such hit-point step
    ];
    for (const text of bad)
      expect(decodeDuel(text), text).toEqual({ ok: false, reason: 'invalid' });
  });

  it('never throws on random text, and whatever it accepts is a valid duel', () => {
    const random = rng(4242);
    const alphabet = 'palmtbwusoflc0123456789abcdef.,~ ';
    let accepted = 0;
    for (let i = 0; i < 3000; i++) {
      const base = i % 2 ? encodeDuel(result) : '';
      const chars = [...base];
      for (let k = 0; k < 1 + Math.floor(random() * 6); k++) {
        const at = Math.floor(random() * (chars.length + 1));
        chars.splice(at, random() < 0.5 ? 1 : 0, alphabet[Math.floor(random() * alphabet.length)]!);
      }
      const decoded = decodeDuel(chars.join(''));
      if (decoded.ok) {
        accepted++;
        expect(decodeDuel(encodeDuel(decoded.duel))).toEqual(decoded);
      }
    }
    expect(accepted).toBeGreaterThan(0);
  });

  it('lives in the hash, so it never reaches a server', () => {
    expect(duelHash(challenge).startsWith('#duel=1~')).toBe(true);
    expect(duelFromHash(duelHash(result))).toEqual({ ok: true, duel: result });
    expect(duelFromHash('')).toBeNull();
    expect(duelFromHash('#help')).toBeNull();
  });
});

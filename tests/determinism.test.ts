import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Game } from '../src/engine/game';
import { LEVELS } from '../src/levels/levels';
import { Hasher, differs, fingerprints, type Fingerprint } from '../scripts/determinism-entry';
import { REPLAY_PINS } from './replay-pins';

// ECMAScript leaves these to the engine ("implementation-approximated"), so V8, JavaScriptCore and
// SpiderMonkey may round them differently. A duel is scored in two players' browsers, so the
// simulation must not depend on them. Math.sqrt is exact (correctly rounded) and stays allowed.
// The full proof is scripts/determinism.ts in WebKit and Firefox; this guard is the fast one.
// The second alternative catches `**` and the third an alias such as `const { hypot } = Math`.
const APPROXIMATED =
  /Math\.(acos|acosh|asin|asinh|atan|atanh|atan2|cbrt|cos|cosh|exp|expm1|hypot|log|log1p|log10|log2|pow|sin|sinh|tan|tanh)\b|\*\*|=\s*Math\b\s*;?$/;

/** Lines allowed to use one anyway, with the reason. */
const ALLOWED = [
  // The tower's facing: only the renderer reads `angle`.
  't.angle = Math.atan2(target.y - from.y, target.x - from.x);',
];

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory()
      ? files(`${dir}/${d.name}`)
      : d.name.endsWith('.ts')
        ? [`${dir}/${d.name}`]
        : [],
  );
}

function offending(dir: string): string[] {
  return files(dir).flatMap((file) =>
    readFileSync(file, 'utf8')
      .split('\n')
      .map((line, i) => ({ at: `${file}:${i + 1}`, line: line.trim() }))
      .filter(({ line }) => !/^(\/\/|\/\*|\*)/.test(line))
      .filter(({ line }) => APPROXIMATED.test(line) && !ALLOWED.includes(line))
      .map(({ at, line }) => `${at}: ${line}`),
  );
}

const run = (over: Partial<Fingerprint> = {}): Fingerprint => ({
  name: 'level x',
  outcome: 'won',
  lives: 20,
  credits: 100,
  waves: [
    [20, 50],
    [20, 100],
  ],
  ticks: 900,
  hash: 'abc',
  ...over,
});

describe('cross-engine determinism', () => {
  it('keeps engine-dependent maths out of the simulation', () => {
    expect([...offending('src/engine'), ...offending('src/levels')]).toEqual([]);
  });

  it('flags an engine-dependent call (the guard itself)', () => {
    expect(APPROXIMATED.test('return Math.hypot(dx, dy);')).toBe(true);
    expect(APPROXIMATED.test('const r = a ** 2;')).toBe(true);
    expect(APPROXIMATED.test('const { hypot } = Math;')).toBe(true);
    expect(APPROXIMATED.test('return Math.sqrt(dx * dx + dy * dy);')).toBe(false);
    expect(APPROXIMATED.test('const m = Math.max(a, b);')).toBe(false);
  });

  // Pin: the change to the distance moved no result. Expected values were captured on the old engine.
  it('reproduces every pinned replay: outcome, ticks, lives and credits after every wave', () => {
    const now = fingerprints().map(({ name, outcome, ticks, waves }) => ({
      name,
      outcome,
      ticks,
      waves,
    }));
    expect(now).toEqual(REPLAY_PINS);
  });
});

describe('the cross-engine comparison', () => {
  it('finds nothing between identical runs', () => {
    expect(differs(run(), run())).toBeNull();
  });

  it('names the first difference, coarsest first', () => {
    expect(differs(run(), undefined)).toBe('missing');
    expect(differs(run(), run({ name: 'level y' }))).toBe('run level y in place of level x');
    expect(differs(run(), run({ outcome: 'lost' }))).toBe('outcome won vs lost');
    expect(differs(run(), run({ waves: [[20, 50]] }))).toBe('2 waves vs 1');
    expect(
      differs(
        run(),
        run({
          waves: [
            [20, 50],
            [19, 100],
          ],
        }),
      ),
    ).toBe('after wave 2: 20,100 vs 19,100');
    expect(differs(run(), run({ ticks: 901 }))).toBe('ticks 900 vs 901');
    expect(differs(run(), run({ hash: 'abd' }))).toBe('state hash abc vs abd');
  });

  it('sees a one-ulp change in a position in the state hash', () => {
    const level = LEVELS[0]!;
    const game = new Game(level);
    game.startWave();
    for (let i = 0; i < 60; i++) game.step();
    const a = new Hasher();
    a.state(game);
    const enemy = game.enemies[0]!;
    enemy.x += Number.EPSILON * enemy.x;
    const b = new Hasher();
    b.state(game);
    expect(game.enemies.length).toBeGreaterThan(0);
    expect(b.h).not.toBe(a.h);
  });
});

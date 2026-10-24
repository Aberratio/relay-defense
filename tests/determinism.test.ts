import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// ECMAScript leaves these to the engine ("implementation-approximated"), so V8, JavaScriptCore and
// SpiderMonkey may round them differently. A duel is scored in two players' browsers, so the
// simulation must not depend on them. Math.sqrt is exact (correctly rounded) and stays allowed.
// The full proof is scripts/determinism.ts in WebKit and Firefox; this guard is the fast one.
const APPROXIMATED =
  /Math\.(acos|acosh|asin|asinh|atan|atanh|atan2|cbrt|cos|cosh|exp|expm1|hypot|log|log1p|log10|log2|pow|sin|sinh|tan|tanh)\b|\*\*/;

/** Lines allowed to use one anyway, with the reason. */
const ALLOWED = [
  // The tower's facing: only the renderer reads `angle`.
  't.angle = Math.atan2(target.y - from.y, target.x - from.x);',
];

function offending(dir: string): string[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.ts'))
    .flatMap((f) =>
      readFileSync(`${dir}/${f}`, 'utf8')
        .split('\n')
        .map((line, i) => ({ at: `${dir}/${f}:${i + 1}`, line: line.trim() }))
        .filter(({ line }) => !/^(\/\/|\/\*|\*)/.test(line))
        .filter(({ line }) => APPROXIMATED.test(line) && !ALLOWED.includes(line))
        .map(({ at, line }) => `${at}: ${line}`),
    );
}

describe('cross-engine determinism', () => {
  it('keeps engine-dependent maths out of the simulation', () => {
    expect([...offending('src/engine'), ...offending('src/levels')]).toEqual([]);
  });

  it('flags an engine-dependent call (the guard itself)', () => {
    expect(APPROXIMATED.test('return Math.hypot(dx, dy);')).toBe(true);
    expect(APPROXIMATED.test('const r = a ** 2;')).toBe(true);
    expect(APPROXIMATED.test('return Math.sqrt(dx * dx + dy * dy);')).toBe(false);
  });
});

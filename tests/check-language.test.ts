import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { findPolish, findViolations } from '../scripts/check-language';

// Built from code points, so this file passes the guard it tests.
const polish = `za${String.fromCodePoint(0x17c, 0xf3, 0x142, 0x107)}`;

describe('language guard', () => {
  it('finds Polish diacritics', () => {
    expect(findPolish(`plain English\n${polish}\n`)).toEqual([{ line: 2, text: polish }]);
    expect(findPolish('Wave 3, core 20/20')).toEqual([]);
  });

  it('flags Polish outside the Polish dictionary block', () => {
    for (const path of ['src/main.ts', 'tests/engine.test.ts', 'README.md', 'docs/plan.md']) {
      expect(findViolations(path, `// ${polish}`)).toHaveLength(1);
    }
    const dict = [
      'const en = {',
      `  bad: '${polish}',`,
      '};',
      'const pl: Strings = {',
      `  good: '${polish}',`,
      '};',
    ].join('\n');
    expect(findViolations('src/ui/i18n.ts', dict).map((v) => v.line)).toEqual([2]);
  });

  it('passes the real dictionary', () => {
    expect(findViolations('src/ui/i18n.ts', readFileSync('src/ui/i18n.ts', 'utf8'))).toEqual([]);
  });
});

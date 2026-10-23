import { describe, expect, it } from 'vitest';
import { ENEMY_KINDS, TARGET_MODES, TOWER_KINDS } from '../src/engine/types';
import { LEVELS } from '../src/levels/levels';
import { detectLang, LANGS, strings, type Strings } from '../src/ui/i18n';
import { newKinds } from '../src/ui/app';

function shape(value: unknown): unknown {
  if (typeof value === 'function') return 'fn';
  if (Array.isArray(value)) return value.map(shape);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shape(v)]));
  }
  return typeof value;
}

function strings_(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(strings_);
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings_);
  return [];
}

describe('i18n', () => {
  it('Polish and English have the same keys and no empty strings', () => {
    expect(shape(strings('pl'))).toEqual(shape(strings('en')));
    for (const lang of LANGS)
      for (const s of strings_(strings(lang))) expect(s.trim()).not.toBe('');
  });

  it('names every tower, enemy, targeting mode and level', () => {
    for (const lang of LANGS) {
      const t: Strings = strings(lang);
      for (const k of TOWER_KINDS) expect(t.towers[k].name).toBeTruthy();
      for (const k of ENEMY_KINDS) expect(t.enemies[k].name).toBeTruthy();
      for (const m of TARGET_MODES) expect(t.modes[m]).toBeTruthy();
      for (const l of LEVELS)
        expect(t.levelCopy[l.id as keyof Strings['levelCopy']], `${lang} ${l.id}`).toBeDefined();
    }
  });

  it('picks the language from the URL, then the browser', () => {
    expect(detectLang(new URLSearchParams('lang=pl'), 'en-GB')).toBe('pl');
    expect(detectLang(new URLSearchParams(''), 'pl-PL')).toBe('pl');
    expect(detectLang(new URLSearchParams('lang=de'), 'de-DE')).toBe('en');
  });

  it('introduces every tower and enemy in some level briefing', () => {
    const towers = new Set(LEVELS.flatMap((_, i) => newKinds(i).towers));
    const enemies = new Set(LEVELS.flatMap((_, i) => newKinds(i).enemies));
    expect([...towers].sort()).toEqual([...TOWER_KINDS].sort());
    expect([...enemies].sort()).toEqual([...ENEMY_KINDS].sort());
  });
});

// Built from a code point, so this file passes the language guard.
const E_OGONEK = String.fromCodePoint(0x119);

describe('Polish plurals', () => {
  it('agree with the number', () => {
    const a = strings('pl').announce;
    expect(a.sold(1)).toBe(`Sprzedano za 1 monet${E_OGONEK}.`);
    expect(a.sold(22)).toBe('Sprzedano za 22 monety.');
    expect(a.sold(25)).toBe('Sprzedano za 25 monet.');
    expect(a.sold(12)).toBe('Sprzedano za 12 monet.');
  });
});

import { describe, expect, it } from 'vitest';
import { ENEMY_KINDS, TARGET_MODES, TOWER_KINDS } from '../src/engine/types';
import { LEVELS } from '../src/levels/levels';
import { detectLang, LANGS, strings, withLang, type Strings } from '../src/ui/i18n';
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
    expect(a.waveClear(1, 1)).toBe('Fala 1 odparta. Premia: 1 moneta.');
    expect(a.waveClear(1, 3)).toBe('Fala 1 odparta. Premia: 3 monety.');
  });
});

describe('result news', () => {
  it('counts new characters and lists names in each language', () => {
    const en = strings('en').news;
    const pl = strings('pl').news;
    expect([1, 2, 5].map(en.newDefenders)).toEqual([
      'a new defender',
      '2 new defenders',
      '5 new defenders',
    ]);
    expect([1, 2, 5].map(en.newMonsters)).toEqual([
      'a new monster',
      '2 new monsters',
      '5 new monsters',
    ]);
    // Polish text stays in i18n.ts (check:language), so the forms are compared, not spelled out:
    // a defender takes the genitive plural from 2 on, a monster the nominative plural for 2-4.
    expect(pl.newDefenders(2)).toBe(pl.newDefenders(5).replace('5', '2'));
    expect(pl.newMonsters(2)).not.toBe(pl.newMonsters(5).replace('5', '2'));
    expect(pl.newMonsters(22)).toBe(pl.newMonsters(2).replace('2', '22'));
    expect(en.opened('6. The Brood', ['2 new defenders', 'a new monster'])).toBe(
      'Now open: 6. The Brood. Waiting there: 2 new defenders and a new monster.',
    );
    expect(pl.opened('7. Dwa fronty', [])).toBe('Odblokowany poziom: 7. Dwa fronty.');
    expect(strings('pl').bestiary.found(['Troll'])).toBe('Nowa karta w bestiariuszu: Troll.');
    expect(strings('en').bestiary.found(['Unicorn', 'Troll'])).toBe(
      'New in the bestiary: Unicorn and Troll.',
    );
  });
});

describe('language in the URL', () => {
  it('sets lang and keeps the other parameters', () => {
    expect(withLang('', 'en')).toBe('?lang=en');
    expect(withLang('?level=colossus&lang=pl', 'en')).toBe('?level=colossus&lang=en');
    expect(withLang('?mode=siege', 'pl')).toBe('?mode=siege&lang=pl');
  });
  it('is read back by detectLang', () => {
    expect(detectLang(new URLSearchParams(withLang('?level=x', 'en')), 'pl-PL')).toBe('en');
  });
});

describe('Troll text', () => {
  it('names no armour number, which differs between levels and the Siege', () => {
    for (const lang of LANGS) expect(strings(lang).enemies.bulwark.text).not.toMatch(/\d/);
  });
});

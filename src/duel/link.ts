import type { Action, Solution } from '../engine/replay';
import {
  ENEMY_KINDS,
  TARGET_MODES,
  TOWER_KINDS,
  type EnemyKind,
  type SpawnGroup,
  type TargetMode,
  type TowerKind,
  type Wave,
} from '../engine/types';
import {
  DELAY_STEPS,
  DUEL_MAP_IDS,
  DUEL_VERSION,
  DUEL_WAVE_COUNT,
  GAP_STEPS,
  HP_STEPS,
  duelLevel,
  duelLevelId,
  validateAttack,
  type DuelMapId,
} from '../levels/duel';
import { isBuildableTile, parseMap, tileAt } from '../engine/grid';

// A duel travels in the link's hash (#duel=...), never through a server. The text is compact and
// URL-safe without escaping (letters, digits, '.', ',', '~'), so the longest reference defence is
// 132 characters (base64url of the same JSON would be 1 163).
//
//   <format>~<balance>~<map>~<challenger defence>[~<rival waves>~<rival defence>[~<challenger waves>]]
//
// A defence: build-phase actions per wave, waves split by '.'. An action is a letter and the cell
// in hex (x 0-f, y 0-9): `l54` a Unicorn on (5, 4); `u54` upgrade it; `s54` sell it; `o54s` set
// its target to strongest. Building letters are in `TOWER_CODE`.
// Waves of an attack: split by '.', groups by ','. A group is the monster's letter, four step
// indexes (hit points, gap, delay, portal) and the count: `p020012` is 12 Wraiths, hp x1, 0.6 s
// apart, no delay, from portal 0.

/** Bumped when the text format changes. */
export const LINK_FORMAT = 1;
export const HASH_KEY = 'duel';

const TOWER_CODE: Record<TowerKind, string> = {
  pulse: 'p',
  arc: 'a',
  lance: 'l',
  mortar: 'm',
  throttle: 't',
  beacon: 'b',
  wall: 'w',
};
const ENEMY_CODE: Record<EnemyKind, string> = {
  spark: 's',
  mite: 'm',
  bulwark: 'b',
  phantom: 'p',
  splitter: 'r',
  mender: 'h',
  colossus: 'c',
};
const MODE_CODE: Record<TargetMode, string> = { first: 'f', last: 'l', strong: 's', weak: 'w' };
const MAP_CODE: Record<DuelMapId, string> = { siege: 's', 'two-fronts': 't', colossus: 'c' };

const invert = <K extends string>(m: Record<K, string>): Record<string, K> =>
  Object.fromEntries(Object.entries(m).map(([k, v]) => [v, k])) as Record<string, K>;
const TOWER_OF = invert(TOWER_CODE);
const ENEMY_OF = invert(ENEMY_CODE);
const MODE_OF = invert(MODE_CODE);
const MAP_OF = invert(MAP_CODE);

/** Where a duel stands: each stage adds what the next player sent. */
export interface Duel {
  map: DuelMapId;
  /** Link 1: the challenger's defence. */
  challenger: Solution;
  /** Link 2: the rival's waves against it, and the rival's own defence. */
  rival?: { attack: Wave[]; defence: Solution };
  /** Link 3: the challenger's waves against the rival's defence. */
  reply?: Wave[];
}

export type DecodeResult =
  | { ok: true; duel: Duel }
  /** `version`: made with another balance or format of the game; `invalid`: not a duel at all. */
  | { ok: false; reason: 'version' | 'invalid' };

const cell = (x: number, y: number): string => x.toString(16) + y.toString(16);

function encodeAction(a: Action): string {
  switch (a[0]) {
    case 'build':
      return TOWER_CODE[a[1]] + cell(a[2], a[3]);
    case 'up':
      return 'u' + cell(a[1], a[2]);
    case 'sell':
      return 's' + cell(a[1], a[2]);
    case 'mode':
      return 'o' + cell(a[1], a[2]) + MODE_CODE[a[3]];
  }
}

export function encodeDefence(s: Solution): string {
  const waves = s.waves.map((w) => w.map(encodeAction).join(''));
  return waves.join('.');
}

function index(steps: readonly number[], value: number): number {
  const i = steps.indexOf(value);
  if (i < 0) throw new Error(`${value} is not one of ${steps.join(', ')}`);
  return i;
}

function encodeGroup(g: SpawnGroup): string {
  return (
    ENEMY_CODE[g.enemy] +
    index(HP_STEPS, g.hp ?? 1) +
    index(GAP_STEPS, g.gap) +
    index(DELAY_STEPS, g.delay ?? 0) +
    (g.spawn ?? 0) +
    g.count
  );
}

export function encodeAttack(waves: Wave[]): string {
  return waves.map((w) => w.groups.map(encodeGroup).join(',')).join('.');
}

export function encodeDuel(d: Duel): string {
  const parts = [String(LINK_FORMAT), String(DUEL_VERSION), MAP_CODE[d.map]];
  parts.push(encodeDefence(d.challenger));
  if (d.rival) parts.push(encodeAttack(d.rival.attack), encodeDefence(d.rival.defence));
  if (d.rival && d.reply) parts.push(encodeAttack(d.reply));
  return parts.join('~');
}

const ACTION = /^(?:[palmtbw][0-9a-f][0-9]|[us][0-9a-f][0-9]|o[0-9a-f][0-9][flsw])/;

function decodeDefence(text: string, map: DuelMapId): Solution | null {
  if (text.length > 4000) return null;
  const grid = parseMap(duelLevel(map, []).map);
  const waves: Action[][] = [];
  for (const chunk of text === '' ? [] : text.split('.')) {
    const actions: Action[] = [];
    let rest = chunk;
    while (rest) {
      const m = ACTION.exec(rest);
      if (!m) return null;
      const t = m[0];
      rest = rest.slice(t.length);
      const x = parseInt(t[1]!, 16);
      const y = parseInt(t[2]!, 16);
      if (!isBuildableTile(tileAt(grid, x, y))) return null;
      const tower = TOWER_OF[t[0]!];
      if (tower) actions.push(['build', tower, x, y]);
      else if (t[0] === 'u') actions.push(['up', x, y]);
      else if (t[0] === 's') actions.push(['sell', x, y]);
      else actions.push(['mode', x, y, MODE_OF[t[3]!]!]);
    }
    waves.push(actions);
  }
  if (waves.length > DUEL_WAVE_COUNT) return null;
  return { level: duelLevelId(map), waves };
}

const GROUP = /^([a-z])([0-4])([0-4])([0-3])([01])([1-9][0-9]{0,2})$/;

function decodeAttack(text: string): Wave[] | null {
  if (text.length > 2000) return null;
  const waves: Wave[] = [];
  for (const chunk of text.split('.')) {
    const groups: SpawnGroup[] = [];
    for (const token of chunk.split(',')) {
      const m = GROUP.exec(token);
      const enemy = m ? ENEMY_OF[m[1]!] : undefined;
      if (!m || !enemy) return null;
      groups.push({
        enemy,
        hp: HP_STEPS[Number(m[2])],
        gap: GAP_STEPS[Number(m[3])]!,
        delay: DELAY_STEPS[Number(m[4])],
        spawn: Number(m[5]),
        count: Number(m[6]),
      });
    }
    waves.push({ groups });
  }
  return validateAttack(waves) === null ? waves : null;
}

/** Reads a duel from its link text. Anything from a link is untrusted: a bad one gives a reason. */
export function decodeDuel(text: string): DecodeResult {
  const invalid: DecodeResult = { ok: false, reason: 'invalid' };
  const parts = text.split('~');
  if (parts.length < 4 || parts.length > 7 || parts.length === 5) return invalid;
  const [format, balance, mapCode, ...rest] = parts;
  if (!/^\d+$/.test(format ?? '') || !/^\d+$/.test(balance ?? '')) return invalid;
  if (Number(format) !== LINK_FORMAT || Number(balance) !== DUEL_VERSION)
    return { ok: false, reason: 'version' };
  const map = MAP_OF[mapCode ?? ''];
  if (!map) return invalid;
  const challenger = decodeDefence(rest[0] ?? '', map);
  if (!challenger) return invalid;
  const duel: Duel = { map, challenger };
  if (rest.length >= 3) {
    const attack = decodeAttack(rest[1] ?? '');
    const defence = decodeDefence(rest[2] ?? '', map);
    if (!attack || !defence) return invalid;
    duel.rival = { attack, defence };
  }
  if (rest.length === 4) {
    const reply = decodeAttack(rest[3] ?? '');
    if (!reply) return invalid;
    duel.reply = reply;
  }
  return { ok: true, duel };
}

/** The hash of a duel link: `#duel=<text>`. */
export function duelHash(d: Duel): string {
  return `#${HASH_KEY}=${encodeDuel(d)}`;
}

/** The duel in a location hash, null when the hash carries none. */
export function duelFromHash(hash: string): DecodeResult | null {
  const m = /^#duel=(.*)$/.exec(hash);
  return m ? decodeDuel(m[1] ?? '') : null;
}

// Every kind has a letter, so a new monster or defender cannot ship without one.
for (const k of TOWER_KINDS) if (!TOWER_CODE[k]) throw new Error(`no link letter for ${k}`);
for (const k of ENEMY_KINDS) if (!ENEMY_CODE[k]) throw new Error(`no link letter for ${k}`);
for (const k of TARGET_MODES) if (!MODE_CODE[k]) throw new Error(`no link letter for ${k}`);
for (const k of DUEL_MAP_IDS) if (!MAP_CODE[k]) throw new Error(`no link letter for ${k}`);

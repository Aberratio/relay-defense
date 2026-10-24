import type { EnemyKind, Wave } from '../engine/types';
import {
  DUEL_BUDGET,
  MAX_COUNT,
  MAX_GROUPS,
  attackCost,
  groupCost,
  sparringWaves,
} from '../levels/duel';

// The wave editor's model: pure edits on a draft attack. The screen only shows the draft and calls
// these; every edit returns a new draft and never breaks the shape `validateAttack` relies on.

export type GroupField = 'enemy' | 'count' | 'hp' | 'gap' | 'delay' | 'spawn';

/** A fresh attack starts from the sparring waves: legal, 546 of 560 gold. */
export function newDraft(): Wave[] {
  return sparringWaves();
}

const copy = (waves: Wave[]): Wave[] =>
  waves.map((w) => ({ groups: w.groups.map((g) => ({ ...g })) }));

/** A new group of ten Goblins in wave `w`; nothing when the wave already has four groups. */
export function addGroup(waves: Wave[], w: number): Wave[] {
  const out = copy(waves);
  const wave = out[w];
  if (!wave || wave.groups.length >= MAX_GROUPS) return out;
  wave.groups.push({ enemy: 'spark', count: 10, gap: 0.6, spawn: 0, hp: 1, delay: 0 });
  return out;
}

/** Removes group `g` of wave `w`; a wave keeps its last group. */
export function removeGroup(waves: Wave[], w: number, g: number): Wave[] {
  const out = copy(waves);
  const wave = out[w];
  if (!wave || wave.groups.length <= 1) return out;
  wave.groups.splice(g, 1);
  return out;
}

/** Sets one field of a group. A count is kept a whole number from 1 to the cap. */
export function setField(
  waves: Wave[],
  w: number,
  g: number,
  field: GroupField,
  value: number | EnemyKind,
): Wave[] {
  const out = copy(waves);
  const group = out[w]?.groups[g];
  if (!group) return out;
  if (field === 'enemy') group.enemy = value as EnemyKind;
  else if (field === 'count') {
    const n = Math.floor(Number(value));
    group.count = Number.isFinite(n) ? Math.min(MAX_COUNT, Math.max(1, n)) : 1;
  } else group[field] = Number(value);
  return out;
}

export function goldLeft(waves: Wave[]): number {
  return DUEL_BUDGET - attackCost(waves);
}

/** The largest count group `g` of wave `w` can have with the gold the rest of the attack leaves. */
export function mostAffordable(waves: Wave[], w: number, g: number): number {
  const group = waves[w]?.groups[g];
  if (!group) return 0;
  const rest = attackCost(waves) - groupCost(group);
  let n = 0;
  // Counts are small (at most 500) and a group's cost rounds up, so counting is exact and cheap.
  while (n < MAX_COUNT && rest + groupCost({ ...group, count: n + 1 }) <= DUEL_BUDGET) n++;
  return n;
}

/** Group `g` of wave `w` filled up with all the gold that is left (at least one monster). */
export function fillGroup(waves: Wave[], w: number, g: number): Wave[] {
  return setField(waves, w, g, 'count', Math.max(1, mostAffordable(waves, w, g)));
}

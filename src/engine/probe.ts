import { Game } from './game';
import { isBuildableTile, tileAt } from './grid';
import { TOWERS } from './stats';
import type { LevelDef, TowerKind } from './types';

/** Small seeded generator (mulberry32), so a probe run is repeatable. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A careless player: in every build phase it spends its credits on random towers (no walls) on
 * random free cells within reach of the current route, and upgrades at random. It never plans a
 * maze, a counter or a combination. Returns true when it wins.
 */
export function carelessRun(level: LevelDef, seed: number): boolean {
  const random = rng(seed);
  const game = new Game(level);
  const kinds = level.towers.filter((k): k is Exclude<TowerKind, 'wall'> => k !== 'wall');
  const pick = <T>(list: readonly T[]): T | undefined => list[Math.floor(random() * list.length)];
  let guard = 0;
  while (game.phase === 'build' && guard++ < 100) {
    const near = new Set<string>();
    for (const r of game.routes()) {
      for (const c of r) {
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) near.add(`${c.x + dx},${c.y + dy}`);
        }
      }
    }
    const cells = [...near]
      .map((k) => k.split(',').map(Number) as [number, number])
      .filter(([x, y]) => isBuildableTile(tileAt(game.grid, x, y)));
    for (let tries = 0; tries < 60; tries++) {
      if (game.towers.length > 0 && random() < 0.35) {
        const t = pick(game.towers);
        if (t) game.upgrade(t.id);
        continue;
      }
      const kind = pick(kinds);
      const cell = pick(cells);
      if (!kind || !cell || game.credits < TOWERS[kind].levels[0].cost) continue;
      game.place(kind, cell[0], cell[1]);
    }
    game.startWave();
    let ticks = 0;
    while (game.running() && ticks++ < 30 * 60 * 10) game.step();
    game.drainEvents();
  }
  return game.phase === 'won';
}

/** Share of `runs` careless players that win the level. */
export function carelessWinRate(level: LevelDef, runs: number, seed = 1): number {
  let wins = 0;
  for (let i = 0; i < runs; i++) if (carelessRun(level, seed + i * 7919)) wins++;
  return wins / runs;
}

import { describe, expect, it } from 'vitest';
import { Game } from '../src/engine/game';
import { carelessWinRate } from '../src/engine/probe';
import { replay } from '../src/engine/replay';
import { LEVELS } from '../src/levels/levels';
import { SOLUTIONS } from './solutions';

describe('levels', () => {
  it('have unique ids and 16 x 10 maps', () => {
    expect(new Set(LEVELS.map((l) => l.id)).size).toBe(LEVELS.length);
    for (const level of LEVELS) {
      expect(level.map, level.id).toHaveLength(10);
      for (const row of level.map) expect(row, level.id).toHaveLength(16);
    }
  });

  it('open with every spawn connected to the core', () => {
    for (const level of LEVELS) {
      const game = new Game(level);
      for (const route of game.routes()) expect(route.length, level.id).toBeGreaterThan(1);
    }
  });

  it.each(LEVELS.map((l) => [l.id, l] as const))(
    '%s is won by its reference solution',
    (id, level) => {
      const solution = SOLUTIONS.find((s) => s.level === id);
      expect(solution, `no solution for ${id}`).toBeDefined();
      const result = replay(level, solution!);
      expect(result.rejected).toEqual([]);
      expect(result.outcome).toBe('won');
    },
  );

  // From the third level on, a careless player (random agents near the route, no plan) loses.
  it.each(LEVELS.slice(2).map((l) => [l.id, l] as const))(
    '%s is hard to win by chance',
    (_id, level) => {
      expect(carelessWinRate(level, 30)).toBeLessThanOrEqual(0.15);
    },
  );

  it('is lost when nothing is built', () => {
    for (const level of LEVELS)
      expect(replay(level, { level: level.id, waves: [] }).outcome, level.id).toBe('lost');
  });
});

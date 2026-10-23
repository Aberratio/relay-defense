import { Game } from './game';
import type { Carry, LevelDef, TargetMode, TowerKind } from './types';

/**
 * A scripted plan: the actions taken in the build phase before each wave. Coordinates are map
 * cells. `up`, `sell` and `mode` address the tower standing on that cell.
 */
export type Action =
  | ['build', TowerKind, number, number]
  | ['up', number, number]
  | ['sell', number, number]
  | ['mode', number, number, TargetMode];

export interface Solution {
  level: string;
  /** `waves[i]`: actions before wave i starts. Missing entries mean no action. */
  waves: Action[][];
}

export interface WaveReport {
  wave: number;
  lives: number;
  credits: number;
  leaks: number;
}

export interface ReplayResult {
  outcome: 'won' | 'lost';
  lives: number;
  credits: number;
  waves: WaveReport[];
  /** Actions the game refused, as "wave i: action". */
  rejected: string[];
  game: Game;
}

/** Applies one action; returns false when the game refuses it. */
export function apply(game: Game, action: Action): boolean {
  switch (action[0]) {
    case 'build':
      return game.place(action[1], action[2], action[3]) !== null;
    case 'up': {
      const t = game.towerAt(action[1], action[2]);
      return t ? game.upgrade(t.id) : false;
    }
    case 'sell': {
      const t = game.towerAt(action[1], action[2]);
      return t ? game.sell(t.id) : false;
    }
    case 'mode': {
      const t = game.towerAt(action[1], action[2]);
      if (!t) return false;
      game.setMode(t.id, action[3]);
      return true;
    }
  }
}

/** Plays a whole level headless: the actions of each build phase, then the wave to its end. */
export function replay(level: LevelDef, solution: Solution, maxTicks = 30 * 60 * 30): ReplayResult {
  return play(new Game(level), solution, maxTicks);
}

/**
 * Plays Siege chapters one after another: each starts from what the one before left (its gold and
 * defenders) and runs its own solution on top. Stops at the first lost chapter.
 */
export function replayChain(
  levels: LevelDef[],
  solutions: Solution[],
  maxTicks = 30 * 60 * 30,
): ReplayResult[] {
  const out: ReplayResult[] = [];
  let carry: Carry | null = null;
  levels.forEach((level) => {
    if (out.some((r) => r.outcome === 'lost')) return;
    const game = carry ? Game.resume(level, carry) : new Game(level);
    const solution = solutions.find((s) => s.level === level.id) ?? { level: level.id, waves: [] };
    const result = play(game, solution, maxTicks);
    carry = result.game.carry();
    out.push(result);
  });
  return out;
}

/** Plays a game from its current build phase to the end with a solution. */
export function play(game: Game, solution: Solution, maxTicks = 30 * 60 * 30): ReplayResult {
  const level = game.level;
  const waves: WaveReport[] = [];
  const rejected: string[] = [];
  let ticks = 0;
  while (game.phase === 'build') {
    const wave = game.wave;
    for (const action of solution.waves[wave] ?? []) {
      if (!apply(game, action)) rejected.push(`wave ${wave}: ${action.join(' ')}`);
    }
    const leaksBefore = game.stats.leaks;
    game.startWave();
    while (game.running() && ticks++ < maxTicks) game.step();
    game.drainEvents();
    waves.push({
      wave,
      lives: game.lives,
      credits: game.credits,
      leaks: game.stats.leaks - leaksBefore,
    });
    if (ticks >= maxTicks) throw new Error(`${level.id}: replay did not finish`);
  }
  return {
    outcome: game.phase === 'won' ? 'won' : 'lost',
    lives: game.lives,
    credits: game.credits,
    waves,
    rejected,
    game,
  };
}

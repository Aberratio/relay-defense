// The board behind the menu's title: Two Fronts mid-fight, played by the same engine as the game.
// The plan is the start of the level's reference solution (tests/solutions.ts); a test checks the
// game accepts every action, so the scene can never show an illegal board.
import { Game } from '../engine/game';
import { DT } from '../engine/stats';
import { apply, type Action } from '../engine/replay';
import { LEVELS } from '../levels/levels';

export const SHOWCASE_LEVEL = 'two-fronts';

/** Build actions before each wave, up to the wave the scene shows. */
export const SHOWCASE_PLAN: Action[][] = [
  [
    ['build', 'lance', 4, 1],
    ['build', 'lance', 14, 5],
    ['build', 'pulse', 13, 4],
    ['up', 13, 4],
    ['build', 'wall', 6, 2],
  ],
  [
    ['build', 'lance', 3, 7],
    ['build', 'wall', 5, 1],
    ['build', 'wall', 13, 3],
  ],
  [
    ['build', 'beacon', 5, 2],
    ['build', 'throttle', 3, 3],
    ['build', 'wall', 5, 8],
  ],
  [
    ['build', 'beacon', 12, 2],
    ['build', 'beacon', 6, 6],
    ['build', 'mortar', 7, 7],
  ],
];

/** Seconds into the shown wave where the scene starts, so monsters are already on the board. */
export const SHOWCASE_LEAD = 9;

/**
 * Plays the plan headless up to the build phase of its last wave and returns that game, or null
 * if the engine refused anything (the scene is then left out rather than shown wrong).
 */
export function showcaseStart(): Game | null {
  const level = LEVELS.find((l) => l.id === SHOWCASE_LEVEL);
  if (!level) return null;
  const game = new Game(level);
  for (const [w, actions] of SHOWCASE_PLAN.entries()) {
    if (game.phase !== 'build') return null;
    for (const action of actions) if (!apply(game, action)) return null;
    if (w === SHOWCASE_PLAN.length - 1) break;
    game.startWave();
    for (let ticks = 0; game.running() && ticks < 30 * 60 * 5; ticks++) game.step();
    game.drainEvents();
  }
  return game.phase === 'build' ? game : null;
}

/** Starts the shown wave on a copy of `start` and plays it `seconds` in. */
export function showcaseScene(start: Game, seconds = SHOWCASE_LEAD): Game {
  const game = start.clone();
  game.startWave();
  for (let t = 0; t < seconds && game.running(); t += DT) game.step();
  game.drainEvents();
  return game;
}

import type { Game } from '../engine/game';
import { apply, type Action, type Solution } from '../engine/replay';
import { DUEL_WAVE_COUNT } from '../levels/duel';

/**
 * Writes down a sparring run as a defence: every build-phase action the game accepts, under the
 * wave it was taken before. Replaying the result on the same waves gives the same game, and on a
 * rival's waves it is the player's defence (an action the gold no longer covers is skipped).
 */
export class Recorder {
  private waves: Action[][] = Array.from({ length: DUEL_WAVE_COUNT }, () => []);

  /** Applies an action to the game and keeps it when the game accepts it. */
  act(game: Game, action: Action): boolean {
    // Only the build phase counts: a replay applies actions between waves, never during one.
    if (game.phase !== 'build') return false;
    const ok = apply(game, action);
    if (ok) this.waves[game.wave]?.push(action);
    return ok;
  }

  solution(level: string): Solution {
    return { level, waves: this.waves.map((w) => [...w]) };
  }
}

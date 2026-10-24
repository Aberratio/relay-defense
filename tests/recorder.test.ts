import { describe, expect, it } from 'vitest';
import { Game } from '../src/engine/game';
import { replay } from '../src/engine/replay';
import { Recorder } from '../src/duel/recorder';
import { duelLevel, sparringLevel } from '../src/levels/duel';
import { DUEL_DEFENCES } from './duel-solutions';

/** One Goblin a wave: the run lasts all four waves whatever is built. */
const gentle = () =>
  duelLevel(
    'siege',
    Array.from({ length: 4 }, () => ({
      groups: [{ enemy: 'spark' as const, count: 1, gap: 1, spawn: 0, hp: 1, delay: 0 }],
    })),
  );

/** Plays the waves out the way the screen does, between the player's actions. */
function playWave(game: Game): void {
  game.startWave();
  while (game.running()) game.step();
  game.drainEvents();
}

describe('recording a sparring run', () => {
  it('replays to the very game that was played: lives and gold after every wave', () => {
    const level = sparringLevel('siege');
    const game = new Game(level);
    const rec = new Recorder();
    const live: [number, number][] = [];
    // The reference defence, taken action by action as a player would, plus a refused one.
    const script = DUEL_DEFENCES.find((d) => d.level === 'duel-siege')!;
    for (const actions of script.waves) {
      for (const a of actions) expect(rec.act(game, a)).toBe(true);
      expect(rec.act(game, ['build', 'lance', 0, 0])).toBe(false); // rock: refused, not kept
      playWave(game);
      live.push([game.lives, game.credits]);
    }
    const again = replay(level, rec.solution(level.id));
    expect(again.waves.map((w) => [w.lives, w.credits])).toEqual(live);
    expect(again.rejected).toEqual([]);
  });

  it('keeps each action under the wave it was taken before', () => {
    const game = new Game(gentle());
    const rec = new Recorder();
    rec.act(game, ['build', 'pulse', 3, 3]);
    playWave(game);
    rec.act(game, ['up', 3, 3]);
    rec.act(game, ['mode', 3, 3, 'strong']);
    expect(rec.solution('duel-siege').waves).toEqual([
      [['build', 'pulse', 3, 3]],
      [
        ['up', 3, 3],
        ['mode', 3, 3, 'strong'],
      ],
      [],
      [],
    ]);
  });

  it('refuses an action during a wave, which a replay could not repeat', () => {
    const game = new Game(gentle());
    const rec = new Recorder();
    rec.act(game, ['build', 'pulse', 3, 3]);
    game.startWave();
    game.step();
    expect(rec.act(game, ['mode', 3, 3, 'last'])).toBe(false);
    expect(game.towerAt(3, 3)?.mode).toBe('first');
    expect(rec.solution('duel-siege').waves[0]).toEqual([['build', 'pulse', 3, 3]]);
  });
});

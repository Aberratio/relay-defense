// The replays the determinism check compares across JavaScript engines (scripts/determinism.ts).
// It runs in Node and, bundled, in browsers, so it imports nothing that needs either.
import { Game } from '../src/engine/game';
import { apply, type Solution } from '../src/engine/replay';
import type { Carry, LevelDef } from '../src/engine/types';
import { LEVELS } from '../src/levels/levels';
import { SIEGE_CHAPTERS } from '../src/levels/siege';
import { SIEGE_CHAIN, SIEGE_FLOOR } from '../tests/siege-solutions';
import { SOLUTIONS } from '../tests/solutions';

export interface Fingerprint {
  name: string;
  outcome: string;
  lives: number;
  credits: number;
  /** Lives and credits after every wave. */
  waves: [number, number][];
  ticks: number;
  /** FNV-1a over the bits of every simulated number after every tick. */
  hash: string;
}

const f64 = new Float64Array(1);
const u32 = new Uint32Array(f64.buffer);

class Hasher {
  h = 0x811c9dc5;
  mix(n: number): void {
    f64[0] = n;
    for (let i = 0; i < 2; i++) {
      this.h ^= u32[i] ?? 0;
      this.h = Math.imul(this.h, 0x01000193) >>> 0;
    }
  }
  /**
   * Everything the simulation computes with. A tower's `angle` is left out: only the renderer
   * reads it, and it comes from Math.atan2, which differs between engines in the last bit.
   */
  state(game: Game): void {
    for (const e of game.enemies) {
      this.mix(e.id);
      this.mix(e.x);
      this.mix(e.y);
      this.mix(e.hp);
      this.mix(e.slow);
      this.mix(e.walked);
    }
    for (const t of game.towers) {
      this.mix(t.id);
      this.mix(t.cooldown);
    }
    for (const s of game.shots) {
      this.mix(s.id);
      this.mix(s.x);
      this.mix(s.y);
    }
    this.mix(game.credits);
    this.mix(game.lives);
  }
}

function play(name: string, game: Game, solution: Solution): Fingerprint {
  const hasher = new Hasher();
  const waves: [number, number][] = [];
  let ticks = 0;
  while (game.phase === 'build') {
    for (const action of solution.waves[game.wave] ?? []) apply(game, action);
    game.startWave();
    while (game.running()) {
      game.step();
      ticks++;
      hasher.state(game);
    }
    game.drainEvents();
    waves.push([game.lives, game.credits]);
  }
  return {
    name,
    outcome: game.phase,
    lives: game.lives,
    credits: game.credits,
    waves,
    ticks,
    hash: hasher.h.toString(16),
  };
}

const solutionOf = (list: Solution[], level: LevelDef): Solution =>
  list.find((s) => s.level === level.id) ?? { level: level.id, waves: [] };
const empty = (level: LevelDef): Solution => ({ level: level.id, waves: [] });

/** Every reference solution, every level and chapter with no defence, and the Siege chain. */
export function fingerprints(): Fingerprint[] {
  const out: Fingerprint[] = [];
  for (const l of LEVELS) out.push(play(`level ${l.id}`, new Game(l), solutionOf(SOLUTIONS, l)));
  for (const l of SIEGE_CHAPTERS)
    out.push(play(`floor ${l.id}`, new Game(l), solutionOf(SIEGE_FLOOR, l)));
  for (const l of [...LEVELS, ...SIEGE_CHAPTERS])
    out.push(play(`empty ${l.id}`, new Game(l), empty(l)));
  let carry: Carry | null = null;
  for (const l of SIEGE_CHAPTERS) {
    const game: Game = carry ? Game.resume(l, carry) : new Game(l);
    const f = play(`chain ${l.id}`, game, solutionOf(SIEGE_CHAIN, l));
    out.push(f);
    if (f.outcome !== 'won') break;
    carry = game.carry();
  }
  return out;
}

// Greedy look-ahead solver, used to balance levels and to write the reference solutions in
// tests/solutions.ts and tests/siege-solutions.ts. In every build phase it tries each affordable
// action (a tower on a cell near the route, an upgrade), simulates the coming waves without
// further changes, keeps the action with the best outcome, and repeats until nothing helps. It
// prints the solution as TypeScript.
//
//   npm run solve -- <level-id> [hp-scale] [look-ahead waves]
//   npm run solve -- siege-<n> [hp-scale] [look-ahead waves]   a Siege chapter from its floor
//   npm run solve -- siege [hp-scale] [look-ahead waves]       the whole Siege, chapter by chapter
import { Game } from '../src/engine/game';
import { isBuildableTile, tileAt } from '../src/engine/grid';
import type { Action } from '../src/engine/replay';
import { apply } from '../src/engine/replay';
import { TOWERS, invested } from '../src/engine/stats';
import type { LevelDef } from '../src/engine/types';
import { levelById } from '../src/levels/levels';
import { SIEGE_CHAPTERS, chapterById } from '../src/levels/siege';

const [id = '', scaleArg = '1', aheadArg = '2'] = process.argv.slice(2);
const scale = Number(scaleArg);
const ahead = Number(aheadArg);

function scaled(base: LevelDef): LevelDef {
  return {
    ...base,
    waves: base.waves.map((w) => ({
      groups: w.groups.map((g) => ({ ...g, hp: (g.hp ?? 1) * scale })),
    })),
  };
}

/** Plays `waves` waves with no further action; a higher score is a safer position. */
function score(game: Game, waves: number): number {
  const g = game.clone();
  let margin = 0;
  for (let i = 0; i < waves && g.phase === 'build'; i++) {
    g.startWave();
    while (g.running()) {
      g.step();
      for (const e of g.drainEvents()) {
        // Kills far from the core are worth more: the defence has room to spare.
        if (e.type === 'kill') {
          const cell = { x: Math.floor(e.at.x), y: Math.floor(e.at.y) };
          margin += Math.min(40, g.distAt(cell));
        }
        // A little credit for damage, so that in a losing position one more defender still
        // counts and the search does not stall before the defence is big enough to kill.
        if (e.type === 'hit') margin += e.damage * 0.02;
      }
    }
  }
  const won = g.phase === 'won' ? 1 : 0;
  // Gold is worth nothing in a lost game; holding out longer is what tells a better try apart.
  const tail = g.phase === 'lost' ? g.tick * 10 : g.credits * 0.5;
  return won * 1e9 + g.lives * 1e6 + margin + tail;
}

function candidates(game: Game): Action[] {
  const near = new Set<string>();
  for (const r of game.routes()) {
    for (const c of r) {
      for (let dy = -3; dy <= 3; dy++)
        for (let dx = -3; dx <= 3; dx++) near.add(`${c.x + dx},${c.y + dy}`);
    }
  }
  const out: Action[] = [];
  for (const key of near) {
    const [x, y] = key.split(',').map(Number) as [number, number];
    if (!isBuildableTile(tileAt(game.grid, x, y))) continue;
    for (const kind of game.level.towers) {
      if (game.credits >= TOWERS[kind].levels[0].cost && !game.canPlace(kind, x, y))
        out.push(['build', kind, x, y]);
    }
  }
  for (const t of game.towers) {
    const cost = game.upgradeCost(t);
    if (cost !== null && cost <= game.credits) out.push(['up', t.x, t.y]);
  }
  return out;
}

/** Plays a game to its end, greedily choosing the actions of each build phase. */
function solve(game: Game): Action[][] {
  const plan: Action[][] = [];
  while (game.phase === 'build') {
    const actions: Action[] = [];
    const horizon = Math.min(ahead, game.waveCount - game.wave);
    let current = score(game, horizon);
    for (;;) {
      let best: { action: Action; value: number } | null = null;
      for (const action of candidates(game)) {
        const trial = game.clone();
        apply(trial, action);
        const value = score(trial, horizon);
        if (!best || value > best.value) best = { action, value };
      }
      if (!best || best.value <= current) break;
      apply(game, best.action);
      actions.push(best.action);
      current = best.value;
    }
    plan.push(actions);
    game.startWave();
    while (game.running()) game.step();
    game.drainEvents();
    console.error(
      `wave ${plan.length}: ${actions.length} actions, lives ${game.lives}, credits ${game.credits}`,
    );
  }
  return plan;
}

function print(levelId: string, plan: Action[][]): void {
  const lines = plan.map(
    (a) =>
      `      [${a.map((x) => JSON.stringify(x).replace(/"/g, "'").replace(/,/g, ', ')).join(', ')}],`,
  );
  console.info(`  {\n    level: '${levelId}',\n    waves: [\n${lines.join('\n')}\n    ],\n  },`);
}

/** Gold plus the full value of the defenders: what a Siege chapter's floor is compared with. */
function wealth(game: Game): number {
  return game.credits + game.towers.reduce((sum, t) => sum + invested(t.kind, t.level), 0);
}

if (id === 'siege') {
  let game: Game | null = null;
  for (const base of SIEGE_CHAPTERS) {
    const level = scaled(base);
    const before = game ? wealth(game) : level.credits;
    game = game ? Game.resume(level, game.carry()) : new Game(level);
    console.error(`${level.id}: brought ${before}, floor ${level.credits}`);
    const plan = solve(game);
    console.error(`${level.id} x${scale}: ${game.phase} with ${game.lives}/${level.lives} lives`);
    print(level.id, plan);
    if (game.phase !== 'won') break;
  }
} else {
  const base = levelById(id) ?? chapterById(id);
  if (!base) throw new Error(`no level "${id}"`);
  const level = scaled(base);
  const game = new Game(level);
  const plan = solve(game);
  console.error(`${id} x${scale}: ${game.phase} with ${game.lives}/${level.lives} lives`);
  print(id, plan);
}

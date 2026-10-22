// Greedy look-ahead solver, used to balance levels and to write the reference solutions in
// tests/solutions.ts. In every build phase it tries each affordable action (a tower on a cell near
// the route, an upgrade), simulates the coming waves without further changes, keeps the action
// with the best outcome, and repeats until nothing helps. It prints the solution as TypeScript.
//
//   npm run solve -- <level-id> [hp-scale] [look-ahead waves]
import { Game } from '../src/engine/game';
import { isBuildableTile, tileAt } from '../src/engine/grid';
import type { Action } from '../src/engine/replay';
import { apply } from '../src/engine/replay';
import { TOWERS } from '../src/engine/stats';
import type { LevelDef } from '../src/engine/types';
import { levelById } from '../src/levels/levels';

const [id = '', scaleArg = '1', aheadArg = '2'] = process.argv.slice(2);
const base = levelById(id);
if (!base) throw new Error(`no level "${id}"`);
const scale = Number(scaleArg);
const ahead = Number(aheadArg);
const level: LevelDef = {
  ...base,
  waves: base.waves.map((w) => ({
    groups: w.groups.map((g) => ({ ...g, hp: (g.hp ?? 1) * scale })),
  })),
};

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
      }
    }
  }
  const won = g.phase === 'won' ? 1 : 0;
  return won * 1e9 + g.lives * 1e6 + margin + g.credits * 0.5;
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

const game = new Game(level);
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
console.error(`${id} x${scale}: ${game.phase} with ${game.lives}/${level.lives} lives`);
const lines = plan.map(
  (a) =>
    `      [${a.map((x) => JSON.stringify(x).replace(/"/g, "'").replace(/,/g, ', ')).join(', ')}],`,
);
console.info(`  {\n    level: '${id}',\n    waves: [\n${lines.join('\n')}\n    ],\n  },`);

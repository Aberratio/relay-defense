// Balancing aid: scales the hit points of every wave of a level and reports, per scale, whether
// the scripted solution still wins (and with how many lives) and how often a careless player wins.
//
//   npm run tune -- <level-id> [scales, e.g. 1,1.2,1.4]
import { carelessWinRate } from '../src/engine/probe';
import { replay } from '../src/engine/replay';
import type { LevelDef } from '../src/engine/types';
import { levelById } from '../src/levels/levels';
import { SOLUTIONS } from '../tests/solutions';

const [id = '', scalesArg = '1,1.2,1.4,1.6,1.8,2'] = process.argv.slice(2);
const level = levelById(id);
const solution = SOLUTIONS.find((s) => s.level === id);
if (!level) throw new Error(`no level "${id}"`);

function scaled(l: LevelDef, k: number): LevelDef {
  return {
    ...l,
    waves: l.waves.map((w) => ({ groups: w.groups.map((g) => ({ ...g, hp: (g.hp ?? 1) * k })) })),
  };
}

for (const k of scalesArg.split(',').map(Number)) {
  const l = scaled(level, k);
  const r = solution ? replay(l, solution) : null;
  const rate = carelessWinRate(l, 60);
  const sol = r ? `${r.outcome} lives ${r.lives} (wave ${r.waves.length})` : 'no solution';
  console.info(`x${k.toFixed(2)}  solution ${sol.padEnd(26)} careless ${(rate * 100).toFixed(0)}%`);
}

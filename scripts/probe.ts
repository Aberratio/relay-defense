// Difficulty probe: how often a careless player (random towers near the route, random upgrades,
// no maze, no plan) wins each level. A well-made level is easy to lose that way.
//
//   npm run probe              every level, 100 runs each
//   npm run probe -- 300       every level, 300 runs each
import { carelessWinRate } from '../src/engine/probe';
import { LEVELS } from '../src/levels/levels';

const runs = Number(process.argv[2] ?? 100);
for (const level of LEVELS) {
  const rate = carelessWinRate(level, runs);
  console.info(
    `${level.id.padEnd(16)} careless win rate ${(rate * 100).toFixed(0).padStart(3)}%  (${runs} runs)`,
  );
}

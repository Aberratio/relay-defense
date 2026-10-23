// Plays one level headless with its scripted solution (tests/solutions.ts) and prints each wave
// and the final board. A tool for balancing levels:
//
//   npm run sim -- <level-id>
import { tileAt } from '../src/engine/grid';
import { replay } from '../src/engine/replay';
import { LEVELS, levelById } from '../src/levels/levels';
import { chapterById } from '../src/levels/siege';
import { SIEGE_FLOOR } from '../tests/siege-solutions';
import { SOLUTIONS } from '../tests/solutions';

const GLYPH: Record<string, string> = {
  pulse: 'P',
  arc: 'A',
  lance: 'L',
  mortar: 'M',
  throttle: 'T',
  beacon: 'B',
  wall: 'W',
};

const ids = process.argv.slice(2);
for (const id of ids.length ? ids : LEVELS.map((l) => l.id)) {
  const level = levelById(id) ?? chapterById(id);
  const solution = [...SOLUTIONS, ...SIEGE_FLOOR].find((s) => s.level === id);
  if (!level || !solution) {
    console.error(`no level or solution "${id}"`);
    process.exitCode = 1;
    continue;
  }
  const r = replay(level, solution);
  console.info(
    `\n${id}: ${r.outcome.toUpperCase()} lives ${r.lives}/${level.lives} credits ${r.credits}`,
  );
  for (const w of r.waves) {
    console.info(`  wave ${w.wave + 1}: lives ${w.lives} credits ${w.credits} leaks ${w.leaks}`);
  }
  for (const msg of r.rejected) console.info(`  REJECTED ${msg}`);
  const g = r.game;
  const onRoute = new Set(
    g
      .routes()
      .flat()
      .map((c) => `${c.x},${c.y}`),
  );
  for (let y = 0; y < g.grid.height; y++) {
    let row = '  ';
    for (let x = 0; x < g.grid.width; x++) {
      const t = g.towerAt(x, y);
      if (t) row += t.kind === 'wall' ? 'W' : `${GLYPH[t.kind]}`;
      else if (onRoute.has(`${x},${y}`) && tileAt(g.grid, x, y) === '.') row += '*';
      else row += tileAt(g.grid, x, y);
    }
    console.info(row);
  }
  const route = g.routes().map((r) => r.length - 1);
  console.info(
    `  route length ${route.join(', ')}  damage: ${g.towers
      .filter((t) => t.damageDealt > 0)
      .map((t) => `${GLYPH[t.kind]}${t.level + 1}@${t.x},${t.y}=${Math.round(t.damageDealt)}`)
      .join(' ')}`,
  );
}

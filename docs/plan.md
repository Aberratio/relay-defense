# Relay Defense — plan

A tower defense game for the kokot.it portfolio that rewards thinking over reflexes. It shares the
site's "Relay" brand: a network of agents (the towers) keeps faults (the enemies) away from the
core.

## Design goals

1. **A logic puzzle first.** Every wave is visible before it starts, the simulation is
   deterministic, and the game waits for the player between waves. A level is lost by a bad plan,
   not by a slow click.
2. **Every enemy asks a question, every tower is an answer.** Armour punishes many small hits,
   cloaking needs a scanner, splitters punish single-target damage, healers punish spread-out
   damage, and the open maps let the player lengthen the route.
3. **Geometry matters.** The Lance pierces everything on a line, the Mortar has a dead zone, the
   Beacon boosts its neighbours, and on open maps the towers are the maze.
4. **Proven fair.** Each level ships with a scripted solution that the test suite replays to a
   win, and a probe shows that careless play loses.
5. **Looks like the brand.** Ink background, Signal (amber) for the player's agents, Ion (blue)
   for support effects, state colours for the faults; glow, trails and particles on a 2D canvas.

## Architecture

- `src/engine/` — pure TypeScript simulation, no DOM: grid and tiles, flow-field pathfinding,
  placement rules, towers, enemies, projectiles, waves, economy. Fixed 30 Hz tick.
- `src/levels/` — level data (ASCII maps, budgets, waves, which towers are available).
- `src/render/` — canvas renderer: static background layer, entities, effects, particles.
- `src/ui/` — HUD, build palette, inspector, wave preview, level select, briefings, results,
  i18n (PL/EN), persistence, embed mode (height reporting to kokot.it).
- `tests/` — engine unit tests, level solutions replayed to a win, the difficulty probe,
  language guard.

## Tasks

| #   | Task                                                                   | Done when                                        |
| --- | ---------------------------------------------------------------------- | ------------------------------------------------ |
| 1   | Repository scaffold: Vite, strict TS, ESLint, Prettier, Vitest, CI     | `npm run lint && npm test && npm run build` pass |
| 2   | Engine: grid, tiles, flow field, placement rules (no full blocking)    | unit tests for routing and blocking              |
| 3   | Engine: enemies, towers, projectiles, effects, waves, economy, outcome | unit tests per mechanic                          |
| 4   | Levels 1–10 with briefings; a scripted solution per level              | every solution wins in a test                    |
| 5   | Difficulty probe: random and naive builds on the same budget lose      | probe test and `npm run probe`                   |
| 6   | Renderer: background, towers, enemies, beams, shells, particles, path  | visual check in the browser                      |
| 7   | UI: HUD, palette, inspector, targeting, wave preview, speed, pause     | playable end to end with mouse and keyboard      |
| 8   | Level select, stars, progress saved in the browser, results screen     | progress survives a reload                       |
| 9   | i18n PL/EN, embed mode (`?embed=1&lang=`), height message, a11y, touch | guard tests, keyboard-only play                  |
| 10  | Screenshots, README, public repository, green CI                       | CI green on GitHub                               |
| 11  | kokot.it: case study PL/EN, lock entry, synced build, tests            | site tests and build pass                        |
| 12  | Fresh-session review, merge, production deploy on Vercel               | the page is live on kokot.it                     |
| 13  | Siege: five chapters on one map, carried defence, hardships, proofs    | floor and chain solutions win in a test          |

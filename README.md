# Relay Defense

A tower defense game that rewards a plan over reflexes. Faults stream from the gates towards the
core; you place agents, read every wave before it starts and pick the right answer to each threat.
Ten levels, each built around one idea, every one of them proven winnable in CI.

![Two Fronts: two gates, a maze on open floor, Lance beams through a column of Bulwarks](docs/screenshots/two-fronts-en.png)

Play it on [kokot.it](https://kokot.it/en/projects/relay-defense/). The interface is in English and
Polish.

## What makes it a logic game

- **Nothing is hidden.** The whole wave list is on screen before the first wave, the simulation is
  deterministic, and the game waits between waves. A level is lost by a bad plan, not a slow
  click.
- **Every fault asks a question.** Armour cuts every hit by a flat amount, so many small hits do
  almost nothing. Cloaked Phantoms cannot be hit without a Beacon. Splitters burst into a swarm.
  Menders repair whatever is near them. The Colossus shields its escort and shrugs off slows.
- **Geometry matters.** The Lance pierces everything on a line, so it belongs at the end of a
  straight lane. The Mortar has a dead zone and leads its target, so it pairs with a Throttle.
  The Beacon boosts the eight tiles around it, and boosts add up. On open floor every agent is
  part of the maze, and the preview shows the new route before you commit.
- **Undo is free.** Selling in the same build phase refunds everything, so a layout can be tried
  and taken back. The maze on open floor only changes between waves (sockets stay open), so
  faults cannot be juggled back and forth by opening and closing a gap.

| Agent    | Role                                                             |
| -------- | ---------------------------------------------------------------- |
| Pulse    | cheap single-target fire, useless against armour                 |
| Arc      | chain discharge across faults standing close together            |
| Lance    | rail beam through every fault on its line, ignores armour        |
| Mortar   | leading area shell, cannot hit close by                          |
| Throttle | slow field; two fields do not stack                              |
| Beacon   | reveals cloaked faults, boosts neighbouring agents; boosts stack |
| Wall     | a cheap block for building mazes on open floor                   |

Each agent except the Wall has three levels and four targeting modes (first, last, strongest,
weakest).

## How the levels are balanced

Balancing a puzzle by hand is guesswork, so the repository carries its own tools:

- **A look-ahead solver** (`npm run solve -- <level>`). In each build phase it tries every
  affordable action (an agent on a tile near the route, an upgrade), simulates the coming waves
  on a copy of the game, keeps the best action and repeats. It writes its plan as TypeScript.
- **Reference solutions** (`tests/solutions.ts`), produced by the solver. The test suite replays
  each one and expects a win, so every level is winnable at its shipped difficulty.
- **A difficulty probe** (`npm run probe`). A careless player spends all its credits on random
  agents near the route and upgrades at random. From the third level on it wins at most 15% of
  the time (a test holds that line); in 300 runs per level it
  wins 3% of the third level and at most 1% of any later one.
- **A tuning table** (`npm run tune -- <level>`): solver result and careless win rate across a
  range of enemy strength. Each level ships at 50–90% of the strength the solver can still beat,
  lower for the tutorial levels and closer to the edge for the last ones.

![Split Brain in Polish: Splitters bunched up under a Throttle field](docs/screenshots/split-brain-pl.png)

## Architecture

```
src/engine/   pure TypeScript simulation, no DOM: map and flow-field routing, placement rules,
              agents, faults, shots, waves, economy; fixed 30 Hz tick; clone() for look-ahead
src/levels/   the ten levels: ASCII maps, credits, waves, available agents, difficulty
art/         CC0 source models, Blender scripts and the sprite manifest (art/README.md)
src/render/   2D canvas renderer: cached background layer, interpolated movement, effects,
              particles; vector sprites shared with the UI icons; colours from the brand tokens
src/ui/       menu, briefings, play screen, results, help; input (mouse, touch, keyboard);
              i18n (EN/PL); progress in localStorage; embed mode
scripts/      solver, probe, tuning, replay printer, screenshots, smoke test, guards
tests/        engine mechanics, levels (solutions win, careless play loses), i18n, progress,
              language guard
```

- **Routing.** A breadth-first flow field from the core over walkable tiles. Faults follow it
  tile by tile and prefer to keep their heading, so routes stay straight. A placement is refused
  when it would cut any gate, or any fault already on the board, off from the core.
- **Determinism.** No randomness in the simulation, fixed iteration order, fixed tick. The same
  actions always give the same result, which is what makes replays, the solver and the tests
  possible. Randomness lives only in the renderer's particles.
- **Smooth at any refresh rate.** The board remembers positions before each tick and
  interpolates between ticks; effects age in game time, so they keep pace with the speed setting
  and freeze on pause.

## Accessibility

Keyboard play end to end: `1`–`7` pick an agent, arrow keys move a board cursor with spoken cell
descriptions, `Enter` builds or selects, `Space` starts a wave or pauses, `U`/`S`/`T` upgrade,
sell and change the target, `F` changes speed, `Esc` cancels. Game events are announced in a
live region, dialogs keep focus and make the page behind them inert, and `prefers-reduced-motion` stops screen shake, idle animation
and most particles. On touch screens the first tap previews a placement and the second builds.

## Embedding

`?embed=1&lang=<en|pl>` lays the game out for an iframe: the height follows the width only, and
the page posts `{ type: 'relay-defense:height', height }` to its parent whenever it changes.
`?level=<id>` opens a level directly. This is how [kokot.it](https://kokot.it) embeds it.

## Stack

TypeScript (strict), Vite, Canvas 2D, Vitest, Playwright (smoke test and screenshots), ESLint,
Prettier. No framework and no runtime dependencies.

## Scripts

| Script                   | What it does                                                          |
| ------------------------ | --------------------------------------------------------------------- |
| `npm run dev`            | dev server                                                            |
| `npm run build`          | typecheck and production build to `dist/`                             |
| `npm test`               | unit and level tests                                                  |
| `npm run lint`           | ESLint and Prettier check                                             |
| `npm run smoke`          | plays the build in Chromium and checks the embed height (after build) |
| `npm run solve -- <id>`  | look-ahead solver, prints a solution                                  |
| `npm run sim -- <id>`    | replays the reference solution and prints the board                   |
| `npm run probe`          | careless-player win rate per level                                    |
| `npm run tune -- <id>`   | solver and probe across enemy strength                                |
| `npm run sprites`        | renders the character sprites with Blender (art/README.md)            |
| `npm run screenshots`    | README screenshots (needs `npm run dev -- --port 5391`)               |
| `npm run check:language` | English everywhere except the Polish UI dictionary                    |
| `npm run check:wording`  | wording guard for the build and the docs                              |

Polish text lives only in the Polish block of `src/ui/i18n.ts`; the language guard fails on it
anywhere else.

## Art

The characters are free 3D models (CC0, public domain) given props and rendered to sprites in
Blender by `npm run sprites`; the PNGs are committed. How it works and the full list of files:
[art/README.md](art/README.md).

| Role                        | Model                                         | Author     | Source                                                           |
| --------------------------- | --------------------------------------------- | ---------- | ---------------------------------------------------------------- |
| archer, druid, dryad, fairy | RPG Characters: Ranger, Wizard, Rogue, Cleric | Quaternius | https://opengameart.org/content/lowpoly-rpg-characters           |
| unicorn                     | White Horse                                   | Quaternius | https://poly.pizza/m/bEdE4rmZy9                                  |
| troll                       | Orc                                           | Quaternius | https://poly.pizza/m/5vO2YJsPEf                                  |
| spiderling, brood mother    | Spider                                        | Quaternius | https://poly.pizza/m/yRYJiAJyiM                                  |
| goblin                      | imp model                                     | Quaternius | https://poly.pizza/m/S7jYW6Amye                                  |
| wraith                      | Ghost                                         | Quaternius | https://poly.pizza/m/Iip30bDHmu                                  |
| shaman                      | Mushroom King                                 | Quaternius | https://poly.pizza/m/grnFTziU8u                                  |
| ogre warlord                | Yeti                                          | Quaternius | https://poly.pizza/m/ceRHrn8HHE                                  |
| ent, heart tree             | Tree (two variants)                           | Quaternius | https://poly.pizza/m/qZtx0AHhcy, https://poly.pizza/m/aVOxaHRPWe |
| thorns                      | Hedge                                         | Quaternius | https://poly.pizza/m/df8uCl1YpK                                  |
| portal                      | Arch Round                                    | Quaternius | https://poly.pizza/m/B9QABewqLv                                  |

All models are CC0 1.0. The props added in Blender and the rendered sprites are MIT, like the
code.

## Licence

MIT. The brand fonts (Schibsted Grotesk, JetBrains Mono) are under the SIL Open Font License;
the licences are next to the files in `src/assets/fonts/`.

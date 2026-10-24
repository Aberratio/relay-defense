// Reference defences for the duel maps, written by the solver (scripts/solve.ts) against each
// map's sparring waves:  npm run solve -- duel-<map>
// tests/duel.test.ts replays them: each wins its sparring run, and in a rematch it gives up far
// fewer lives than an empty board.
import type { Solution } from '../src/engine/replay';
import type { Wave } from '../src/engine/types';
import type { DuelMapId } from '../src/levels/duel';

export const DUEL_DEFENCES: Solution[] = [
  {
    level: 'duel-siege',
    waves: [
      [
        ['build', 'lance', 8, 4],
        ['build', 'lance', 9, 5],
        ['build', 'lance', 9, 8],
        ['build', 'beacon', 12, 4],
        ['build', 'lance', 10, 5],
        ['build', 'beacon', 5, 2],
        ['build', 'lance', 2, 3],
      ],
      [
        ['build', 'lance', 8, 5],
        ['build', 'lance', 2, 5],
      ],
      [
        ['build', 'lance', 6, 4],
        ['build', 'throttle', 4, 3],
        ['build', 'beacon', 9, 7],
        ['build', 'pulse', 11, 6],
        ['build', 'throttle', 11, 7],
      ],
      [],
    ],
  },
  {
    level: 'duel-two-fronts',
    waves: [
      [
        ['build', 'lance', 4, 7],
        ['build', 'mortar', 6, 8],
        ['build', 'lance', 2, 3],
        ['build', 'lance', 8, 1],
        ['build', 'beacon', 3, 1],
        ['build', 'mortar', 1, 6],
        ['build', 'throttle', 2, 8],
        ['build', 'pulse', 3, 6],
      ],
      [
        ['build', 'lance', 2, 2],
        ['build', 'beacon', 5, 7],
        ['build', 'throttle', 4, 5],
      ],
      [
        ['build', 'lance', 2, 4],
        ['build', 'beacon', 3, 7],
        ['build', 'lance', 2, 1],
        ['build', 'pulse', 3, 3],
      ],
      [],
    ],
  },
  {
    level: 'duel-colossus',
    waves: [
      [
        ['build', 'mortar', 3, 7],
        ['build', 'lance', 5, 5],
        ['build', 'lance', 6, 5],
        ['build', 'beacon', 3, 2],
        ['build', 'lance', 2, 3],
        ['build', 'wall', 10, 3],
        ['build', 'lance', 3, 6],
        ['build', 'throttle', 2, 4],
      ],
      [
        ['build', 'beacon', 2, 6],
        ['build', 'lance', 2, 7],
        ['up', 2, 4],
      ],
      [
        ['build', 'lance', 2, 1],
        ['up', 2, 4],
      ],
      [],
    ],
  },
];

/**
 * An attack composed against each reference defence (a hill climb over legal waves that sees the
 * defence, as a player does), and the lives it takes from it. Not optimal: a better attack exists.
 */
export const DUEL_ATTACKS: { map: DuelMapId; waves: Wave[]; taken: number }[] = [
  {
    map: 'siege',
    waves: [
      { groups: [{ enemy: 'colossus', count: 9, gap: 0.3, spawn: 1, hp: 1, delay: 4 }] },
      {
        groups: [
          { enemy: 'mite', count: 108, gap: 0.12, spawn: 0, hp: 1, delay: 0 },
          { enemy: 'colossus', count: 2, gap: 1.5, spawn: 1, hp: 1, delay: 2 },
          { enemy: 'spark', count: 5, gap: 1.5, spawn: 0, hp: 4, delay: 0 },
        ],
      },
      { groups: [{ enemy: 'mite', count: 16, gap: 1, spawn: 1, hp: 1, delay: 0 }] },
      {
        groups: [
          { enemy: 'mite', count: 22, gap: 0.6, spawn: 1, hp: 1, delay: 2 },
          { enemy: 'phantom', count: 1, gap: 0.3, spawn: 1, hp: 2, delay: 4 },
        ],
      },
    ],
    taken: 131,
  },
  {
    map: 'two-fronts',
    waves: [
      { groups: [{ enemy: 'spark', count: 1, gap: 0.6, spawn: 1, hp: 2, delay: 8 }] },
      { groups: [{ enemy: 'mite', count: 36, gap: 0.3, spawn: 0, hp: 1, delay: 0 }] },
      { groups: [{ enemy: 'splitter', count: 27, gap: 0.6, spawn: 0, hp: 1, delay: 2 }] },
      {
        groups: [
          { enemy: 'splitter', count: 92, gap: 0.3, spawn: 0, hp: 1, delay: 0 },
          { enemy: 'mite', count: 1, gap: 0.3, spawn: 1, hp: 3, delay: 2 },
        ],
      },
    ],
    taken: 342,
  },
  {
    map: 'colossus',
    waves: [
      {
        groups: [
          { enemy: 'splitter', count: 2, gap: 0.12, spawn: 1, hp: 2, delay: 2 },
          { enemy: 'colossus', count: 1, gap: 1, spawn: 1, hp: 2, delay: 2 },
          { enemy: 'splitter', count: 1, gap: 0.6, spawn: 1, hp: 3, delay: 0 },
        ],
      },
      {
        groups: [
          { enemy: 'phantom', count: 1, gap: 1.5, spawn: 0, hp: 1, delay: 8 },
          { enemy: 'splitter', count: 72, gap: 0.6, spawn: 0, hp: 1, delay: 0 },
          { enemy: 'colossus', count: 1, gap: 0.12, spawn: 0, hp: 2, delay: 4 },
          { enemy: 'phantom', count: 1, gap: 0.12, spawn: 1, hp: 1, delay: 0 },
        ],
      },
      { groups: [{ enemy: 'spark', count: 6, gap: 0.3, spawn: 0, hp: 1, delay: 0 }] },
      {
        groups: [
          { enemy: 'mite', count: 34, gap: 0.12, spawn: 1, hp: 1, delay: 0 },
          { enemy: 'phantom', count: 2, gap: 0.6, spawn: 0, hp: 1, delay: 2 },
        ],
      },
    ],
    taken: 79,
  },
];

// Reference solutions for the Siege, written by the solver (scripts/solve.ts):
//   SIEGE_FLOOR  npm run solve -- siege-<n>   each chapter from an empty board and its floor gold
//   SIEGE_CHAIN  npm run solve -- siege       the whole campaign, each chapter on what the last left
// tests/siege.test.ts replays them and expects every chapter won.
import type { Solution } from '../src/engine/replay';

export const SIEGE_FLOOR: Solution[] = [
  {
    level: 'siege-1',
    waves: [
      [
        ['build', 'lance', 5, 4],
        ['build', 'lance', 9, 4],
        ['build', 'arc', 11, 5],
      ],
      [['up', 5, 4]],
      [
        ['build', 'beacon', 8, 3],
        ['up', 8, 3],
      ],
      [['up', 9, 4]],
    ],
  },
  {
    level: 'siege-2',
    waves: [
      [
        ['build', 'lance', 5, 4],
        ['build', 'lance', 9, 4],
        ['build', 'lance', 11, 5],
        ['build', 'lance', 10, 4],
        ['build', 'lance', 4, 4],
        ['build', 'wall', 8, 3],
        ['build', 'throttle', 9, 8],
        ['build', 'wall', 6, 4],
        ['up', 9, 8],
      ],
      [
        ['build', 'lance', 10, 5],
        ['build', 'wall', 3, 6],
      ],
      [
        ['build', 'beacon', 9, 6],
        ['build', 'beacon', 6, 5],
        ['build', 'throttle', 5, 8],
      ],
      [],
    ],
  },
  {
    level: 'siege-3',
    waves: [
      [
        ['build', 'throttle', 13, 7],
        ['up', 13, 7],
        ['up', 13, 7],
        ['build', 'lance', 10, 7],
        ['build', 'lance', 10, 6],
        ['build', 'lance', 11, 7],
        ['build', 'beacon', 13, 6],
        ['build', 'lance', 9, 7],
        ['build', 'pulse', 11, 6],
      ],
      [
        ['build', 'lance', 6, 3],
        ['build', 'lance', 8, 4],
        ['build', 'throttle', 5, 5],
        ['build', 'lance', 2, 3],
        ['build', 'lance', 5, 3],
        ['build', 'throttle', 2, 5],
        ['build', 'lance', 5, 2],
      ],
      [
        ['up', 2, 5],
        ['up', 2, 5],
        ['build', 'lance', 4, 4],
        ['build', 'beacon', 9, 8],
      ],
      [],
    ],
  },
  {
    level: 'siege-4',
    waves: [
      [
        ['build', 'throttle', 13, 4],
        ['build', 'lance', 14, 5],
        ['build', 'lance', 10, 2],
        ['build', 'lance', 11, 2],
        ['build', 'throttle', 13, 3],
        ['up', 13, 3],
        ['up', 13, 3],
        ['build', 'beacon', 13, 2],
        ['build', 'lance', 11, 3],
        ['build', 'lance', 11, 4],
        ['build', 'beacon', 10, 3],
        ['build', 'lance', 10, 4],
        ['build', 'lance', 11, 6],
        ['build', 'lance', 9, 4],
        ['build', 'beacon', 12, 6],
        ['build', 'throttle', 10, 6],
        ['build', 'lance', 11, 7],
        ['up', 10, 6],
        ['up', 10, 6],
        ['build', 'beacon', 8, 7],
        ['build', 'wall', 12, 5],
      ],
      [
        ['build', 'lance', 9, 2],
        ['build', 'throttle', 5, 5],
        ['build', 'lance', 5, 3],
        ['up', 5, 3],
        ['up', 5, 5],
        ['up', 5, 5],
        ['build', 'lance', 3, 3],
        ['build', 'lance', 2, 3],
        ['build', 'beacon', 2, 2],
        ['build', 'throttle', 2, 5],
        ['up', 2, 5],
      ],
      [
        ['build', 'beacon', 6, 3],
        ['up', 2, 5],
        ['build', 'lance', 1, 3],
      ],
      [],
    ],
  },
  {
    level: 'siege-5',
    waves: [
      [
        ['build', 'throttle', 5, 5],
        ['up', 5, 5],
        ['up', 5, 5],
        ['build', 'throttle', 13, 7],
        ['up', 13, 7],
        ['up', 13, 7],
        ['build', 'throttle', 1, 3],
        ['up', 1, 3],
        ['build', 'lance', 4, 5],
        ['build', 'lance', 5, 3],
        ['build', 'lance', 2, 7],
        ['build', 'throttle', 10, 7],
        ['build', 'lance', 14, 3],
        ['up', 10, 7],
        ['up', 10, 7],
        ['build', 'throttle', 3, 4],
        ['build', 'throttle', 6, 7],
        ['build', 'throttle', 13, 4],
        ['up', 13, 4],
        ['build', 'throttle', 8, 7],
        ['up', 13, 4],
        ['build', 'beacon', 3, 5],
        ['build', 'throttle', 4, 7],
        ['build', 'throttle', 11, 7],
        ['up', 11, 7],
        ['up', 11, 7],
        ['build', 'beacon', 13, 6],
        ['up', 13, 6],
        ['up', 14, 3],
        ['up', 14, 3],
        ['build', 'lance', 9, 7],
        ['build', 'lance', 11, 6],
        ['build', 'lance', 4, 4],
      ],
      [
        ['build', 'lance', 5, 4],
        ['build', 'lance', 4, 6],
        ['build', 'lance', 3, 8],
        ['build', 'lance', 4, 2],
        ['up', 1, 3],
        ['build', 'wall', 13, 8],
      ],
      [
        ['build', 'lance', 12, 4],
        ['build', 'beacon', 13, 3],
        ['build', 'beacon', 4, 3],
        ['build', 'wall', 2, 2],
      ],
      [],
    ],
  },
];

export const SIEGE_CHAIN: Solution[] = [
  {
    level: 'siege-1',
    waves: [
      [
        ['build', 'lance', 5, 4],
        ['build', 'lance', 9, 4],
        ['build', 'arc', 11, 5],
      ],
      [['up', 5, 4]],
      [
        ['build', 'beacon', 8, 3],
        ['up', 8, 3],
      ],
      [['up', 9, 4]],
    ],
  },
  {
    level: 'siege-2',
    waves: [
      [
        ['build', 'lance', 10, 3],
        ['build', 'lance', 9, 5],
      ],
      [
        ['build', 'beacon', 12, 6],
        ['build', 'throttle', 11, 3],
      ],
      [
        ['build', 'throttle', 9, 7],
        ['build', 'lance', 9, 8],
        ['build', 'pulse', 11, 6],
      ],
      [['build', 'throttle', 5, 5]],
    ],
  },
  {
    level: 'siege-3',
    waves: [
      [
        ['build', 'lance', 4, 7],
        ['up', 5, 5],
        ['build', 'lance', 2, 3],
        ['up', 5, 5],
        ['up', 9, 7],
        ['build', 'pulse', 5, 2],
      ],
      [
        ['build', 'throttle', 1, 3],
        ['build', 'lance', 8, 5],
      ],
      [
        ['up', 9, 7],
        ['build', 'lance', 10, 5],
        ['build', 'beacon', 11, 8],
        ['build', 'wall', 13, 7],
        ['build', 'wall', 14, 5],
        ['build', 'wall', 13, 4],
        ['build', 'wall', 13, 3],
        ['build', 'wall', 13, 2],
      ],
      [],
    ],
  },
  {
    level: 'siege-4',
    waves: [
      [
        ['build', 'beacon', 3, 5],
        ['build', 'lance', 5, 8],
        ['build', 'lance', 4, 6],
        ['build', 'lance', 5, 3],
        ['build', 'beacon', 10, 4],
      ],
      [],
      [
        ['build', 'lance', 11, 4],
        ['build', 'lance', 8, 4],
        ['up', 9, 4],
        ['up', 5, 2],
      ],
      [],
    ],
  },
  {
    level: 'siege-5',
    waves: [[], [['up', 1, 3]], [['up', 1, 3]], []],
  },
];

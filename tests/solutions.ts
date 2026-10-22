import type { Solution } from '../src/engine/replay';

// A reference solution per level, found by the look-ahead solver (npm run solve). The level tests
// replay each one and expect a win, so every level is proven winnable at its shipped difficulty;
// `npm run sim -- <level>` prints a replay.
export const SOLUTIONS: Solution[] = [
  {
    level: 'handshake',
    waves: [
      [
        ['build', 'pulse', 6, 4],
        ['build', 'pulse', 3, 1],
        ['up', 6, 4],
      ],
      [['up', 6, 4]],
      [
        ['build', 'pulse', 4, 1],
        ['build', 'pulse', 3, 3],
      ],
      [
        ['build', 'pulse', 4, 3],
        ['build', 'pulse', 1, 1],
      ],
      [
        ['build', 'pulse', 1, 3],
        ['build', 'pulse', 10, 3],
        ['up', 4, 1],
        ['build', 'pulse', 5, 1],
      ],
    ],
  },
  {
    level: 'fan-out',
    waves: [
      [
        ['build', 'arc', 5, 2],
        ['build', 'pulse', 8, 2],
      ],
      [['build', 'arc', 7, 2]],
      [['up', 7, 2]],
      [
        ['up', 7, 2],
        ['up', 8, 2],
      ],
      [['build', 'arc', 6, 2]],
      [
        ['build', 'arc', 10, 2],
        ['build', 'arc', 3, 2],
      ],
    ],
  },
  {
    level: 'bulwark',
    waves: [
      [
        ['build', 'lance', 6, 5],
        ['up', 6, 5],
      ],
      [],
      [['up', 6, 5]],
      [['build', 'lance', 1, 3]],
      [
        ['build', 'lance', 6, 3],
        ['build', 'lance', 1, 1],
      ],
      [],
    ],
  },
  {
    level: 'open-floor',
    waves: [
      [
        ['build', 'lance', 4, 4],
        ['build', 'lance', 9, 5],
        ['build', 'pulse', 2, 5],
      ],
      [['up', 9, 5]],
      [['build', 'arc', 5, 6]],
      [['build', 'lance', 4, 6]],
      [['up', 9, 5]],
      [],
    ],
  },
  {
    level: 'ghost-protocol',
    waves: [
      [
        ['build', 'lance', 12, 4],
        ['build', 'beacon', 9, 3],
        ['build', 'pulse', 8, 4],
      ],
      [
        ['build', 'pulse', 9, 6],
        ['build', 'pulse', 8, 3],
      ],
      [['build', 'lance', 12, 2]],
      [
        ['build', 'lance', 11, 1],
        ['build', 'arc', 9, 4],
      ],
      [
        ['build', 'lance', 11, 6],
        ['build', 'beacon', 13, 6],
        ['build', 'pulse', 8, 1],
      ],
      [
        ['build', 'lance', 1, 1],
        ['build', 'lance', 4, 1],
        ['build', 'beacon', 5, 1],
      ],
    ],
  },
  {
    level: 'split-brain',
    waves: [
      [
        ['build', 'lance', 4, 3],
        ['build', 'lance', 2, 3],
      ],
      [['build', 'arc', 2, 4]],
      [
        ['build', 'lance', 10, 3],
        ['build', 'throttle', 7, 3],
      ],
      [
        ['build', 'lance', 3, 3],
        ['up', 7, 3],
      ],
      [
        ['build', 'lance', 3, 1],
        ['build', 'lance', 2, 1],
      ],
      [
        ['up', 7, 3],
        ['build', 'throttle', 4, 1],
        ['up', 4, 1],
        ['up', 4, 1],
      ],
    ],
  },
  {
    level: 'two-fronts',
    waves: [
      [
        ['build', 'lance', 4, 1],
        ['build', 'lance', 14, 5],
        ['build', 'throttle', 14, 8],
      ],
      [
        ['build', 'lance', 12, 4],
        ['build', 'beacon', 5, 1],
      ],
      [
        ['build', 'lance', 1, 7],
        ['build', 'wall', 9, 2],
        ['build', 'wall', 9, 3],
      ],
      [
        ['build', 'lance', 4, 2],
        ['build', 'beacon', 11, 7],
        ['build', 'wall', 3, 5],
      ],
      [
        ['build', 'lance', 14, 6],
        ['build', 'throttle', 5, 4],
      ],
      [
        ['build', 'throttle', 1, 2],
        ['up', 1, 2],
      ],
    ],
  },
  {
    level: 'field-medics',
    waves: [
      [
        ['build', 'lance', 5, 4],
        ['build', 'lance', 2, 3],
        ['up', 5, 4],
      ],
      [['build', 'lance', 8, 6]],
      [
        ['build', 'beacon', 4, 3],
        ['build', 'throttle', 3, 5],
        ['up', 3, 5],
      ],
      [
        ['build', 'lance', 3, 4],
        ['build', 'beacon', 3, 6],
        ['build', 'wall', 3, 7],
      ],
      [
        ['build', 'lance', 1, 7],
        ['build', 'lance', 4, 4],
        ['build', 'pulse', 1, 3],
      ],
      [['build', 'pulse', 2, 2]],
    ],
  },
  {
    level: 'tight-budget',
    waves: [
      [
        ['build', 'lance', 4, 2],
        ['build', 'mortar', 9, 3],
        ['build', 'beacon', 7, 5],
      ],
      [['build', 'lance', 10, 8]],
      [
        ['up', 10, 8],
        ['build', 'pulse', 1, 6],
      ],
      [['build', 'lance', 14, 1]],
      [
        ['up', 10, 8],
        ['up', 4, 2],
        ['up', 7, 5],
      ],
      [
        ['up', 4, 2],
        ['up', 14, 1],
      ],
    ],
  },
  {
    level: 'colossus',
    waves: [
      [
        ['build', 'lance', 5, 5],
        ['up', 5, 5],
        ['build', 'beacon', 8, 6],
        ['build', 'lance', 1, 7],
      ],
      [
        ['build', 'lance', 9, 7],
        ['build', 'pulse', 9, 6],
      ],
      [
        ['build', 'lance', 5, 3],
        ['build', 'lance', 2, 3],
        ['build', 'throttle', 2, 7],
      ],
      [
        ['build', 'beacon', 5, 8],
        ['build', 'wall', 7, 5],
        ['build', 'wall', 10, 3],
        ['up', 2, 7],
        ['build', 'lance', 2, 4],
      ],
      [
        ['build', 'lance', 3, 5],
        ['build', 'lance', 1, 6],
        ['up', 2, 7],
      ],
      [],
    ],
  },
];

import type { Solution } from '../src/engine/replay';

// A reference solution per level, found by the look-ahead solver (npm run solve). The level tests
// replay each one and expect a win, so every level is proven winnable at its shipped difficulty;
// `npm run sim -- <level>` prints a replay.
export const SOLUTIONS: Solution[] = [
  {
    level: 'handshake',
    waves: [
      [
        ['build', 'pulse', 5, 4],
        ['build', 'pulse', 7, 3],
        ['up', 7, 3],
      ],
      [['up', 7, 3]],
      [
        ['build', 'pulse', 1, 4],
        ['build', 'pulse', 2, 1],
      ],
      [
        ['build', 'pulse', 5, 1],
        ['build', 'pulse', 2, 3],
        ['up', 1, 4],
      ],
      [
        ['up', 1, 4],
        ['build', 'pulse', 1, 1],
      ],
    ],
  },
  {
    level: 'fan-out',
    waves: [
      [
        ['build', 'arc', 3, 2],
        ['build', 'pulse', 10, 2],
      ],
      [['build', 'arc', 8, 2]],
      [['up', 8, 2]],
      [
        ['build', 'arc', 4, 6],
        ['build', 'pulse', 1, 3],
      ],
      [['build', 'arc', 6, 6]],
      [
        ['build', 'arc', 4, 2],
        ['build', 'arc', 9, 2],
      ],
    ],
  },
  {
    level: 'bulwark',
    waves: [
      [
        ['build', 'lance', 9, 3],
        ['up', 9, 3],
      ],
      [
        ['build', 'pulse', 13, 4],
        ['up', 13, 4],
      ],
      [['up', 13, 4]],
      [['build', 'lance', 3, 3]],
      [
        ['build', 'lance', 4, 3],
        ['build', 'lance', 1, 1],
      ],
      [['build', 'lance', 2, 1]],
    ],
  },
  {
    level: 'open-floor',
    waves: [
      [
        ['build', 'lance', 4, 4],
        ['build', 'lance', 6, 5],
        ['build', 'wall', 3, 4],
      ],
      [['build', 'lance', 1, 5]],
      [['build', 'pulse', 3, 2]],
      [
        ['build', 'lance', 4, 7],
        ['up', 4, 4],
      ],
      [['build', 'lance', 3, 6]],
      [],
    ],
  },
  {
    level: 'ghost-protocol',
    waves: [
      [
        ['build', 'lance', 12, 4],
        ['build', 'beacon', 9, 3],
        ['build', 'pulse', 8, 3],
      ],
      [['up', 12, 4]],
      [
        ['build', 'beacon', 8, 6],
        ['build', 'pulse', 8, 4],
      ],
      [
        ['up', 12, 4],
        ['build', 'beacon', 12, 3],
      ],
      [
        ['build', 'lance', 5, 4],
        ['build', 'lance', 3, 3],
      ],
      [
        ['build', 'lance', 1, 1],
        ['build', 'lance', 12, 2],
        ['build', 'beacon', 6, 3],
      ],
    ],
  },
  {
    level: 'split-brain',
    waves: [
      [
        ['build', 'lance', 2, 3],
        ['build', 'lance', 6, 5],
      ],
      [['build', 'arc', 7, 3]],
      [
        ['build', 'lance', 8, 5],
        ['build', 'throttle', 6, 3],
      ],
      [
        ['build', 'lance', 3, 3],
        ['build', 'pulse', 8, 3],
      ],
      [
        ['build', 'lance', 2, 1],
        ['up', 6, 3],
        ['up', 6, 3],
      ],
      [['build', 'lance', 1, 1]],
    ],
  },
  {
    level: 'two-fronts',
    waves: [
      [
        ['build', 'lance', 4, 1],
        ['build', 'lance', 14, 5],
        ['build', 'pulse', 13, 4],
        ['up', 13, 4],
        ['build', 'wall', 6, 2],
      ],
      [
        ['build', 'lance', 3, 7],
        ['build', 'wall', 5, 1],
        ['build', 'wall', 13, 3],
      ],
      [
        ['build', 'beacon', 5, 2],
        ['build', 'throttle', 3, 3],
        ['build', 'wall', 5, 8],
      ],
      [
        ['build', 'beacon', 12, 2],
        ['build', 'beacon', 6, 6],
        ['build', 'mortar', 7, 7],
      ],
      [
        ['build', 'lance', 3, 6],
        ['build', 'throttle', 5, 6],
        ['up', 3, 3],
      ],
      [
        ['build', 'lance', 3, 1],
        ['build', 'wall', 4, 5],
        ['up', 3, 3],
        ['build', 'lance', 4, 2],
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
      [
        ['build', 'lance', 8, 5],
        ['build', 'wall', 7, 4],
      ],
      [
        ['build', 'beacon', 6, 6],
        ['build', 'mortar', 7, 2],
      ],
      [
        ['up', 5, 4],
        ['build', 'beacon', 1, 3],
      ],
      [
        ['build', 'lance', 2, 5],
        ['build', 'throttle', 3, 5],
        ['up', 3, 5],
      ],
      [
        ['build', 'lance', 4, 3],
        ['build', 'beacon', 4, 4],
        ['up', 3, 5],
        ['build', 'wall', 2, 6],
        ['build', 'wall', 2, 7],
      ],
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
      [['build', 'lance', 5, 8]],
      [['build', 'lance', 1, 6]],
      [['build', 'lance', 10, 8]],
      [
        ['up', 1, 6],
        ['up', 1, 6],
        ['build', 'throttle', 14, 1],
      ],
      [
        ['up', 9, 3],
        ['up', 9, 3],
      ],
    ],
  },
  {
    level: 'colossus',
    waves: [
      [
        ['build', 'lance', 5, 5],
        ['build', 'lance', 10, 6],
        ['build', 'beacon', 6, 6],
        ['build', 'throttle', 5, 4],
        ['build', 'wall', 10, 3],
      ],
      [
        ['build', 'mortar', 8, 6],
        ['build', 'pulse', 10, 5],
      ],
      [
        ['build', 'lance', 6, 1],
        ['build', 'lance', 2, 2],
        ['build', 'beacon', 6, 2],
      ],
      [
        ['build', 'lance', 2, 8],
        ['build', 'throttle', 2, 5],
        ['build', 'beacon', 1, 5],
        ['up', 2, 5],
      ],
      [
        ['build', 'lance', 1, 2],
        ['build', 'lance', 2, 7],
        ['build', 'lance', 3, 8],
        ['build', 'lance', 5, 8],
      ],
      [
        ['up', 2, 5],
        ['build', 'lance', 5, 7],
      ],
    ],
  },
];

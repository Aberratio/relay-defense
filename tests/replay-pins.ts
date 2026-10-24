// Pinned results of every replay the determinism check plays, captured with the engine of 83de242
// (before the distance change, still on Math.hypot): outcome, ticks, and lives and credits after
// every wave. tests/determinism.test.ts expects the engine to reproduce them exactly. Regenerate
// them from fingerprints() in scripts/determinism-entry.ts only for a deliberate balance change.

export const REPLAY_PINS: {
  name: string;
  outcome: string;
  ticks: number;
  waves: [number, number][];
}[] = [
  {
    name: 'level handshake',
    outcome: 'won',
    ticks: 2042,
    waves: [
      [20, 52],
      [20, 80],
      [20, 104],
      [20, 119],
      [20, 135],
    ],
  },
  {
    name: 'level fan-out',
    outcome: 'won',
    ticks: 3378,
    waves: [
      [20, 70],
      [20, 54],
      [20, 103],
      [20, 78],
      [20, 157],
      [20, 97],
    ],
  },
  {
    name: 'level bulwark',
    outcome: 'won',
    ticks: 5092,
    waves: [
      [20, 65],
      [20, 70],
      [20, 158],
      [20, 208],
      [20, 183],
      [20, 253],
    ],
  },
  {
    name: 'level open-floor',
    outcome: 'won',
    ticks: 2802,
    waves: [
      [20, 103],
      [20, 73],
      [20, 167],
      [20, 97],
      [20, 232],
      [20, 392],
    ],
  },
  {
    name: 'level ghost-protocol',
    outcome: 'won',
    ticks: 4065,
    waves: [
      [20, 73],
      [19, 83],
      [19, 166],
      [19, 190],
      [19, 231],
      [19, 246],
    ],
  },
  {
    name: 'level split-brain',
    outcome: 'won',
    ticks: 4856,
    waves: [
      [19, 79],
      [16, 142],
      [16, 129],
      [16, 199],
      [16, 220],
      [16, 410],
    ],
  },
  {
    name: 'level two-fronts',
    outcome: 'won',
    ticks: 3488,
    waves: [
      [20, 115],
      [20, 111],
      [20, 186],
      [20, 184],
      [20, 260],
      [20, 320],
    ],
  },
  {
    name: 'level field-medics',
    outcome: 'won',
    ticks: 2430,
    waves: [
      [20, 104],
      [20, 127],
      [20, 152],
      [20, 229],
      [20, 295],
      [20, 394],
    ],
  },
  {
    name: 'level tight-budget',
    outcome: 'won',
    ticks: 5906,
    waves: [
      [10, 101],
      [7, 105],
      [7, 125],
      [6, 223],
      [6, 179],
      [6, 316],
    ],
  },
  {
    name: 'level colossus',
    outcome: 'won',
    ticks: 3901,
    waves: [
      [20, 144],
      [19, 249],
      [19, 228],
      [19, 376],
      [19, 283],
      [19, 613],
    ],
  },
  {
    name: 'floor siege-1',
    outcome: 'won',
    ticks: 2445,
    waves: [
      [20, 78],
      [19, 96],
      [17, 136],
      [17, 180],
    ],
  },
  {
    name: 'floor siege-2',
    outcome: 'won',
    ticks: 2178,
    waves: [
      [20, 121],
      [20, 171],
      [20, 222],
      [20, 436],
    ],
  },
  {
    name: 'floor siege-3',
    outcome: 'won',
    ticks: 2564,
    waves: [
      [20, 734],
      [20, 418],
      [20, 357],
      [20, 637],
    ],
  },
  {
    name: 'floor siege-4',
    outcome: 'won',
    ticks: 2260,
    waves: [
      [20, 752],
      [20, 281],
      [20, 252],
      [20, 620],
    ],
  },
  {
    name: 'floor siege-5',
    outcome: 'won',
    ticks: 5191,
    waves: [
      [20, 1027],
      [20, 770],
      [20, 911],
      [10, 1293],
    ],
  },
  {
    name: 'empty handshake',
    outcome: 'lost',
    ticks: 2109,
    waves: [
      [12, 120],
      [0, 120],
    ],
  },
  {
    name: 'empty fan-out',
    outcome: 'lost',
    ticks: 2123,
    waves: [
      [10, 130],
      [0, 130],
    ],
  },
  {
    name: 'empty bulwark',
    outcome: 'lost',
    ticks: 2944,
    waves: [
      [10, 185],
      [2, 215],
      [0, 215],
    ],
  },
  {
    name: 'empty open-floor',
    outcome: 'lost',
    ticks: 802,
    waves: [
      [8, 245],
      [0, 245],
    ],
  },
  {
    name: 'empty ghost-protocol',
    outcome: 'lost',
    ticks: 1726,
    waves: [
      [8, 195],
      [0, 195],
    ],
  },
  {
    name: 'empty split-brain',
    outcome: 'lost',
    ticks: 1896,
    waves: [
      [10, 215],
      [0, 215],
    ],
  },
  { name: 'empty two-fronts', outcome: 'lost', ticks: 596, waves: [[0, 260]] },
  {
    name: 'empty field-medics',
    outcome: 'lost',
    ticks: 1064,
    waves: [
      [4, 280],
      [0, 280],
    ],
  },
  { name: 'empty tight-budget', outcome: 'lost', ticks: 1022, waves: [[0, 240]] },
  { name: 'empty colossus', outcome: 'lost', ticks: 373, waves: [[0, 300]] },
  {
    name: 'empty siege-1',
    outcome: 'lost',
    ticks: 802,
    waves: [
      [8, 275],
      [0, 275],
    ],
  },
  { name: 'empty siege-2', outcome: 'lost', ticks: 447, waves: [[0, 560]] },
  { name: 'empty siege-3', outcome: 'lost', ticks: 627, waves: [[0, 1140]] },
  { name: 'empty siege-4', outcome: 'lost', ticks: 416, waves: [[0, 1880]] },
  { name: 'empty siege-5', outcome: 'lost', ticks: 839, waves: [[0, 2730]] },
  {
    name: 'chain siege-1',
    outcome: 'won',
    ticks: 2445,
    waves: [
      [20, 78],
      [19, 96],
      [17, 136],
      [17, 180],
    ],
  },
  {
    name: 'chain siege-2',
    outcome: 'won',
    ticks: 2119,
    waves: [
      [20, 121],
      [20, 176],
      [20, 192],
      [20, 356],
    ],
  },
  {
    name: 'chain siege-3',
    outcome: 'won',
    ticks: 2187,
    waves: [
      [20, 185],
      [20, 279],
      [20, 208],
      [20, 488],
    ],
  },
  {
    name: 'chain siege-4',
    outcome: 'won',
    ticks: 1687,
    waves: [
      [20, 350],
      [20, 594],
      [20, 450],
      [20, 818],
    ],
  },
  {
    name: 'chain siege-5',
    outcome: 'won',
    ticks: 3935,
    waves: [
      [20, 1085],
      [20, 1218],
      [20, 1489],
      [20, 1951],
    ],
  },
];

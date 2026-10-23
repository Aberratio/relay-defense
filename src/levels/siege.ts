import type {
  Carry,
  Cell,
  EnemyKind,
  LevelDef,
  SpawnGroup,
  TowerKind,
  Wave,
} from '../engine/types';

// Siege: one map played over five chapters. The defenders and the gold carry over from chapter to
// chapter, and each chapter adds a hardship. Every later change is on the board from the start (a
// dormant portal, a cracked lane), so the player can plan for it and the placement rule can keep
// it fair. Each chapter is built as an ordinary level, so the solver, the replays and the probe
// work on it unchanged.

function g(
  enemy: EnemyKind,
  count: number,
  gap: number,
  opts: Omit<SpawnGroup, 'enemy' | 'count' | 'gap'> = {},
): SpawnGroup {
  return { enemy, count, gap, ...opts };
}

export interface ChapterDef {
  /** Key of the chapter's copy in the UI dictionary. */
  key: 'awakening' | 'second-portal' | 'landslide' | 'fog' | 'warlord';
  /**
   * The floor: what the gold and the defenders brought into the chapter are worth at least. The
   * first chapter starts with exactly this much gold.
   */
  credits: number;
  lives: number;
  hpScale: number;
  waveBonus: { base: number; perWave: number };
  waves: Wave[];
  /** Spawns (by index) that wake up in this chapter. */
  opens?: number[];
  /**
   * Lane cells that turn to rock when this chapter begins. They must be lanes (`=`): nothing
   * can stand on a lane, so no carried defender is ever buried.
   */
  collapse?: Cell[];
  /** Cells that fall under fog when this chapter begins. */
  fog?: Cell[];
  /** Armour every monster gains from this chapter on. */
  armour?: number;
}

export interface CampaignDef {
  /**
   * Bumped whenever a change would make a saved checkpoint unfair or invalid (the map, the
   * chapters, the balance): an older checkpoint is then dropped.
   */
  version: number;
  /** The map of the first chapter, with every portal and every lane that will collapse. */
  map: string[];
  towers: TowerKind[];
  chapters: ChapterDef[];
}

/** The spawn on the bottom edge sleeps through the first chapter. */
const SOUTH = 1;
/** The lane through the ridge: the shortest way to the Heart Tree until it collapses. */
const PASS: Cell = { x: 7, y: 4 };

function block(x0: number, y0: number, x1: number, y1: number): Cell[] {
  const out: Cell[] = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.push({ x, y });
  return out;
}

export const SIEGE: CampaignDef = {
  version: 1,
  // A ridge splits the meadow. The pass through it collapses in the third chapter; the gap at the
  // bottom stays open. The second portal on the bottom edge wakes in the second chapter.
  map: [
    '################',
    '#......#.......#',
    '#......#.......#',
    '#......#.......#',
    'S......=.......C',
    '#......#.......#',
    '#......#.......#',
    '#......#.......#',
    '#..............#',
    '##########S#####',
  ],
  towers: ['pulse', 'arc', 'lance', 'mortar', 'throttle', 'beacon', 'wall'],
  chapters: [
    {
      key: 'awakening',
      credits: 250,
      lives: 20,
      hpScale: 3.5,
      waveBonus: { base: 25, perWave: 5 },
      waves: [
        { groups: [g('spark', 12, 0.8)] },
        { groups: [g('mite', 30, 0.2), g('spark', 8, 0.8, { delay: 4 })] },
        { groups: [g('bulwark', 6, 1.5), g('spark', 10, 0.6, { delay: 2 })] },
        { groups: [g('phantom', 12, 0.6), g('mite', 30, 0.15, { delay: 5 })] },
      ],
    },
    {
      key: 'second-portal',
      credits: 560,
      lives: 20,
      hpScale: 3,
      waveBonus: { base: 25, perWave: 5 },
      opens: [SOUTH],
      waves: [
        { groups: [g('spark', 12, 0.7), g('spark', 12, 0.7, { spawn: SOUTH })] },
        { groups: [g('bulwark', 8, 1.2), g('mite', 40, 0.15, { spawn: SOUTH })] },
        { groups: [g('phantom', 12, 0.6), g('splitter', 8, 1.2, { spawn: SOUTH })] },
        {
          groups: [
            g('bulwark', 8, 1, { hp: 1.2 }),
            g('mender', 4, 2, { delay: 0.5 }),
            g('phantom', 14, 0.5, { spawn: SOUTH, hp: 1.2 }),
          ],
        },
      ],
    },
    {
      key: 'landslide',
      credits: 1140,
      lives: 20,
      hpScale: 4.4,
      waveBonus: { base: 30, perWave: 6 },
      collapse: [PASS],
      waves: [
        { groups: [g('splitter', 10, 0.9), g('spark', 16, 0.5, { spawn: SOUTH })] },
        { groups: [g('bulwark', 10, 1), g('phantom', 14, 0.5, { spawn: SOUTH })] },
        { groups: [g('mite', 60, 0.1), g('splitter', 8, 1, { spawn: SOUTH })] },
        {
          groups: [
            g('mender', 6, 1.4),
            g('bulwark', 10, 0.9, { delay: 0.4, hp: 1.2 }),
            g('phantom', 18, 0.4, { spawn: SOUTH, hp: 1.2 }),
          ],
        },
      ],
    },
    {
      key: 'fog',
      credits: 1880,
      lives: 20,
      hpScale: 5.6,
      waveBonus: { base: 30, perWave: 6 },
      fog: block(8, 5, 14, 8),
      waves: [
        { groups: [g('phantom', 16, 0.5), g('spark', 20, 0.4, { spawn: SOUTH })] },
        { groups: [g('splitter', 12, 0.8), g('bulwark', 10, 1, { spawn: SOUTH })] },
        { groups: [g('mite', 70, 0.1), g('mender', 6, 1.5, { spawn: SOUTH })] },
        {
          groups: [
            g('bulwark', 12, 0.8, { hp: 1.2 }),
            g('splitter', 12, 0.7, { spawn: SOUTH, hp: 1.2 }),
            g('phantom', 20, 0.4, { delay: 6, hp: 1.2 }),
          ],
        },
      ],
    },
    {
      key: 'warlord',
      credits: 2730,
      lives: 20,
      hpScale: 5,
      waveBonus: { base: 35, perWave: 8 },
      armour: 2,
      waves: [
        { groups: [g('bulwark', 12, 0.9), g('phantom', 16, 0.5, { spawn: SOUTH })] },
        { groups: [g('colossus', 1, 1), g('mite', 50, 0.12, { spawn: SOUTH, delay: 3 })] },
        {
          groups: [
            g('mender', 8, 1.2),
            g('splitter', 12, 0.8, { delay: 0.4 }),
            g('bulwark', 10, 1, { spawn: SOUTH }),
          ],
        },
        {
          groups: [
            g('colossus', 2, 6, { hp: 1.2 }),
            g('mender', 6, 1.5, { delay: 1 }),
            g('phantom', 20, 0.4, { spawn: SOUTH }),
            g('splitter', 12, 0.7, { spawn: SOUTH, delay: 8 }),
          ],
        },
      ],
    },
  ],
};

export function chapterId(index: number): string {
  return `siege-${index + 1}`;
}

/**
 * Chapter `index` as an ordinary level: the map with every collapse so far turned to rock, the
 * portals that have not woken yet marked dormant, the lanes that will still collapse marked
 * cracked, the fog and armour of every chapter so far, and the fog still to come.
 */
export function chapterLevel(index: number, campaign: CampaignDef = SIEGE): LevelDef {
  const chapter = campaign.chapters[index];
  if (!chapter) throw new Error(`no Siege chapter ${index + 1}`);
  const past = campaign.chapters.slice(0, index + 1);
  const future = campaign.chapters.slice(index + 1);
  const rows = campaign.map.map((row) => [...row]);
  for (const c of past.flatMap((ch) => ch.collapse ?? [])) {
    const row = rows[c.y];
    if (row) row[c.x] = '#';
  }
  const dormant = future.flatMap((ch) => ch.opens ?? []);
  const cracked = future.flatMap((ch) => ch.collapse ?? []);
  const fog = past.flatMap((ch) => ch.fog ?? []);
  const fogLater = future.flatMap((ch) => ch.fog ?? []);
  const armour = past.reduce((sum, ch) => sum + (ch.armour ?? 0), 0);
  return {
    id: chapterId(index),
    map: rows.map((r) => r.join('')),
    credits: chapter.credits,
    lives: chapter.lives,
    hpScale: chapter.hpScale,
    towers: campaign.towers,
    waves: chapter.waves,
    waveBonus: chapter.waveBonus,
    hazards: {
      ...(dormant.length ? { dormant } : {}),
      ...(cracked.length ? { cracked } : {}),
      ...(fog.length ? { fog } : {}),
      ...(fogLater.length ? { fogLater } : {}),
      ...(armour ? { armour } : {}),
    },
  };
}

export const SIEGE_CHAPTERS: LevelDef[] = SIEGE.chapters.map((_, i) => chapterLevel(i));

export function chapterById(id: string): LevelDef | undefined {
  return SIEGE_CHAPTERS.find((l) => l.id === id);
}

/** A carry with nothing in it: the first chapter, or a fresh start. */
export const EMPTY_CARRY: Carry = { credits: 0, towers: [] };

import { describe, expect, it } from 'vitest';
import { Game } from '../src/engine/game';
import { parseMap, tileAt } from '../src/engine/grid';
import { carelessWinRate } from '../src/engine/probe';
import { replay, replayChain } from '../src/engine/replay';
import { FOG_RANGE, TOWERS, invested } from '../src/engine/stats';
import type { Carry, LevelDef } from '../src/engine/types';
import { EMPTY_CARRY, SIEGE, SIEGE_CHAPTERS, chapterLevel } from '../src/levels/siege';
import { loadSiege, saveSiege } from '../src/ui/progress';
import { SIEGE_CHAIN, SIEGE_FLOOR } from './siege-solutions';

// A small open map: a portal on the left, a dormant one at the bottom, the core on the right and a
// cracked lane through a ridge.
//   0123456
// 0 #######
// 1 #..#..#
// 2 S..=..C
// 3 #.....#
// 4 ####S##
const MAP = ['#######', '#..#..#', 'S..=..C', '#.....#', '####S##'];

function chapter(over: Partial<LevelDef> = {}): LevelDef {
  return {
    id: 'test',
    map: MAP,
    credits: 300,
    lives: 10,
    towers: ['pulse', 'arc', 'lance', 'mortar', 'throttle', 'beacon', 'wall'],
    waveBonus: { base: 10, perWave: 5 },
    waves: [{ groups: [{ enemy: 'spark', count: 1, gap: 1 }] }],
    hazards: { dormant: [1], cracked: [{ x: 3, y: 2 }] },
    ...over,
  };
}

function memory(): Storage {
  const data = new Map<string, string>();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
    clear: () => data.clear(),
    key: () => null,
    get length() {
      return data.size;
    },
  };
}

describe('siege rules', () => {
  it('keeps a way open for a dormant portal', () => {
    const game = new Game(chapter());
    // (4, 3) is the only cell above the dormant portal: walling it would seal it in.
    expect(game.canPlace('wall', 4, 3)).toBe('blocks');
  });

  it('keeps a way round a cracked lane before it collapses', () => {
    const game = new Game(chapter({ hazards: { cracked: [{ x: 3, y: 2 }] } }));
    // With the lane gone, the only way east is along row 3: closing it is refused even though
    // the cracked lane is still open today.
    expect(game.canPlace('wall', 3, 3)).toBe('blocks');
    const without = new Game(chapter({ hazards: {} }));
    expect(without.canPlace('wall', 3, 3)).toBeNull();
  });

  it('refuses a chapter whose spawns are cut off once the lanes collapse', () => {
    const sealed = ['#######', '#..#..#', 'S..=..C', '#..#..#', '#######'];
    expect(
      () => new Game(chapter({ map: sealed, hazards: { cracked: [{ x: 3, y: 2 }] } })),
    ).toThrow();
  });

  it('cuts the range of a tower in fog', () => {
    const game = new Game(chapter({ hazards: { fog: [{ x: 1, y: 1 }] } }));
    const inFog = game.place('pulse', 1, 1);
    const clear = game.place('pulse', 2, 1);
    if (!inFog || !clear) throw new Error('not placed');
    const range = TOWERS.pulse.levels[0].range;
    expect(game.stat(inFog).range).toBeCloseTo(range * FOG_RANGE);
    expect(game.stat(clear).range).toBe(range);
  });

  it('adds armour to every monster', () => {
    const game = new Game(chapter({ hazards: { armour: 2 } }));
    expect(game.armourOf('bulwark')).toBe(8);
    expect(game.armourOf('spark')).toBe(2);
  });
});

describe('carrying a chapter over', () => {
  it('rebuilds the defenders and sells them back at full value before the first wave', () => {
    const carry: Carry = {
      credits: 500,
      towers: [{ kind: 'lance', x: 2, y: 1, level: 1, mode: 'strong' }],
    };
    const game = Game.resume(chapter(), carry);
    const lance = game.towerAt(2, 1);
    expect(lance?.level).toBe(1);
    expect(lance?.mode).toBe('strong');
    expect(game.credits).toBe(500);
    if (!lance) throw new Error('not carried');
    expect(game.sellValue(lance)).toBe(invested('lance', 1));
    run(game);
    expect(game.sellValue(lance)).toBeLessThan(invested('lance', 1));
  });

  it('tops the gold up to the floor', () => {
    const poor = Game.resume(chapter({ credits: 300 }), {
      credits: 20,
      towers: [{ kind: 'pulse', x: 1, y: 1, level: 0, mode: 'first' }],
    });
    expect(poor.credits).toBe(300 - TOWERS.pulse.levels[0].cost);
    expect(Game.resume(chapter({ credits: 300 }), EMPTY_CARRY).credits).toBe(300);
    expect(Game.resume(chapter({ credits: 300 }), { credits: 900, towers: [] }).credits).toBe(900);
  });

  it('rejects defenders that do not fit the board', () => {
    const on = (x: number, y: number): Carry => ({
      credits: 0,
      towers: [{ kind: 'pulse', x, y, level: 0, mode: 'first' }],
    });
    expect(() => Game.resume(chapter(), on(0, 0))).toThrow();
    expect(() => Game.resume(chapter(), on(3, 2))).toThrow();
    expect(() =>
      Game.resume(chapter(), {
        credits: 0,
        towers: [{ kind: 'pulse', x: 1, y: 1, level: 5, mode: 'first' }],
      }),
    ).toThrow();
  });

  it('hands over the gold and the defenders', () => {
    const game = new Game(chapter());
    game.place('arc', 1, 3);
    expect(game.carry()).toEqual({
      credits: 300 - TOWERS.arc.levels[0].cost,
      towers: [{ kind: 'arc', x: 1, y: 3, level: 0, mode: 'first' }],
    });
  });
});

describe('the campaign', () => {
  it('has 16 x 10 maps, a lane under every collapse and awake portals for every wave', () => {
    const base = parseMap(SIEGE.map);
    for (const c of SIEGE.chapters.flatMap((ch) => ch.collapse ?? []))
      expect(tileAt(base, c.x, c.y)).toBe('=');
    SIEGE_CHAPTERS.forEach((level) => {
      expect(level.map).toHaveLength(10);
      for (const row of level.map) expect(row).toHaveLength(16);
      const dormant = level.hazards?.dormant ?? [];
      for (const w of level.waves)
        for (const g of w.groups) expect(dormant, level.id).not.toContain(g.spawn ?? 0);
    });
  });

  it('opens every chapter with every spawn connected', () => {
    for (const level of SIEGE_CHAPTERS) {
      const game = new Game(level);
      for (const r of game.routes()) expect(r.length, level.id).toBeGreaterThan(1);
    }
  });

  it('applies the hardships of the chapters so far', () => {
    expect(chapterLevel(0).hazards?.dormant).toEqual([1]);
    expect(chapterLevel(1).hazards?.dormant).toBeUndefined();
    expect(chapterLevel(1).hazards?.cracked).toHaveLength(1);
    expect(chapterLevel(2).hazards?.cracked).toBeUndefined();
    expect(chapterLevel(3).hazards?.fog?.length).toBeGreaterThan(0);
    expect(chapterLevel(4).hazards?.fog?.length).toBeGreaterThan(0);
    expect(chapterLevel(4).hazards?.armour).toBe(2);
  });

  // The floor proof: from an empty board and the floor gold, each chapter is won. Whatever the
  // player brings is worth at least the floor and sells back at full value before the first
  // wave, so every checkpoint can be won this way.
  it.each(SIEGE_CHAPTERS.map((l) => [l.id, l] as const))(
    '%s is won from its floor',
    (id, level) => {
      const solution = SIEGE_FLOOR.find((s) => s.level === id);
      expect(solution, `no floor solution for ${id}`).toBeDefined();
      const result = replay(level, solution!);
      expect(result.rejected).toEqual([]);
      expect(result.outcome).toBe('won');
    },
  );

  it('is won chapter after chapter, carrying the defence over', () => {
    const results = replayChain(SIEGE_CHAPTERS, SIEGE_CHAIN);
    expect(results).toHaveLength(SIEGE_CHAPTERS.length);
    for (const r of results) {
      expect(r.rejected).toEqual([]);
      expect(r.outcome).toBe('won');
    }
  });

  it.each(SIEGE_CHAPTERS.map((l) => [l.id, l] as const))(
    '%s is hard to win by chance from its floor',
    (_id, level) => {
      expect(carelessWinRate(level, 30)).toBeLessThanOrEqual(0.15);
    },
  );

  it('is lost when nothing is built', () => {
    for (const level of SIEGE_CHAPTERS)
      expect(replay(level, { level: level.id, waves: [] }).outcome, level.id).toBe('lost');
  });
});

describe('siege progress', () => {
  it('keeps the stars and the checkpoint across a reload', () => {
    const storage = memory();
    const carry: Carry = {
      credits: 120,
      towers: [{ kind: 'beacon', x: 3, y: 3, level: 2, mode: 'first' }],
    };
    saveSiege({ stars: [3, 2], checkpoint: { version: 1, chapter: 2, carry } }, storage);
    expect(loadSiege(1, 5, storage)).toEqual({
      stars: [3, 2],
      checkpoint: { version: 1, chapter: 2, carry },
    });
  });

  it('drops a checkpoint from another version of the campaign or with broken data', () => {
    const storage = memory();
    saveSiege({ stars: [3], checkpoint: { version: 1, chapter: 1, carry: EMPTY_CARRY } }, storage);
    expect(loadSiege(2, 5, storage)).toEqual({ stars: [3], checkpoint: null });
    storage.setItem(
      'relay-defense:siege:v1',
      JSON.stringify({ stars: [9], checkpoint: { version: 1, chapter: 1, carry: { towers: 3 } } }),
    );
    expect(loadSiege(1, 5, storage)).toEqual({ stars: [0], checkpoint: null });
    expect(loadSiege(1, 5, { getItem: () => '{oops' })).toEqual({ stars: [], checkpoint: null });
  });
});

/** Runs the current wave to its end. */
function run(game: Game, maxTicks = 30 * 120): void {
  game.startWave();
  for (let i = 0; i < maxTicks && game.phase === 'wave'; i++) game.step();
}

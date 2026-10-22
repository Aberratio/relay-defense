import { describe, expect, it } from 'vitest';
import { Game, type Enemy } from '../src/engine/game';
import { flowField, parseMap, route } from '../src/engine/grid';
import { afterArmour, ENEMIES, TOWERS } from '../src/engine/stats';
import type { EnemyKind, LevelDef, TowerKind } from '../src/engine/types';

const CORRIDOR = ['#######', 'S=====C', '#^^^^^#', '#######'];
const OPEN = ['#######', '#.....#', 'S.....C', '#.....#', '#######'];

function level(map: string[], over: Partial<LevelDef> = {}): LevelDef {
  return {
    id: 'test',
    map,
    credits: 1000,
    lives: 10,
    towers: ['pulse', 'arc', 'lance', 'mortar', 'throttle', 'beacon', 'wall'],
    waveBonus: { base: 10, perWave: 5 },
    waves: [{ groups: [{ enemy: 'spark', count: 1, gap: 1 }] }],
    ...over,
  };
}

function oneWave(kind: EnemyKind, count = 1, gap = 1): LevelDef['waves'] {
  return [{ groups: [{ enemy: kind, count, gap }] }];
}

/** Runs the current wave to its end. */
function run(game: Game, maxTicks = 30 * 120): void {
  game.startWave();
  for (let i = 0; i < maxTicks && game.phase === 'wave'; i++) game.step();
}

/** Spawns the first enemy of the wave and returns it. */
function spawnOne(game: Game): Enemy {
  game.startWave();
  game.step();
  const e = game.enemies[0];
  if (!e) throw new Error('nothing spawned');
  return e;
}

describe('map and routing', () => {
  it('parses spawns and the core, and rejects malformed maps', () => {
    const grid = parseMap(OPEN);
    expect(grid.spawns).toEqual([{ x: 0, y: 2 }]);
    expect(grid.core).toEqual({ x: 6, y: 2 });
    expect(() => parseMap(['S..', '..'])).toThrow();
    expect(() => parseMap(['S.x'])).toThrow();
    expect(() => parseMap(['S..'])).toThrow(/core/);
  });

  it('measures walking distance to the core and keeps routes straight', () => {
    const grid = parseMap(OPEN);
    const dist = flowField(grid, []);
    expect(dist[grid.width * 2]).toBe(6);
    const r = route(grid, dist, grid.spawns[0]!)!;
    expect(r).toHaveLength(7);
    expect(new Set(r.map((c) => c.y))).toEqual(new Set([2]));
  });

  it('reroutes around a tower on open floor', () => {
    const game = new Game(level(OPEN));
    expect(game.routes()[0]).toHaveLength(7);
    game.place('wall', 3, 2);
    expect(game.routes()[0]).toHaveLength(9);
  });

  it('previews the route a placement would make', () => {
    const game = new Game(level(OPEN));
    expect(game.routesWith(3, 2)?.[0]).toHaveLength(9);
    expect(game.routesWith(0, 0)).toBeNull();
  });
});

describe('placement rules', () => {
  it('refuses cells that cannot hold a tower', () => {
    const game = new Game(level(CORRIDOR));
    expect(game.canPlace('pulse', 2, 1)).toBe('tile'); // lane
    expect(game.canPlace('pulse', 0, 0)).toBe('tile'); // rock
    expect(game.canPlace('pulse', 2, 2)).toBeNull(); // pad
    expect(game.canPlace('wall', 2, 2)).toBe('tile'); // walls only on floor
  });

  it('refuses a tower that would seal the core off', () => {
    const game = new Game(level(OPEN));
    game.place('wall', 3, 1);
    game.place('wall', 3, 2);
    expect(game.canPlace('wall', 3, 3)).toBe('blocks');
  });

  it('refuses locked kinds, taken cells and a short purse', () => {
    const game = new Game(level(CORRIDOR, { towers: ['pulse'], credits: 40 }));
    expect(game.canPlace('arc', 2, 2)).toBe('locked');
    game.place('pulse', 2, 2);
    expect(game.canPlace('pulse', 2, 2)).toBe('occupied');
    expect(game.canPlace('pulse', 3, 2)).toBe('funds');
  });

  it('freezes the maze on walkable floor during a wave, but not the sockets', () => {
    const game = new Game(
      level(['########', '#^^^^^^#', 'S......C', '#......#', '########'], {
        waves: oneWave('bulwark'),
      }),
    );
    const wall = game.place('wall', 5, 2)!;
    spawnOne(game);
    expect(game.canPlace('wall', 3, 2)).toBe('wave');
    expect(game.canPlace('pulse', 3, 1)).toBeNull();
    expect(game.canSell(wall)).toBe('wave');
    expect(game.sell(wall.id)).toBe(false);
    const pad = game.place('pulse', 3, 1)!;
    expect(game.sell(pad.id)).toBe(true);
  });

  it('fires at the stated rate over time', () => {
    const game = new Game(
      level(['##########', 'S========C', '#^^^^^^^^#', '##########'], {
        waves: oneWave('bulwark', 1, 1),
      }),
    );
    const t = game.place('pulse', 4, 2)!;
    game.startWave();
    const fired: number[] = [];
    for (let i = 0; i < 30 * 8; i++) {
      game.step();
      if (game.drainEvents().some((e) => e.type === 'bolt' && e.towerId === t.id)) fired.push(i);
    }
    // While the target stays in range, ten shots span 9 intervals of 1/2.5 s = 3.6 s (108 ticks).
    expect(fired.length).toBeGreaterThanOrEqual(10);
    expect(fired[9]! - fired[0]!).toBeLessThanOrEqual(109);
  });
});

describe('economy', () => {
  it('refunds in full during the same build phase and partly afterwards', () => {
    const game = new Game(level(CORRIDOR, { waves: [...oneWave('spark'), ...oneWave('spark')] }));
    const t = game.place('pulse', 3, 2)!;
    game.upgrade(t.id);
    const spent = TOWERS.pulse.levels[0].cost + TOWERS.pulse.levels[1]!.cost;
    expect(game.sellValue(t)).toBe(spent);
    run(game);
    expect(game.sellValue(t)).toBe(Math.floor(spent * 0.7));
    const before = game.credits;
    game.sell(t.id);
    expect(game.credits).toBe(before + Math.floor(spent * 0.7));
  });

  it('pays the bounty and the wave bonus', () => {
    const game = new Game(level(CORRIDOR, { waves: [...oneWave('spark'), ...oneWave('spark')] }));
    game.place('lance', 1, 2);
    const after = game.credits;
    run(game);
    expect(game.phase).toBe('build');
    expect(game.credits).toBe(after + ENEMIES.spark.bounty + 10);
  });
});

describe('combat', () => {
  it('armour cuts small hits down to a floor and the Lance ignores it', () => {
    expect(afterArmour(7, 6, false)).toBeCloseTo(1.75);
    expect(afterArmour(20, 6, false)).toBe(14);
    expect(afterArmour(55, 6, true)).toBe(55);
  });

  it('a Lance beam hits every enemy on its line', () => {
    // A pad just behind the core, in line with the lane.
    const map = ['###########', 'S========C^', '###########'];
    const g2 = new Game(level(map, { waves: oneWave('spark', 3, 0.3) }));
    g2.place('lance', 10, 1);
    g2.startWave();
    let beamHits = 0;
    for (let i = 0; i < 30 * 20 && g2.phase === 'wave'; i++) {
      g2.step();
      for (const e of g2.drainEvents())
        if (e.type === 'beam') beamHits = Math.max(beamHits, e.hits.length);
    }
    expect(beamHits).toBeGreaterThanOrEqual(2);
  });

  it('cloaked enemies cannot be hit until a Beacon reveals them', () => {
    const blind = new Game(level(CORRIDOR, { waves: oneWave('phantom') }));
    blind.place('pulse', 3, 2);
    run(blind);
    expect(blind.stats.kills).toBe(0);
    expect(blind.stats.leaks).toBe(1);

    const seen = new Game(level(CORRIDOR, { waves: oneWave('phantom') }));
    seen.place('pulse', 3, 2);
    seen.place('pulse', 4, 2);
    seen.place('beacon', 2, 2);
    run(seen);
    expect(seen.stats.kills).toBe(1);
  });

  it('a Splitter breaks into fragments when destroyed', () => {
    const game = new Game(level(CORRIDOR, { waves: oneWave('splitter') }));
    for (const x of [1, 2, 3, 4, 5]) game.place('pulse', x, 2);
    for (const t of game.towers) game.upgrade(t.id);
    game.startWave();
    let split = false;
    for (let i = 0; i < 30 * 30 && game.phase === 'wave'; i++) {
      game.step();
      if (game.drainEvents().some((e) => e.type === 'split')) {
        split = true;
        expect(game.enemies.filter((e) => e.kind === 'mite')).toHaveLength(3);
      }
    }
    expect(split).toBe(true);
  });

  it('an Arc discharge does not chain into the fragments it just made', () => {
    const game = new Game(
      level(['#######', 'S=====C', '#^^^^^#', '#######'], {
        hpScale: 0.05,
        waves: oneWave('splitter'),
      }),
    );
    game.place('arc', 1, 2);
    game.startWave();
    for (let i = 0; i < 30 * 5 && game.phase === 'wave'; i++) {
      game.step();
      const arc = game.drainEvents().find((e) => e.type === 'arc');
      if (arc && arc.type === 'arc') {
        expect(arc.points).toHaveLength(2);
        expect(game.enemies.filter((e) => e.kind === 'mite')).toHaveLength(3);
        return;
      }
    }
    throw new Error('the Arc never fired');
  });

  it('Throttle slows; two Throttles do not stack', () => {
    const one = new Game(level(OPEN, { waves: oneWave('bulwark') }));
    one.place('throttle', 2, 1);
    const e = spawnOne(one);
    for (let i = 0; i < 40; i++) one.step();
    expect(e.slow).toBeCloseTo(1 - TOWERS.throttle.levels[0].special);
    const two = new Game(level(OPEN, { waves: oneWave('bulwark') }));
    two.place('throttle', 2, 1);
    two.place('throttle', 2, 3);
    const e2 = spawnOne(two);
    for (let i = 0; i < 40; i++) two.step();
    expect(e2.slow).toBeCloseTo(e.slow);
  });

  it('Beacon boosts its neighbours, and boosts add up', () => {
    const game = new Game(level(OPEN));
    const t = game.place('pulse', 3, 1)!;
    expect(game.boost(t)).toBe(0);
    game.place('beacon', 2, 1);
    game.place('beacon', 4, 1);
    expect(game.boost(t)).toBeCloseTo(2 * TOWERS.beacon.levels[0].special);
  });

  it('a Mender heals the enemies around it', () => {
    const game = new Game(
      level(OPEN, {
        waves: [
          {
            groups: [
              { enemy: 'bulwark', count: 1, gap: 1 },
              { enemy: 'mender', count: 1, gap: 1, delay: 0.1 },
            ],
          },
        ],
      }),
    );
    game.startWave();
    for (let i = 0; i < 6; i++) game.step();
    const bulwark = game.enemies.find((e) => e.kind === 'bulwark')!;
    bulwark.hp = 10;
    game.step();
    expect(bulwark.hp).toBeGreaterThan(10);
  });

  it('targeting modes pick different enemies', () => {
    const pick = (mode: 'first' | 'last' | 'strong' | 'weak') => {
      const game = new Game(
        level(['##########', 'S========C', '#^^^^^^^^#', '##########'], {
          waves: oneWave('spark', 3, 0.4),
        }),
      );
      const t = game.place('pulse', 5, 2)!;
      game.setMode(t.id, mode);
      game.startWave();
      for (let i = 0; i < 84; i++) game.step();
      game.enemies[1]!.hp = 5;
      game.enemies[2]!.hp = 30;
      game.drainEvents();
      t.cooldown = 0;
      for (let i = 0; i < 10; i++) {
        game.step();
        const shot = game.shots.find((s) => s.towerId === t.id);
        if (shot) return game.enemies.findIndex((e) => e.id === shot.targetId);
      }
      return -1;
    };
    expect(pick('first')).toBe(0);
    expect(pick('last')).toBe(2);
    expect(pick('weak')).toBe(1);
  });
});

describe('waves and outcome', () => {
  it('loses lives on leaks and ends the game at zero', () => {
    const game = new Game(level(CORRIDOR, { lives: 3, waves: oneWave('spark', 5, 0.5) }));
    run(game);
    expect(game.phase).toBe('lost');
    expect(game.lives).toBe(0);
  });

  it('wins after the last wave is cleared', () => {
    const game = new Game(level(CORRIDOR, { waves: oneWave('spark') }));
    game.place('lance', 1, 2);
    run(game);
    expect(game.phase).toBe('won');
  });

  it('is deterministic', () => {
    const play = () => {
      const game = new Game(level(OPEN, { waves: oneWave('splitter', 6, 0.7) }));
      game.place('mortar', 3, 1);
      game.place('arc', 3, 3);
      game.place('throttle', 4, 1);
      run(game);
      return JSON.stringify([game.lives, game.credits, game.towers.map((t) => t.damageDealt)]);
    };
    expect(play()).toBe(play());
  });

  it('clones an independent state', () => {
    const game = new Game(level(OPEN));
    const copy = game.clone();
    copy.place('wall', 3, 2);
    expect(game.towers).toHaveLength(0);
    expect(game.routes()[0]).toHaveLength(7);
  });
});

describe('data', () => {
  it('every tower has a building cost and sensible levels', () => {
    for (const kind of Object.keys(TOWERS) as TowerKind[]) {
      for (const l of TOWERS[kind].levels) expect(l.cost).toBeGreaterThan(0);
    }
  });
});

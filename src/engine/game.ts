import {
  type Grid,
  UNREACHABLE,
  flowField,
  inBounds,
  index,
  isBuildableTile,
  isWalkableTile,
  nextStep,
  parseMap,
  route,
  tileAt,
} from './grid';
import { DT, ENEMIES, SELL_REFUND, TICK_RATE, TOWERS, afterArmour, type TowerLevel } from './stats';
import type {
  Cell,
  EnemyKind,
  LevelDef,
  Phase,
  PlaceError,
  Point,
  TargetMode,
  TowerKind,
} from './types';

export interface Tower {
  id: number;
  kind: TowerKind;
  x: number;
  y: number;
  level: number;
  mode: TargetMode;
  /** Seconds until the tower may fire again. */
  cooldown: number;
  /** Turret heading in radians, for the renderer. */
  angle: number;
  /** Credits spent before the current build phase (refunded at SELL_REFUND). */
  lockedCredits: number;
  /** Credits spent in the current build phase (refunded in full: an undo). */
  freshCredits: number;
  damageDealt: number;
  kills: number;
}

export interface Enemy {
  id: number;
  kind: EnemyKind;
  /** Position in cell units; the centre of cell (i, j) is (i + 0.5, j + 0.5). */
  x: number;
  y: number;
  /** The last cell centre it passed and the one it walks to. */
  cell: Cell;
  next: Cell | null;
  heading: Cell | null;
  hp: number;
  maxHp: number;
  /** Speed multiplier this tick (1 = full speed). */
  slow: number;
  revealed: boolean;
  /** Extra armour from a Colossus aura this tick. */
  shield: number;
  /** Ticks to stand still (fragments of a Splitter spread out this way). */
  hold: number;
  /** Hit point multiplier it spawned with; Splitter fragments inherit it. */
  scale: number;
  dead: boolean;
  /** Distance walked, for the renderer's gait. */
  walked: number;
}

export interface Shot {
  id: number;
  kind: 'bolt' | 'shell';
  towerId: number;
  x: number;
  y: number;
  /** Bolt: homing target. Shell: unused (-1). */
  targetId: number;
  /** Shell: where it lands, when, and from where it was fired. */
  from: Point;
  to: Point;
  age: number;
  flight: number;
  damage: number;
  splash: number;
}

export type GameEvent =
  | { type: 'bolt'; towerId: number; from: Point; to: Point }
  | { type: 'beam'; towerId: number; from: Point; to: Point; hits: Point[] }
  | { type: 'arc'; towerId: number; points: Point[] }
  | { type: 'shell'; towerId: number; from: Point; to: Point }
  | { type: 'blast'; at: Point; radius: number }
  | { type: 'hit'; enemyId: number; kind: EnemyKind; at: Point; damage: number }
  | { type: 'kill'; kind: EnemyKind; at: Point; bounty: number }
  | { type: 'leak'; kind: EnemyKind; at: Point; lives: number }
  | { type: 'split'; at: Point }
  | { type: 'build'; towerId: number; kind: TowerKind; at: Cell }
  | { type: 'upgrade'; towerId: number; level: number; at: Cell }
  | { type: 'sell'; towerId: number; refund: number; at: Cell }
  | { type: 'waveStart'; wave: number }
  | { type: 'waveClear'; wave: number; bonus: number }
  | { type: 'won' }
  | { type: 'lost' };

interface Scheduled {
  tick: number;
  kind: EnemyKind;
  spawn: number;
  hp: number;
}

const BOLT_SPEED = 12;
const SHELL_FLIGHT = 0.8;
const BEAM_HALF_WIDTH = 0.3;
const ARC_JUMP = 1.6;
const ARC_FALLOFF = 0.85;
const BEACON_REACH = 1;

export function centre(cell: Cell): Point {
  return { x: cell.x + 0.5, y: cell.y + 0.5 };
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export class Game {
  readonly level: LevelDef;
  readonly grid: Grid;
  readonly maxLives: number;
  towers: Tower[] = [];
  enemies: Enemy[] = [];
  shots: Shot[] = [];
  credits: number;
  lives: number;
  /** Index of the current wave while it runs, or of the next one in the build phase. */
  wave = 0;
  phase: Phase = 'build';
  /** Ticks since the level started (only waves advance it). */
  tick = 0;
  /** Events of the last call to `step()` or of the last command. Cleared by `drainEvents()`. */
  events: GameEvent[] = [];
  stats = { kills: 0, leaks: 0, spent: 0 };

  private nextId = 1;
  private blocked: boolean[];
  private dist: Float64Array;
  private schedule: Scheduled[] = [];
  private scheduleAt = 0;
  private waveTick = 0;

  constructor(level: LevelDef) {
    this.level = level;
    this.grid = parseMap(level.map);
    this.credits = level.credits;
    this.lives = level.lives;
    this.maxLives = level.lives;
    this.blocked = new Array<boolean>(this.grid.width * this.grid.height).fill(false);
    this.dist = flowField(this.grid, this.blocked);
    for (const spawn of this.grid.spawns) {
      if (this.distAt(spawn) === UNREACHABLE)
        throw new Error(`${level.id}: a spawn cannot reach the core`);
    }
  }

  /** An independent copy of the whole state, for look-ahead search. */
  clone(): Game {
    const g = new Game(this.level);
    g.towers = structuredClone(this.towers);
    g.enemies = structuredClone(this.enemies);
    g.shots = structuredClone(this.shots);
    g.credits = this.credits;
    g.lives = this.lives;
    g.wave = this.wave;
    g.phase = this.phase;
    g.tick = this.tick;
    g.stats = { ...this.stats };
    g.nextId = this.nextId;
    g.blocked = [...this.blocked];
    g.dist = new Float64Array(this.dist);
    g.schedule = this.schedule;
    g.scheduleAt = this.scheduleAt;
    g.waveTick = this.waveTick;
    return g;
  }

  /** Enemies of the current wave that have not entered the board yet. */
  toSpawn(): number {
    return this.phase === 'wave' ? this.schedule.length - this.scheduleAt : 0;
  }

  /** True while a wave is being played (a method, so a loop condition re-reads it). */
  running(): boolean {
    return this.phase === 'wave';
  }

  get waveCount(): number {
    return this.level.waves.length;
  }

  drainEvents(): GameEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  towerAt(x: number, y: number): Tower | undefined {
    return this.towers.find((t) => t.x === x && t.y === y);
  }

  towerById(id: number): Tower | undefined {
    return this.towers.find((t) => t.id === id);
  }

  /** Walking distance from a cell to the core. */
  distAt(cell: Cell): number {
    return this.dist[index(this.grid, cell.x, cell.y)] ?? UNREACHABLE;
  }

  /** The current route from each spawn to the core. */
  routes(): Cell[][] {
    return this.grid.spawns.map((s) => route(this.grid, this.dist, s) ?? []);
  }

  /** The routes as they would be with a tower on (x, y), or null when that cell is not walkable. */
  routesWith(x: number, y: number): Cell[][] | null {
    if (!isWalkableTile(tileAt(this.grid, x, y))) return null;
    const blocked = [...this.blocked];
    blocked[index(this.grid, x, y)] = true;
    const dist = flowField(this.grid, blocked);
    return this.grid.spawns.map((s) => route(this.grid, dist, s) ?? []);
  }

  // ---- Commands ---------------------------------------------------------------------------

  canPlace(kind: TowerKind, x: number, y: number): PlaceError | null {
    if (this.phase === 'won' || this.phase === 'lost') return 'over';
    if (!this.level.towers.includes(kind)) return 'locked';
    if (!inBounds(this.grid, x, y)) return 'tile';
    const tile = tileAt(this.grid, x, y);
    if (!isBuildableTile(tile)) return 'tile';
    if (kind === 'wall' && tile !== '.') return 'tile';
    if (this.towerAt(x, y)) return 'occupied';
    if (this.credits < TOWERS[kind].levels[0].cost) return 'funds';
    if (isWalkableTile(tile)) {
      if (this.phase === 'wave') return 'wave';
      const blocked = [...this.blocked];
      blocked[index(this.grid, x, y)] = true;
      const dist = flowField(this.grid, blocked);
      const reaches = (c: Cell) =>
        (dist[index(this.grid, c.x, c.y)] ?? UNREACHABLE) !== UNREACHABLE;
      if (!this.grid.spawns.every(reaches)) return 'blocks';
    }
    return null;
  }

  place(kind: TowerKind, x: number, y: number): Tower | null {
    if (this.canPlace(kind, x, y)) return null;
    const cost = TOWERS[kind].levels[0].cost;
    const tower: Tower = {
      id: this.nextId++,
      kind,
      x,
      y,
      level: 0,
      mode: 'first',
      cooldown: 0,
      angle: -Math.PI / 2,
      lockedCredits: 0,
      freshCredits: 0,
      damageDealt: 0,
      kills: 0,
    };
    this.spend(tower, cost);
    this.towers.push(tower);
    if (isWalkableTile(tileAt(this.grid, x, y))) {
      this.blocked[index(this.grid, x, y)] = true;
      this.dist = flowField(this.grid, this.blocked);
    }
    this.events.push({ type: 'build', towerId: tower.id, kind, at: { x, y } });
    return tower;
  }

  /** Cost of the next upgrade, or null at the top level. */
  upgradeCost(tower: Tower): number | null {
    return TOWERS[tower.kind].levels[tower.level + 1]?.cost ?? null;
  }

  upgrade(id: number): boolean {
    const tower = this.towerById(id);
    if (!tower || this.phase === 'won' || this.phase === 'lost') return false;
    const cost = this.upgradeCost(tower);
    if (cost === null || cost > this.credits) return false;
    this.spend(tower, cost);
    tower.level++;
    this.events.push({
      type: 'upgrade',
      towerId: id,
      level: tower.level,
      at: { x: tower.x, y: tower.y },
    });
    return true;
  }

  sellValue(tower: Tower): number {
    return tower.freshCredits + Math.floor(tower.lockedCredits * SELL_REFUND);
  }

  /** Why a tower cannot be sold right now, or null when it can. */
  canSell(tower: Tower): PlaceError | null {
    if (this.phase === 'won' || this.phase === 'lost') return 'over';
    if (this.phase === 'wave' && this.blocked[index(this.grid, tower.x, tower.y)]) return 'wave';
    return null;
  }

  sell(id: number): boolean {
    const tower = this.towerById(id);
    if (!tower || this.canSell(tower)) return false;
    const refund = this.sellValue(tower);
    this.credits += refund;
    this.stats.spent -= tower.freshCredits;
    this.towers = this.towers.filter((t) => t !== tower);
    if (this.blocked[index(this.grid, tower.x, tower.y)]) {
      this.blocked[index(this.grid, tower.x, tower.y)] = false;
      this.dist = flowField(this.grid, this.blocked);
    }
    this.events.push({ type: 'sell', towerId: id, refund, at: { x: tower.x, y: tower.y } });
    return true;
  }

  setMode(id: number, mode: TargetMode): void {
    const tower = this.towerById(id);
    if (tower && !TOWERS[tower.kind].passive) tower.mode = mode;
  }

  startWave(): boolean {
    if (this.phase !== 'build') return false;
    const wave = this.level.waves[this.wave];
    if (!wave) return false;
    for (const t of this.towers) {
      t.lockedCredits += t.freshCredits;
      t.freshCredits = 0;
    }
    this.schedule = wave.groups
      .flatMap((g) =>
        Array.from({ length: g.count }, (_, i) => ({
          tick: Math.round(((g.delay ?? 0) + i * g.gap) * TICK_RATE),
          kind: g.enemy,
          spawn: g.spawn ?? 0,
          hp: (g.hp ?? 1) * (this.level.hpScale ?? 1),
        })),
      )
      .sort((a, b) => a.tick - b.tick);
    this.scheduleAt = 0;
    this.waveTick = 0;
    this.phase = 'wave';
    this.events.push({ type: 'waveStart', wave: this.wave });
    return true;
  }

  // ---- Simulation -------------------------------------------------------------------------

  /** Advances the simulation by one tick. Does nothing outside a wave. */
  step(): void {
    if (this.phase !== 'wave') return;
    this.tick++;
    this.spawnDue();
    this.applyFields();
    this.heal();
    this.moveEnemies();
    this.fireTowers();
    this.moveShots();
    this.enemies = this.enemies.filter((e) => !e.dead);
    this.waveTick++;
    if (this.lives <= 0) {
      this.lives = 0;
      this.phase = 'lost';
      this.shots = [];
      this.events.push({ type: 'lost' });
      return;
    }
    if (this.scheduleAt >= this.schedule.length && this.enemies.length === 0) this.endWave();
  }

  private endWave(): void {
    this.shots = [];
    const cleared = this.wave;
    const bonus = this.level.waveBonus.base + this.level.waveBonus.perWave * cleared;
    this.wave++;
    if (this.wave >= this.level.waves.length) {
      this.phase = 'won';
      this.events.push({ type: 'waveClear', wave: cleared, bonus: 0 });
      this.events.push({ type: 'won' });
      return;
    }
    this.credits += bonus;
    this.phase = 'build';
    this.events.push({ type: 'waveClear', wave: cleared, bonus });
  }

  private spend(tower: Tower, cost: number): void {
    this.credits -= cost;
    this.stats.spent += cost;
    if (this.phase === 'build') tower.freshCredits += cost;
    else tower.lockedCredits += cost;
  }

  private spawnDue(): void {
    for (
      let s = this.schedule[this.scheduleAt];
      s && s.tick <= this.waveTick;
      s = this.schedule[this.scheduleAt]
    ) {
      this.scheduleAt++;
      const cell = this.grid.spawns[s.spawn] ?? this.grid.spawns[0] ?? this.grid.core;
      this.spawnEnemy(s.kind, cell, centre(cell), null, s.hp, 0);
    }
  }

  private spawnEnemy(
    kind: EnemyKind,
    cell: Cell,
    at: Point,
    heading: Cell | null,
    hpScale: number,
    hold: number,
  ): Enemy {
    const spec = ENEMIES[kind];
    const hp = Math.round(spec.hp * hpScale);
    const enemy: Enemy = {
      id: this.nextId++,
      kind,
      x: at.x,
      y: at.y,
      cell: { ...cell },
      next: null,
      heading,
      hp,
      maxHp: hp,
      slow: 1,
      revealed: !spec.cloaked,
      shield: 0,
      hold,
      dead: false,
      walked: 0,
      scale: hpScale,
    };
    enemy.next = nextStep(this.grid, this.dist, enemy.cell, heading);
    this.enemies.push(enemy);
    return enemy;
  }

  /** Slow fields, reveal and the Colossus aura: recomputed every tick from positions. */
  private applyFields(): void {
    const throttles = this.towers.filter((t) => t.kind === 'throttle');
    const beacons = this.towers.filter((t) => t.kind === 'beacon');
    const auras = this.enemies.filter((e) => !e.dead && ENEMIES[e.kind].aura);
    for (const e of this.enemies) {
      const spec = ENEMIES[e.kind];
      let cut = 0;
      for (const t of throttles) {
        const l = this.stat(t);
        if (distance(centre(t), e) <= l.range) cut = Math.max(cut, l.special);
      }
      e.slow = 1 - cut * (1 - (spec.slowResist ?? 0));
      e.revealed =
        !spec.cloaked || beacons.some((b) => distance(centre(b), e) <= this.stat(b).range);
      e.shield = 0;
      for (const a of auras) {
        const as = ENEMIES[a.kind];
        if (a !== e && distance(a, e) <= (as.auraRange ?? 0))
          e.shield = Math.max(e.shield, as.aura ?? 0);
      }
    }
  }

  private heal(): void {
    for (const m of this.enemies) {
      const spec = ENEMIES[m.kind];
      if (m.dead || !spec.heal) continue;
      for (const e of this.enemies) {
        if (e === m || e.dead || distance(m, e) > (spec.healRange ?? 0)) continue;
        e.hp = Math.min(e.maxHp, e.hp + spec.heal * DT);
      }
    }
  }

  private moveEnemies(): void {
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (e.hold > 0) {
        e.hold--;
        continue;
      }
      const reached = this.advance(e, ENEMIES[e.kind].speed * e.slow * DT);
      e.walked += ENEMIES[e.kind].speed * e.slow * DT;
      if (reached) {
        e.dead = true;
        const leak = ENEMIES[e.kind].leak;
        this.lives -= leak;
        this.stats.leaks++;
        this.events.push({ type: 'leak', kind: e.kind, at: { x: e.x, y: e.y }, lives: leak });
      }
    }
  }

  /**
   * Walks a body along the flow field by `step` cells. Returns true when it reaches the core.
   * Used for real movement and, on a copy, to predict where an enemy will be.
   */
  private advance(
    body: Pick<Enemy, 'x' | 'y' | 'cell' | 'next' | 'heading'>,
    step: number,
  ): boolean {
    let left = step;
    while (left > 0) {
      if (!body.next) return body.cell.x === this.grid.core.x && body.cell.y === this.grid.core.y;
      const target = centre(body.next);
      const d = distance(body, target);
      if (d > left) {
        body.x += ((target.x - body.x) / d) * left;
        body.y += ((target.y - body.y) / d) * left;
        return false;
      }
      left -= d;
      body.x = target.x;
      body.y = target.y;
      body.heading = { x: body.next.x - body.cell.x, y: body.next.y - body.cell.y };
      body.cell = body.next;
      if (body.cell.x === this.grid.core.x && body.cell.y === this.grid.core.y) return true;
      body.next = nextStep(this.grid, this.dist, body.cell, body.heading);
    }
    return false;
  }

  /** Remaining walking distance to the core: the "first" enemy has the smallest. */
  remaining(e: Enemy): number {
    if (!e.next) return 0;
    return this.distAt(e.next) + distance(e, centre(e.next));
  }

  /** Where an enemy will be after `seconds`, at its current speed. */
  predict(e: Enemy, seconds: number): Point {
    const body = {
      x: e.x,
      y: e.y,
      cell: { ...e.cell },
      next: e.next && { ...e.next },
      heading: e.heading,
    };
    const wait = Math.min(seconds, e.hold * DT);
    this.advance(body, ENEMIES[e.kind].speed * e.slow * (seconds - wait));
    return { x: body.x, y: body.y };
  }

  stat(t: Tower): TowerLevel {
    const levels = TOWERS[t.kind].levels;
    return levels[t.level] ?? levels[0];
  }

  /** Damage bonus from Beacons on the 8 neighbouring cells; several Beacons add up. */
  boost(t: Tower): number {
    if (TOWERS[t.kind].passive) return 0;
    let bonus = 0;
    for (const b of this.towers) {
      if (b.kind !== 'beacon' || b === t) continue;
      if (Math.max(Math.abs(b.x - t.x), Math.abs(b.y - t.y)) <= BEACON_REACH)
        bonus += this.stat(b).special;
    }
    return bonus;
  }

  private targetable(e: Enemy): boolean {
    return !e.dead && e.revealed;
  }

  private pickTarget(t: Tower): Enemy | null {
    const spec = TOWERS[t.kind];
    const l = this.stat(t);
    const c = centre(t);
    let best: Enemy | null = null;
    let bestKey = 0;
    for (const e of this.enemies) {
      if (!this.targetable(e)) continue;
      const d = distance(c, e);
      if (d > l.range || d < (spec.minRange ?? 0)) continue;
      const rem = this.remaining(e);
      // Lower key wins; ties go to the enemy closer to the core.
      const key =
        t.mode === 'first'
          ? rem
          : t.mode === 'last'
            ? -rem
            : t.mode === 'strong'
              ? -e.hp * 1e4 + rem
              : e.hp * 1e4 + rem;
      if (!best || key < bestKey) {
        best = e;
        bestKey = key;
      }
    }
    return best;
  }

  private fireTowers(): void {
    for (const t of this.towers) {
      const spec = TOWERS[t.kind];
      if (spec.passive) continue;
      // Keep the fractional remainder, so the real rate matches the stated one between ticks.
      t.cooldown -= DT;
      if (t.cooldown > 1e-9) continue;
      const target = this.pickTarget(t);
      if (!target) {
        t.cooldown = 0;
        continue;
      }
      const l = this.stat(t);
      const from = centre(t);
      t.angle = Math.atan2(target.y - from.y, target.x - from.x);
      t.cooldown += 1 / l.rate;
      const damage = l.damage * (1 + this.boost(t));
      switch (t.kind) {
        case 'pulse':
          this.shots.push({
            id: this.nextId++,
            kind: 'bolt',
            towerId: t.id,
            x: from.x,
            y: from.y,
            targetId: target.id,
            from,
            to: { x: target.x, y: target.y },
            age: 0,
            flight: 0,
            damage,
            splash: 0,
          });
          this.events.push({ type: 'bolt', towerId: t.id, from, to: { x: target.x, y: target.y } });
          break;
        case 'arc':
          this.fireArc(t, target, damage, l.special);
          break;
        case 'lance':
          this.fireBeam(t, target, damage, l.range);
          break;
        case 'mortar': {
          const to = this.predict(target, SHELL_FLIGHT);
          this.shots.push({
            id: this.nextId++,
            kind: 'shell',
            towerId: t.id,
            x: from.x,
            y: from.y,
            targetId: -1,
            from,
            to,
            age: 0,
            flight: SHELL_FLIGHT,
            damage,
            splash: l.special,
          });
          this.events.push({ type: 'shell', towerId: t.id, from, to });
          break;
        }
        default:
          break;
      }
    }
  }

  private fireArc(t: Tower, first: Enemy, damage: number, jumps: number): void {
    const points: Point[] = [centre(t)];
    const hit = new Set<Enemy>();
    let current: Enemy | null = first;
    let dmg = damage;
    while (current && hit.size < jumps) {
      hit.add(current);
      points.push({ x: current.x, y: current.y });
      this.damage(t, current, dmg);
      dmg *= ARC_FALLOFF;
      const from: Enemy = current;
      current = null;
      let bestD = ARC_JUMP;
      // A copy: fragments a Splitter drops in this discharge are not hit by it.
      for (const e of [...this.enemies]) {
        if (hit.has(e) || !this.targetable(e)) continue;
        const d = distance(from, e);
        if (d <= bestD) {
          bestD = d;
          current = e;
        }
      }
    }
    this.events.push({ type: 'arc', towerId: t.id, points });
  }

  private fireBeam(t: Tower, target: Enemy, damage: number, range: number): void {
    const from = centre(t);
    const len = distance(from, target);
    if (len === 0) return;
    const ux = (target.x - from.x) / len;
    const uy = (target.y - from.y) / len;
    const to = { x: from.x + ux * range, y: from.y + uy * range };
    const hits: Point[] = [];
    for (const e of [...this.enemies]) {
      if (!this.targetable(e)) continue;
      const along = (e.x - from.x) * ux + (e.y - from.y) * uy;
      if (along < 0 || along > range) continue;
      const across = Math.abs((e.x - from.x) * uy - (e.y - from.y) * ux);
      if (across > BEAM_HALF_WIDTH + ENEMIES[e.kind].radius) continue;
      hits.push({ x: e.x, y: e.y });
      this.damage(t, e, damage);
    }
    this.events.push({ type: 'beam', towerId: t.id, from, to, hits });
  }

  private moveShots(): void {
    const keep: Shot[] = [];
    for (const s of this.shots) {
      s.age += DT;
      if (s.kind === 'bolt') {
        const target = this.enemies.find((e) => e.id === s.targetId && !e.dead);
        if (!target) continue; // the target died or leaked: the bolt fizzles
        const d = distance(s, target);
        const step = BOLT_SPEED * DT;
        if (d <= step) {
          const tower = this.towerById(s.towerId);
          this.damage(tower, target, s.damage);
          continue;
        }
        s.x += ((target.x - s.x) / d) * step;
        s.y += ((target.y - s.y) / d) * step;
        keep.push(s);
      } else {
        const p = Math.min(1, s.age / s.flight);
        s.x = s.from.x + (s.to.x - s.from.x) * p;
        s.y = s.from.y + (s.to.y - s.from.y) * p;
        if (p < 1) {
          keep.push(s);
          continue;
        }
        const tower = this.towerById(s.towerId);
        for (const e of [...this.enemies]) {
          if (this.targetable(e) && distance(e, s.to) <= s.splash) this.damage(tower, e, s.damage);
        }
        this.events.push({ type: 'blast', at: s.to, radius: s.splash });
      }
    }
    this.shots = keep;
  }

  private damage(tower: Tower | undefined, e: Enemy, raw: number): void {
    if (e.dead) return;
    const spec = ENEMIES[e.kind];
    const pierce = tower ? Boolean(TOWERS[tower.kind].pierceArmour) : false;
    const dealt = Math.min(e.hp, afterArmour(raw, spec.armour + e.shield, pierce));
    e.hp -= dealt;
    if (tower) tower.damageDealt += dealt;
    this.events.push({
      type: 'hit',
      enemyId: e.id,
      kind: e.kind,
      at: { x: e.x, y: e.y },
      damage: dealt,
    });
    if (e.hp > 1e-9) return;
    e.dead = true;
    this.credits += spec.bounty;
    this.stats.kills++;
    if (tower) tower.kills++;
    this.events.push({ type: 'kill', kind: e.kind, at: { x: e.x, y: e.y }, bounty: spec.bounty });
    if (spec.splitInto) {
      this.events.push({ type: 'split', at: { x: e.x, y: e.y } });
      for (let i = 0; i < spec.splitInto.count; i++) {
        const child = this.spawnEnemy(
          spec.splitInto.enemy,
          e.cell,
          { x: e.x, y: e.y },
          e.heading,
          e.scale,
          i * 8,
        );
        child.next = e.next && { ...e.next };
      }
    }
  }
}

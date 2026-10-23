// Draws a game on a 2D canvas: a cached background layer (meadow, paths, stone circles, rock),
// then each frame the routes, fields, characters, shots and effects. Characters are pre-rendered
// sprites (art/README.md), drawn back to front so nearer ones overlap farther ones. The
// simulation ticks at 30 Hz and the board interpolates positions between ticks, so motion stays
// smooth at any refresh rate.
import { centre, type Game, type GameEvent } from '../engine/game';
import { DT, ENEMIES, TOWERS } from '../engine/stats';
import type { Cell, TowerKind } from '../engine/types';
import { ENEMY_ART, SCENERY_ART, TOWER_ART, enemyRing, levelSprites, towerSprite } from './art';
import { Effects } from './effects';
import { alpha, type Palette } from './palette';
import { FRAME, GROUND, SQUASH, SpriteCache, TILT, preloadSprites } from './sprite-cache';
import { drawEnemy, drawTower, glow, roundRect } from './sprites';
import { paintTerrain } from './terrain';

export interface BoardView {
  /** Cell under the pointer or the keyboard cursor. */
  hover: Cell | null;
  /** The tower kind being placed, with the verdict on the hovered cell. */
  ghost: { kind: TowerKind; valid: boolean; routes: Cell[][] | null } | null;
  selected: number | null;
  /** Keyboard cursor is active: draw it even without a pointer. */
  cursor: boolean;
}

interface Snapshot {
  x: number;
  y: number;
}

type Tower = Game['towers'][number];
type Enemy = Game['enemies'][number];

/** One thing standing on the board, in the order it is drawn. Reused from frame to frame. */
interface Actor {
  /** Ground line in cells: the sort key. */
  y: number;
  x: number;
  kind: 'gate' | 'core' | 'tower' | 'fault';
  tower: Tower | null;
  enemy: Enemy | null;
}

/** Pedestal radius in model units (art/blender/render_sprite.py). */
const PEDESTAL = 0.36;
/** How much of a cell a defender's pedestal spans. */
const PEDESTAL_SPAN = 0.94;
/** A character turns only when its aim or walk is clearly to one side, so it does not flicker. */
const TURN = 0.25;

/** Pixels per model unit for a defender, so its pedestal fills the tile. */
function towerScale(kind: TowerKind, s: number): number {
  return kind === 'wall' ? (s * 1.02) / 0.9 : (s * PEDESTAL_SPAN) / (2 * PEDESTAL);
}

export class BoardRenderer {
  readonly effects: Effects;
  private ctx: CanvasRenderingContext2D;
  private layer: HTMLCanvasElement | null = null;
  private game: Game | null = null;
  private cell = 32;
  private dpr = 1;
  private prev = new Map<number, Snapshot>();
  private fired = new Map<number, number>();
  private hits = new Map<number, number>();
  /** Last facing of each tower and fault: true when it looks left. */
  private facing = new Map<string, boolean>();
  private sprites = new SpriteCache();
  private actors: Actor[] = [];
  private actorCount = 0;
  /** Faults whose health bar goes on top once every character is drawn. */
  private bars: { enemy: Enemy; x: number; y: number }[] = [];
  private barCount = 0;
  /** Game-time clock used for recoil and hit flashes (seconds). */
  private clock = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    private palette: Palette,
    private reducedMotion: boolean,
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas is not available');
    this.ctx = ctx;
    this.effects = new Effects(palette, reducedMotion);
  }

  setGame(game: Game): void {
    this.game = game;
    this.prev.clear();
    this.fired.clear();
    this.hits.clear();
    this.facing.clear();
    this.effects.clear();
    this.layer = null;
    preloadSprites(levelSprites(game.level));
  }

  /** Sizes the backing store to the canvas's CSS box. */
  resize(): void {
    const game = this.game;
    if (!game) return;
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.cell = (rect.width / game.grid.width) * this.dpr;
    this.canvas.width = Math.max(1, Math.round(rect.width * this.dpr));
    this.canvas.height = Math.max(1, Math.round(this.cell * game.grid.height));
    this.layer = null;
    this.sprites.clear();
  }

  /** The map cell under a client (CSS pixel) position. */
  cellAt(clientX: number, clientY: number): Cell | null {
    const game = this.game;
    if (!game) return null;
    const rect = this.canvas.getBoundingClientRect();
    const size = rect.width / game.grid.width;
    const x = Math.floor((clientX - rect.left) / size);
    const y = Math.floor((clientY - rect.top) / size);
    if (x < 0 || y < 0 || x >= game.grid.width || y >= game.grid.height) return null;
    return { x, y };
  }

  /** Call before each simulation tick: remembers positions for interpolation. */
  snapshot(): void {
    const game = this.game;
    if (!game) return;
    this.prev.clear();
    for (const e of game.enemies) this.prev.set(e.id, { x: e.x, y: e.y });
    for (const s of game.shots) this.prev.set(s.id, { x: s.x, y: s.y });
  }

  handle(events: GameEvent[]): void {
    for (const e of events) {
      if (e.type === 'bolt' || e.type === 'beam' || e.type === 'arc' || e.type === 'shell')
        this.fired.set(e.towerId, this.clock);
      if (e.type === 'hit') this.hits.set(e.enemyId, this.clock);
    }
    this.effects.handle(events);
  }

  /** Advances effect animations by `dt` game seconds. */
  advance(dt: number): void {
    this.clock += dt;
    this.effects.update(dt);
  }

  draw(lerp: number, time: number, view: BoardView): void {
    const game = this.game;
    if (!game) return;
    if (!this.layer) this.layer = this.paintLayer(game);
    const ctx = this.ctx;
    const s = this.cell;
    const p = this.palette;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const shake = this.reducedMotion ? 0 : this.effects.shake * s;
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    ctx.drawImage(this.layer, 0, 0);

    this.drawRoutes(game, time, view);
    this.drawFields(game, view);
    this.drawActors(game, lerp, time, view);
    this.drawShots(game, lerp);
    this.effects.draw(ctx, s);
    this.drawCursor(view);

    if (this.effects.alarm > 0) {
      const w = this.canvas.width;
      const h = this.canvas.height;
      const g = ctx.createRadialGradient(
        w / 2,
        h / 2,
        Math.min(w, h) * 0.3,
        w / 2,
        h / 2,
        Math.max(w, h) * 0.7,
      );
      g.addColorStop(0, alpha(p.danger, 0));
      g.addColorStop(1, alpha(p.danger, 0.28 * this.effects.alarm));
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
  }

  // ---- Background layer -------------------------------------------------------------------

  private paintLayer(game: Game): HTMLCanvasElement {
    const layer = document.createElement('canvas');
    layer.width = this.canvas.width;
    layer.height = this.canvas.height;
    const ctx = layer.getContext('2d');
    if (ctx) paintTerrain(ctx, game.grid, this.cell);
    return layer;
  }

  // ---- Sprites ----------------------------------------------------------------------------

  /**
   * Draws a sprite standing at (x, y) in pixels, scaled to `unit` pixels per model unit, on whole
   * pixels so the cached bitmap is copied, not resampled. False while the image is loading.
   */
  private blit(name: string, unit: number, x: number, y: number, flip = false): boolean {
    const sprite = this.sprites.get(name, FRAME * unit);
    if (!sprite) return false;
    const { img, px } = sprite;
    const top = Math.round(y - px * (0.5 + GROUND));
    if (!flip) {
      this.ctx.drawImage(img, Math.round(x - px / 2), top, px, px);
      return true;
    }
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(Math.round(x), 0);
    ctx.scale(-1, 1);
    ctx.drawImage(img, -Math.round(px / 2), top, px, px);
    ctx.restore();
    return true;
  }

  /** Whether a character looks left, changing only when `cos` points clearly to one side. */
  private looksLeft(key: string, cos: number): boolean {
    const was = this.facing.get(key) ?? false;
    const now = cos < -TURN ? true : cos > TURN ? false : was;
    this.facing.set(key, now);
    return now;
  }

  // ---- Dynamic layers ---------------------------------------------------------------------

  private drawRoutes(game: Game, time: number, view: BoardView): void {
    const ctx = this.ctx;
    const s = this.cell;
    const p = this.palette;
    const offset = this.reducedMotion ? 0 : -(time * s * 0.9) % (s * 0.5);
    const paths = (routes: Cell[][], colour: string, width: number) => {
      ctx.save();
      ctx.strokeStyle = colour;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.setLineDash([s * 0.12, s * 0.38]);
      ctx.lineDashOffset = offset;
      for (const r of routes) {
        ctx.beginPath();
        r.forEach((c, i) =>
          i === 0
            ? ctx.moveTo((c.x + 0.5) * s, (c.y + 0.5) * s)
            : ctx.lineTo((c.x + 0.5) * s, (c.y + 0.5) * s),
        );
        ctx.stroke();
      }
      ctx.restore();
    };
    const preview = view.ghost?.routes;
    if (preview && view.ghost?.valid) {
      paths(game.routes(), alpha(p.text, 0.25), Math.max(1.5, s * 0.06));
      paths(preview, alpha(p.signal, 0.9), Math.max(2, s * 0.09));
    } else {
      paths(
        game.routes(),
        alpha(p.text, game.phase === 'build' ? 0.6 : 0.3),
        Math.max(1.5, s * 0.07),
      );
    }
  }

  private drawFields(game: Game, view: BoardView): void {
    const ctx = this.ctx;
    const s = this.cell;
    for (const t of game.towers) {
      if (t.kind !== 'throttle' && t.kind !== 'beacon') continue;
      const c = centre(t);
      const r = game.stat(t).range * s;
      const colour = TOWER_ART[t.kind].colour;
      ctx.save();
      if (t.kind === 'throttle') {
        const g = ctx.createRadialGradient(c.x * s, c.y * s, 0, c.x * s, c.y * s, r);
        g.addColorStop(0, alpha(colour, 0.03));
        g.addColorStop(0.85, alpha(colour, 0.1));
        g.addColorStop(1, alpha(colour, 0.18));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(c.x * s, c.y * s, r, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.strokeStyle = alpha(colour, 0.35);
        ctx.setLineDash([s * 0.06, s * 0.12]);
        ctx.lineWidth = Math.max(1, s * 0.025);
        ctx.beginPath();
        ctx.arc(c.x * s, c.y * s, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        // Threads of light to the defenders it strengthens.
        ctx.strokeStyle = alpha(colour, 0.7);
        ctx.lineWidth = Math.max(1, s * 0.035);
        for (const o of game.towers) {
          if (o === t || TOWERS[o.kind].passive) continue;
          if (Math.max(Math.abs(o.x - t.x), Math.abs(o.y - t.y)) > 1) continue;
          ctx.beginPath();
          ctx.moveTo(c.x * s, c.y * s);
          ctx.lineTo((o.x + 0.5) * s, (o.y + 0.5) * s);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
    // Range of the selected tower.
    const sel = view.selected !== null ? game.towerById(view.selected) : undefined;
    if (sel && sel.kind !== 'wall')
      this.rangeRing(
        centre(sel),
        game.stat(sel).range,
        TOWERS[sel.kind].minRange,
        TOWER_ART[sel.kind].colour,
      );
  }

  private rangeRing(
    c: Cell | { x: number; y: number },
    range: number,
    minRange: number | undefined,
    colour: string,
  ): void {
    const ctx = this.ctx;
    const s = this.cell;
    ctx.save();
    ctx.fillStyle = alpha(colour, 0.08);
    ctx.strokeStyle = alpha(colour, 0.8);
    ctx.lineWidth = Math.max(1, s * 0.03);
    ctx.setLineDash([s * 0.1, s * 0.08]);
    ctx.beginPath();
    ctx.arc(c.x * s, c.y * s, range * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (minRange) {
      ctx.strokeStyle = alpha(this.palette.danger, 0.7);
      ctx.beginPath();
      ctx.arc(c.x * s, c.y * s, minRange * s, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  private addActor(
    y: number,
    x: number,
    kind: Actor['kind'],
    tower: Tower | null,
    enemy: Enemy | null,
  ) {
    let a = this.actors[this.actorCount];
    if (!a) {
      a = { y, x, kind, tower, enemy };
      this.actors.push(a);
    } else {
      a.y = y;
      a.x = x;
      a.kind = kind;
      a.tower = tower;
      a.enemy = enemy;
    }
    this.actorCount++;
  }

  /** Gates, the core, defenders and faults, sorted by their ground line; health bars on top. */
  private drawActors(game: Game, lerp: number, time: number, view: BoardView): void {
    this.actorCount = 0;
    this.barCount = 0;
    for (const sp of game.grid.spawns) this.addActor(sp.y + 0.5, sp.x + 0.5, 'gate', null, null);
    const core = game.grid.core;
    this.addActor(core.y + 0.5, core.x + 0.5, 'core', null, null);
    for (const t of game.towers) this.addActor(t.y + 0.5, t.x + 0.5, 'tower', t, null);
    for (const e of game.enemies) {
      const prev = this.prev.get(e.id);
      const x = prev ? prev.x + (e.x - prev.x) * lerp : e.x;
      const y = prev ? prev.y + (e.y - prev.y) * lerp : e.y;
      this.addActor(y, x, 'fault', null, e);
    }
    const live = this.actors.slice(0, this.actorCount).sort((a, b) => a.y - b.y);
    for (const a of live) {
      if (a.kind === 'gate') this.drawGate(a.x, a.y, time);
      else if (a.kind === 'core') this.drawCore(game, a.x, a.y, time);
      else if (a.kind === 'tower' && a.tower) this.drawTower(a.tower, a.x, a.y, time, view);
      else if (a.kind === 'fault' && a.enemy) this.drawFault(a.enemy, a.x, a.y, time);
    }
    for (let i = 0; i < this.barCount; i++) {
      const bar = this.bars[i];
      if (bar) this.drawHealth(bar.enemy, bar.x, bar.y);
    }
  }

  private drawGate(cx: number, cy: number, time: number): void {
    const s = this.cell;
    const t = this.reducedMotion ? 0 : time;
    glow(this.ctx, cx * s, cy * s, s * (0.8 + 0.08 * Math.sin(t * 2)), '#8a3bd1', 0.35);
    if (!this.blit(SCENERY_ART.gate, s / 0.95, cx * s, cy * s)) {
      const ctx = this.ctx;
      ctx.strokeStyle = alpha(this.palette.danger, 0.85);
      ctx.lineWidth = Math.max(1.2, s * 0.045);
      ctx.beginPath();
      ctx.arc(cx * s, cy * s, s * 0.32, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  private drawCore(game: Game, cx: number, cy: number, time: number): void {
    const ctx = this.ctx;
    const s = this.cell;
    const p = this.palette;
    const t = this.reducedMotion ? 0 : time;
    const health = game.lives / game.maxLives;
    const beat = 0.5 + 0.5 * Math.sin(t * 2.2);
    glow(ctx, cx * s, cy * s, s * (1.0 + beat * 0.15), '#ffd97a', 0.3);
    // Life ring on the ground: the share of lives left.
    ctx.save();
    ctx.translate(cx * s, cy * s);
    ctx.scale(1, SQUASH);
    ctx.lineWidth = Math.max(2, s * 0.07);
    ctx.strokeStyle = alpha(p.bgDeep, 0.7);
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.46, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = health > 0.5 ? p.success : health > 0.25 ? p.warning : p.danger;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.46, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * health);
    ctx.stroke();
    ctx.restore();
    this.blit(SCENERY_ART.core, s * 1.35, cx * s, cy * s + s * 0.1);
  }

  private drawTower(t: Tower, cx: number, cy: number, time: number, view: BoardView): void {
    const ctx = this.ctx;
    const s = this.cell;
    const since = this.clock - (this.fired.get(t.id) ?? -10);
    const recoil = Math.max(0, 1 - since / 0.18);
    const art = TOWER_ART[t.kind];
    const x = cx * s;
    const y = cy * s;
    if (view.selected === t.id) this.groundRing(x, y, s * 0.52, this.palette.text, 0.05);
    // Defenders turn towards their target; the sprites face right unless marked otherwise.
    const left = t.kind !== 'wall' && this.looksLeft(`t${t.id}`, Math.cos(t.angle));
    const lift = this.reducedMotion ? 0 : recoil * s * 0.04;
    if (
      !this.blit(
        towerSprite(t.kind, t.level),
        towerScale(t.kind, s),
        x,
        y - lift,
        left !== !!art.facesLeft,
      )
    ) {
      ctx.save();
      ctx.translate(x, y);
      drawTower(
        ctx,
        {
          kind: t.kind,
          level: t.level,
          angle: t.angle,
          time: this.reducedMotion ? 0 : time,
          recoil,
        },
        s,
        this.palette,
      );
      ctx.restore();
    }
  }

  private drawFault(e: Enemy, x: number, y: number, time: number): void {
    const ctx = this.ctx;
    const s = this.cell;
    const p = this.palette;
    const spec = ENEMIES[e.kind];
    const art = ENEMY_ART[e.kind];
    const heading = e.next ? Math.atan2(e.next.y + 0.5 - e.y, e.next.x + 0.5 - e.x) : 0;
    const since = this.clock - (this.hits.get(e.id) ?? -10);
    const flash = Math.max(0, 1 - since / 0.08);
    const ring = spec.radius * s * 1.5;
    const unit = ring / enemyRing(e.kind);
    const px = x * s;
    const py = y * s;
    const t = this.reducedMotion ? 0 : time + e.id;
    const cloaked = !!spec.cloaked && !e.revealed;
    const left = this.looksLeft(`e${e.id}`, Math.cos(heading));

    if (e.slow < 0.999) this.groundRing(px, py, ring * 1.1, alpha(TOWER_ART.throttle.colour, 0.9));
    if (e.shield > 0) this.groundRing(px, py, ring * 1.3, alpha(p.warning, 0.8));
    ctx.save();
    if (cloaked) ctx.globalAlpha = 0.3 + 0.12 * Math.sin(t * 6);
    const drawn = this.blit(art.sprite, unit, px, py, left);
    if (drawn && flash > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha *= flash * 0.6;
      this.blit(art.sprite, unit, px, py, left);
    }
    ctx.restore();
    if (!drawn) {
      // The vector fallback fades a cloaked fault by itself.
      ctx.save();
      ctx.translate(px, py);
      drawEnemy(
        ctx,
        { kind: e.kind, r: spec.radius * s, heading, time: t, revealed: e.revealed, flash },
        p,
      );
      ctx.restore();
    }
    if (e.hp < e.maxHp && !cloaked) {
      let bar = this.bars[this.barCount];
      if (!bar) {
        bar = { enemy: e, x, y };
        this.bars.push(bar);
      }
      bar.enemy = e;
      bar.x = x;
      bar.y = y;
      this.barCount++;
    }
  }

  private drawHealth(e: Enemy, x: number, y: number): void {
    const ctx = this.ctx;
    const s = this.cell;
    const p = this.palette;
    const ring = ENEMIES[e.kind].radius * s * 1.5;
    const unit = ring / enemyRing(e.kind);
    const w = Math.max(s * 0.5, ring * 1.6);
    const h = Math.max(3, s * 0.07);
    const bx = x * s - w / 2;
    const by = y * s - ENEMY_ART[e.kind].size * unit * TILT - s * 0.12;
    ctx.fillStyle = alpha(p.bgDeep, 0.85);
    ctx.fillRect(bx - 1, by - 1, w + 2, h + 2);
    const k = e.hp / e.maxHp;
    ctx.fillStyle = k > 0.5 ? p.success : k > 0.25 ? p.warning : p.danger;
    ctx.fillRect(bx, by, w * k, h);
  }

  /** A ring lying on the ground around (x, y): `r` is its radius across. */
  private groundRing(x: number, y: number, r: number, colour: string, width = 0.04): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, SQUASH);
    ctx.strokeStyle = colour;
    ctx.lineWidth = Math.max(1.5, this.cell * width) / SQUASH;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private drawShots(game: Game, lerp: number): void {
    const ctx = this.ctx;
    const s = this.cell;
    for (const shot of game.shots) {
      const prev = this.prev.get(shot.id);
      const x = prev ? prev.x + (shot.x - prev.x) * lerp : shot.x;
      const y = prev ? prev.y + (shot.y - prev.y) * lerp : shot.y;
      if (shot.kind === 'bolt') {
        // An arrow: a shaft along the flight, a pale head and a green fletching.
        const px = prev?.x ?? shot.from.x;
        const py = prev?.y ?? shot.from.y;
        const a = Math.atan2(y - py, x - px);
        ctx.save();
        ctx.translate(x * s, y * s);
        ctx.rotate(a);
        ctx.strokeStyle = '#6b4a2b';
        ctx.lineWidth = Math.max(1.2, s * 0.035);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-s * 0.26, 0);
        ctx.lineTo(0, 0);
        ctx.stroke();
        ctx.fillStyle = '#e9e4d8';
        ctx.beginPath();
        ctx.moveTo(s * 0.06, 0);
        ctx.lineTo(-s * 0.02, -s * 0.03);
        ctx.lineTo(-s * 0.02, s * 0.03);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = TOWER_ART.pulse.colour;
        ctx.fillRect(-s * 0.26, -s * 0.025, s * 0.06, s * 0.05);
        ctx.restore();
      } else {
        // A boulder thrown by an Ent: an arc in the air, a shadow and a landing mark.
        const k = Math.min(1, (shot.age + lerp * DT) / shot.flight);
        const lift = Math.sin(Math.PI * k) * s * 0.9;
        ctx.strokeStyle = alpha(TOWER_ART.mortar.colour, 0.35 + 0.45 * k);
        ctx.lineWidth = Math.max(1, s * 0.03);
        ctx.beginPath();
        ctx.arc(shot.to.x * s, shot.to.y * s, shot.splash * s * (1.2 - 0.2 * k), 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.beginPath();
        ctx.ellipse(x * s, y * s, s * 0.1, s * 0.1 * SQUASH, 0, 0, Math.PI * 2);
        ctx.fill();
        const r = Math.max(2, s * 0.09);
        ctx.fillStyle = '#7d7a78';
        ctx.beginPath();
        ctx.arc(x * s, y * s - lift, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#a7a39f';
        ctx.beginPath();
        ctx.arc(x * s - r * 0.3, y * s - lift - r * 0.3, r * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private drawCursor(view: BoardView): void {
    const cell = view.hover;
    if (!cell) return;
    const ctx = this.ctx;
    const s = this.cell;
    const p = this.palette;
    const ghost = view.ghost;
    if (ghost) {
      const colour = ghost.valid ? TOWER_ART[ghost.kind].colour : p.danger;
      if (ghost.kind !== 'wall')
        this.rangeRing(
          centre(cell),
          TOWERS[ghost.kind].levels[0].range,
          TOWERS[ghost.kind].minRange,
          colour,
        );
      ctx.save();
      ctx.globalAlpha = ghost.valid ? 0.75 : 0.35;
      const x = (cell.x + 0.5) * s;
      const y = (cell.y + 0.5) * s;
      if (!this.blit(towerSprite(ghost.kind, 0), towerScale(ghost.kind, s), x, y)) {
        ctx.translate(x, y);
        drawTower(
          ctx,
          { kind: ghost.kind, level: 0, angle: -Math.PI / 2, time: 0, recoil: 0 },
          s,
          p,
        );
      }
      ctx.restore();
    }
    const colour = ghost
      ? ghost.valid
        ? p.signal
        : p.danger
      : view.cursor
        ? p.signal
        : alpha(p.text, 0.6);
    ctx.save();
    ctx.strokeStyle = colour;
    ctx.lineWidth = Math.max(1.5, s * 0.04);
    roundRect(ctx, cell.x * s + 1, cell.y * s + 1, s - 2, s - 2, s * 0.12);
    ctx.stroke();
    if (ghost && !ghost.valid) {
      ctx.beginPath();
      ctx.moveTo(cell.x * s + s * 0.3, cell.y * s + s * 0.3);
      ctx.lineTo(cell.x * s + s * 0.7, cell.y * s + s * 0.7);
      ctx.moveTo(cell.x * s + s * 0.7, cell.y * s + s * 0.3);
      ctx.lineTo(cell.x * s + s * 0.3, cell.y * s + s * 0.7);
      ctx.stroke();
    }
    ctx.restore();
  }
}

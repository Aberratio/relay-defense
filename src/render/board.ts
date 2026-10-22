// Draws a game on a 2D canvas: a cached background layer (tiles, lanes, sockets, rock), then each
// frame the routes, fields, towers, enemies, shots and effects. The simulation ticks at 30 Hz and
// the board interpolates positions between ticks, so motion stays smooth at any refresh rate.
import { centre, type Game, type GameEvent } from '../engine/game';
import { tileAt } from '../engine/grid';
import { DT, ENEMIES, TOWERS } from '../engine/stats';
import type { Cell, TowerKind } from '../engine/types';
import { Effects } from './effects';
import { alpha, type Palette } from './palette';
import { drawEnemy, drawTower, glow, polygon, roundRect, towerColour } from './sprites';

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
    this.effects.clear();
    this.layer = null;
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
    this.drawGates(game, time);
    this.drawTowers(game, time, view);
    this.drawEnemies(game, lerp, time);
    this.drawShots(game, lerp);
    this.effects.draw(ctx, s);
    this.drawCursor(time, view);

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
    if (!ctx) return layer;
    const s = this.cell;
    const p = this.palette;
    const { width, height } = game.grid;

    const bg = ctx.createRadialGradient(
      layer.width / 2,
      layer.height / 2,
      0,
      layer.width / 2,
      layer.height / 2,
      layer.width * 0.7,
    );
    bg.addColorStop(0, p.bg);
    bg.addColorStop(1, p.bgDeep);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, layer.width, layer.height);

    const tile = (x: number, y: number) => tileAt(game.grid, x, y);

    // Rock: hatched, with a rim where it meets open ground.
    ctx.save();
    ctx.beginPath();
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) if (tile(x, y) === '#') ctx.rect(x * s, y * s, s, s);
    ctx.fillStyle = p.bgDeep;
    ctx.fill();
    ctx.clip();
    ctx.strokeStyle = alpha(p.line, 0.35);
    ctx.lineWidth = Math.max(1, s * 0.02);
    ctx.beginPath();
    for (let k = -height; k < width + height; k += 0.5) {
      ctx.moveTo(k * s, 0);
      ctx.lineTo((k - height) * s, height * s);
    }
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = p.line;
    ctx.lineWidth = Math.max(1, s * 0.03);
    ctx.beginPath();
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (tile(x, y) !== '#') continue;
        const edge = (x1: number, y1: number, x2: number, y2: number) => {
          ctx.moveTo(x1 * s, y1 * s);
          ctx.lineTo(x2 * s, y2 * s);
        };
        if (tile(x, y - 1) !== '#' && y > 0) edge(x, y, x + 1, y);
        if (tile(x, y + 1) !== '#' && y < height - 1) edge(x, y + 1, x + 1, y + 1);
        if (tile(x - 1, y) !== '#' && x > 0) edge(x, y, x, y + 1);
        if (tile(x + 1, y) !== '#' && x < width - 1) edge(x + 1, y, x + 1, y + 1);
      }
    }
    ctx.stroke();

    // Floor tiles and sockets (pads).
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const t = tile(x, y);
        if (t === '.') {
          roundRect(ctx, x * s + s * 0.04, y * s + s * 0.04, s * 0.92, s * 0.92, s * 0.08);
          ctx.fillStyle = alpha(p.surface, 0.9);
          ctx.fill();
          ctx.strokeStyle = alpha(p.line, 0.6);
          ctx.lineWidth = Math.max(1, s * 0.015);
          ctx.stroke();
          ctx.fillStyle = alpha(p.lineStrong, 0.6);
          ctx.beginPath();
          ctx.arc((x + 0.5) * s, (y + 0.5) * s, Math.max(0.8, s * 0.025), 0, Math.PI * 2);
          ctx.fill();
        } else if (t === '^') {
          const inset = s * 0.1;
          roundRect(ctx, x * s + inset, y * s + inset, s - inset * 2, s - inset * 2, s * 0.1);
          ctx.fillStyle = alpha(p.surface, 0.7);
          ctx.fill();
          ctx.strokeStyle = alpha(p.line, 0.9);
          ctx.lineWidth = Math.max(1, s * 0.02);
          ctx.stroke();
          ctx.strokeStyle = alpha(p.lineStrong, 0.9);
          const a = x * s + inset;
          const b = y * s + inset;
          const w = s - inset * 2;
          const k = w * 0.22;
          ctx.beginPath();
          ctx.moveTo(a, b + k);
          ctx.lineTo(a, b);
          ctx.lineTo(a + k, b);
          ctx.moveTo(a + w - k, b + w);
          ctx.lineTo(a + w, b + w);
          ctx.lineTo(a + w, b + w - k);
          ctx.stroke();
        }
      }
    }

    // Lanes: a recessed channel joining the centres of neighbouring lane tiles.
    const laneLike = (x: number, y: number) => {
      const t = tile(x, y);
      return t === '=' || t === 'S' || t === 'C';
    };
    const segments: [number, number, number, number][] = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!laneLike(x, y)) continue;
        if (laneLike(x + 1, y)) segments.push([x, y, x + 1, y]);
        if (laneLike(x, y + 1)) segments.push([x, y, x, y + 1]);
        // Spawns and the core on the border open out of the board.
        if (tile(x, y) === 'S' || tile(x, y) === 'C') {
          if (x === 0) segments.push([x, y, x - 0.6, y]);
          if (x === width - 1) segments.push([x, y, x + 0.6, y]);
          if (y === 0) segments.push([x, y, x, y - 0.6]);
          if (y === height - 1) segments.push([x, y, x, y + 0.6]);
        }
      }
    }
    const strokeSegments = (width2: number, colour: string, dash: number[] = []) => {
      ctx.strokeStyle = colour;
      ctx.lineWidth = width2;
      ctx.setLineDash(dash);
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (const [x1, y1, x2, y2] of segments) {
        ctx.moveTo((x1 + 0.5) * s, (y1 + 0.5) * s);
        ctx.lineTo((x2 + 0.5) * s, (y2 + 0.5) * s);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    };
    strokeSegments(s * 0.74, p.line);
    strokeSegments(s * 0.66, p.bgDeep);
    strokeSegments(s * 0.5, alpha(p.surface, 0.8));
    strokeSegments(Math.max(1, s * 0.02), alpha(p.ion, 0.12), [s * 0.08, s * 0.16]);

    return layer;
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
      paths(game.routes(), alpha(p.ion, 0.16), Math.max(1.5, s * 0.06));
      paths(preview, alpha(p.signal, 0.75), Math.max(2, s * 0.08));
    } else {
      paths(
        game.routes(),
        alpha(p.ion, game.phase === 'build' ? 0.55 : 0.28),
        Math.max(1.5, s * 0.07),
      );
    }
  }

  private drawFields(game: Game, view: BoardView): void {
    const ctx = this.ctx;
    const s = this.cell;
    const p = this.palette;
    for (const t of game.towers) {
      if (t.kind !== 'throttle' && t.kind !== 'beacon') continue;
      const c = centre(t);
      const r = game.stat(t).range * s;
      ctx.save();
      if (t.kind === 'throttle') {
        const g = ctx.createRadialGradient(c.x * s, c.y * s, 0, c.x * s, c.y * s, r);
        g.addColorStop(0, alpha(p.ion, 0.02));
        g.addColorStop(0.85, alpha(p.ion, 0.07));
        g.addColorStop(1, alpha(p.ion, 0.12));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(c.x * s, c.y * s, r, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.strokeStyle = alpha(p.ion, 0.22);
        ctx.setLineDash([s * 0.06, s * 0.12]);
        ctx.lineWidth = Math.max(1, s * 0.025);
        ctx.beginPath();
        ctx.arc(c.x * s, c.y * s, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        // Links to the towers it boosts.
        ctx.strokeStyle = alpha(p.ion, 0.55);
        ctx.lineWidth = Math.max(1, s * 0.04);
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
        towerColour(sel.kind, p),
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
    ctx.fillStyle = alpha(colour, 0.06);
    ctx.strokeStyle = alpha(colour, 0.6);
    ctx.lineWidth = Math.max(1, s * 0.03);
    ctx.setLineDash([s * 0.1, s * 0.08]);
    ctx.beginPath();
    ctx.arc(c.x * s, c.y * s, range * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (minRange) {
      ctx.strokeStyle = alpha(this.palette.danger, 0.5);
      ctx.beginPath();
      ctx.arc(c.x * s, c.y * s, minRange * s, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawGates(game: Game, time: number): void {
    const ctx = this.ctx;
    const s = this.cell;
    const p = this.palette;
    const t = this.reducedMotion ? 0 : time;
    for (const sp of game.grid.spawns) {
      const c = centre(sp);
      glow(ctx, c.x * s, c.y * s, s * 0.9, p.danger, 0.25);
      ctx.save();
      ctx.translate(c.x * s, c.y * s);
      ctx.strokeStyle = alpha(p.danger, 0.85);
      ctx.lineWidth = Math.max(1.2, s * 0.045);
      ctx.rotate(t * 0.8);
      ctx.setLineDash([s * 0.14, s * 0.1]);
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.32, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    const core = centre(game.grid.core);
    const health = game.lives / game.maxLives;
    const beat = 0.5 + 0.5 * Math.sin(t * 2.2);
    glow(ctx, core.x * s, core.y * s, s * (1.1 + beat * 0.2), p.ion, 0.35);
    ctx.save();
    ctx.translate(core.x * s, core.y * s);
    ctx.fillStyle = p.surface;
    ctx.strokeStyle = p.ion;
    ctx.lineWidth = Math.max(1.5, s * 0.05);
    polygon(ctx, 6, s * 0.34, Math.PI / 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = alpha(p.ion, 0.5 + beat * 0.4);
    polygon(ctx, 6, s * 0.16, Math.PI / 6 + t * 0.5);
    ctx.fill();
    // Integrity ring: the share of lives left.
    ctx.strokeStyle = alpha(p.line, 0.9);
    ctx.lineWidth = Math.max(2, s * 0.06);
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.46, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = health > 0.5 ? p.ion : health > 0.25 ? p.warning : p.danger;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.46, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * health);
    ctx.stroke();
    ctx.restore();
  }

  private drawTowers(game: Game, time: number, view: BoardView): void {
    const ctx = this.ctx;
    const s = this.cell;
    const p = this.palette;
    for (const t of game.towers) {
      const c = centre(t);
      const since = this.clock - (this.fired.get(t.id) ?? -10);
      const recoil = Math.max(0, 1 - since / 0.18);
      ctx.save();
      ctx.translate(c.x * s, c.y * s);
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
        p,
      );
      if (view.selected === t.id) {
        ctx.strokeStyle = p.text;
        ctx.lineWidth = Math.max(1.5, s * 0.04);
        roundRect(ctx, -s * 0.48, -s * 0.48, s * 0.96, s * 0.96, s * 0.14);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  private drawEnemies(game: Game, lerp: number, time: number): void {
    const ctx = this.ctx;
    const s = this.cell;
    const p = this.palette;
    for (const e of game.enemies) {
      const prev = this.prev.get(e.id);
      const x = prev ? prev.x + (e.x - prev.x) * lerp : e.x;
      const y = prev ? prev.y + (e.y - prev.y) * lerp : e.y;
      const spec = ENEMIES[e.kind];
      const heading = e.next ? Math.atan2(e.next.y + 0.5 - e.y, e.next.x + 0.5 - e.x) : 0;
      const since = this.clock - (this.hits.get(e.id) ?? -10);
      ctx.save();
      ctx.translate(x * s, y * s);
      if (e.slow < 0.999) {
        ctx.strokeStyle = alpha(p.ion, 0.7);
        ctx.lineWidth = Math.max(1, s * 0.03);
        ctx.beginPath();
        ctx.arc(0, 0, spec.radius * s * 1.45, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (e.shield > 0) {
        ctx.strokeStyle = alpha(p.warning, 0.6);
        ctx.lineWidth = Math.max(1, s * 0.03);
        polygon(ctx, 6, spec.radius * s * 1.6, time);
        ctx.stroke();
      }
      drawEnemy(
        ctx,
        {
          kind: e.kind,
          r: spec.radius * s,
          heading,
          time: this.reducedMotion ? 0 : time + e.id,
          revealed: e.revealed,
          flash: Math.max(0, 1 - since / 0.08),
        },
        p,
      );
      ctx.restore();
      if (e.hp < e.maxHp && (e.revealed || !spec.cloaked)) {
        const w = Math.max(s * 0.5, spec.radius * s * 2.2);
        const bx = x * s - w / 2;
        const by = y * s - spec.radius * s - s * 0.16;
        ctx.fillStyle = alpha(p.bgDeep, 0.85);
        ctx.fillRect(bx - 1, by - 1, w + 2, Math.max(3, s * 0.07) + 2);
        const k = e.hp / e.maxHp;
        ctx.fillStyle = k > 0.5 ? p.success : k > 0.25 ? p.warning : p.danger;
        ctx.fillRect(bx, by, w * k, Math.max(3, s * 0.07));
      }
    }
  }

  private drawShots(game: Game, lerp: number): void {
    const ctx = this.ctx;
    const s = this.cell;
    const p = this.palette;
    for (const shot of game.shots) {
      const prev = this.prev.get(shot.id);
      const x = prev ? prev.x + (shot.x - prev.x) * lerp : shot.x;
      const y = prev ? prev.y + (shot.y - prev.y) * lerp : shot.y;
      if (shot.kind === 'bolt') {
        const px = prev?.x ?? shot.from.x;
        const py = prev?.y ?? shot.from.y;
        ctx.strokeStyle = alpha(p.signal, 0.6);
        ctx.lineWidth = Math.max(1.5, s * 0.06);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(px * s - (x - px) * s * 0.8, py * s - (y - py) * s * 0.8);
        ctx.lineTo(x * s, y * s);
        ctx.stroke();
        glow(ctx, x * s, y * s, s * 0.22, p.signal, 0.7);
        ctx.fillStyle = p.text;
        ctx.beginPath();
        ctx.arc(x * s, y * s, Math.max(1.2, s * 0.045), 0, Math.PI * 2);
        ctx.fill();
      } else {
        const k = Math.min(1, (shot.age + lerp * DT) / shot.flight);
        const lift = Math.sin(Math.PI * k) * s * 0.9;
        // Landing marker and shadow.
        ctx.strokeStyle = alpha(p.signal, 0.35 + 0.4 * k);
        ctx.lineWidth = Math.max(1, s * 0.03);
        ctx.beginPath();
        ctx.arc(shot.to.x * s, shot.to.y * s, shot.splash * s * (1.2 - 0.2 * k), 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = alpha(p.bgDeep, 0.6);
        ctx.beginPath();
        ctx.ellipse(x * s, y * s, s * 0.1, s * 0.05, 0, 0, Math.PI * 2);
        ctx.fill();
        glow(ctx, x * s, y * s - lift, s * 0.3, p.signal, 0.6);
        ctx.fillStyle = p.signalSoft;
        ctx.beginPath();
        ctx.arc(x * s, y * s - lift, Math.max(1.5, s * 0.08), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private drawCursor(time: number, view: BoardView): void {
    const cell = view.hover;
    if (!cell) return;
    const ctx = this.ctx;
    const s = this.cell;
    const p = this.palette;
    const ghost = view.ghost;
    if (ghost) {
      const colour = ghost.valid ? towerColour(ghost.kind, p) : p.danger;
      if (ghost.kind !== 'wall')
        this.rangeRing(
          centre(cell),
          TOWERS[ghost.kind].levels[0].range,
          TOWERS[ghost.kind].minRange,
          colour,
        );
      ctx.save();
      ctx.globalAlpha = ghost.valid ? 0.75 : 0.35;
      ctx.translate((cell.x + 0.5) * s, (cell.y + 0.5) * s);
      drawTower(
        ctx,
        {
          kind: ghost.kind,
          level: 0,
          angle: -Math.PI / 2,
          time: this.reducedMotion ? 0 : time,
          recoil: 0,
        },
        s,
        p,
      );
      ctx.restore();
    }
    const colour = ghost
      ? ghost.valid
        ? p.signal
        : p.danger
      : view.cursor
        ? p.signal
        : alpha(p.text, 0.5);
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

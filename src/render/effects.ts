// Short-lived visual effects driven by the simulation's events: beams, chain discharges, blasts,
// particles and floating credit numbers. Positions are in cell units; `draw` scales by the cell
// size. Effects age in game seconds, so they keep pace with the speed setting and stop on pause.
import type { GameEvent } from '../engine/game';
import type { Point } from '../engine/types';
import { alpha, type Palette } from './palette';
import { ENEMY_ART, TOWER_ART } from './art';
import { glow } from './sprites';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  colour: string;
}

type Fx =
  | { kind: 'beam'; from: Point; to: Point; age: number; life: number }
  | { kind: 'arc'; points: Point[]; age: number; life: number; seed: number }
  | { kind: 'blast'; at: Point; radius: number; age: number; life: number }
  | { kind: 'ring'; at: Point; radius: number; colour: string; age: number; life: number }
  | {
      kind: 'text';
      at: Point;
      text: string;
      /** Credits shown, for adding up kills that land close together. */
      value?: number;
      colour: string;
      age: number;
      life: number;
    };

const MAX_PARTICLES = 600;
/** Earth thrown up by an Ent's boulder. */
const DUST = '#b08a5a';

export class Effects {
  private particles: Particle[] = [];
  private fx: Fx[] = [];
  /** Screen shake strength in cells; decays over time. */
  shake = 0;
  /** Red vignette after a leak, 0..1. */
  alarm = 0;

  constructor(
    private palette: Palette,
    private reducedMotion: boolean,
  ) {}

  clear(): void {
    this.particles = [];
    this.fx = [];
    this.shake = 0;
    this.alarm = 0;
  }

  private burst(
    at: Point,
    colour: string,
    count: number,
    speed: number,
    size: number,
    life = 0.5,
  ): void {
    const n = this.reducedMotion ? Math.ceil(count / 3) : count;
    for (let i = 0; i < n && this.particles.length < MAX_PARTICLES; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.35 + Math.random() * 0.65);
      this.particles.push({
        x: at.x,
        y: at.y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        age: 0,
        life: life * (0.6 + Math.random() * 0.4),
        size: size * (0.6 + Math.random() * 0.6),
        colour,
      });
    }
  }

  /** Floating credits; kills close together in space and time add up into one number. */
  private credit(at: Point, value: number): void {
    for (const f of this.fx) {
      if (f.kind !== 'text' || f.value === undefined || f.age > 0.25) continue;
      if (Math.hypot(f.at.x - at.x, f.at.y - at.y) > 1.2) continue;
      f.value += value;
      f.text = `+${f.value}`;
      return;
    }
    const colour = this.palette.signal;
    this.fx.push({ kind: 'text', at, text: `+${value}`, value, colour, age: 0, life: 0.9 });
  }

  handle(events: GameEvent[]): void {
    const p = this.palette;
    for (const e of events) {
      switch (e.type) {
        case 'beam':
          this.fx.push({ kind: 'beam', from: e.from, to: e.to, age: 0, life: 0.3 });
          for (const h of e.hits) this.burst(h, TOWER_ART.lance.colour, 6, 2.5, 0.05, 0.35);
          break;
        case 'arc':
          this.fx.push({
            kind: 'arc',
            points: e.points,
            age: 0,
            life: 0.22,
            seed: Math.random() * 1000,
          });
          break;
        case 'blast':
          this.fx.push({ kind: 'blast', at: e.at, radius: e.radius, age: 0, life: 0.4 });
          this.burst(e.at, DUST, 14, 3, 0.06, 0.45);
          this.shake = Math.max(this.shake, 0.03);
          break;
        case 'hit':
          this.burst(e.at, p.text, 2, 1.6, 0.035, 0.25);
          break;
        case 'kill':
          this.burst(
            e.at,
            ENEMY_ART[e.kind].colour,
            e.kind === 'colossus' ? 60 : 14,
            e.kind === 'colossus' ? 4 : 2.6,
            0.06,
            0.6,
          );
          this.fx.push({
            kind: 'ring',
            at: e.at,
            radius: e.kind === 'colossus' ? 1.6 : 0.5,
            colour: ENEMY_ART[e.kind].colour,
            age: 0,
            life: 0.35,
          });
          this.credit(e.at, e.bounty);
          if (e.kind === 'colossus') this.shake = Math.max(this.shake, 0.15);
          break;
        case 'leak':
          this.burst(e.at, p.danger, 20, 3, 0.07, 0.6);
          this.shake = Math.max(this.shake, 0.08 + 0.02 * e.lives);
          this.alarm = 1;
          break;
        case 'split':
          this.fx.push({
            kind: 'ring',
            at: e.at,
            radius: 0.7,
            colour: p.danger,
            age: 0,
            life: 0.3,
          });
          break;
        case 'build':
          this.fx.push({
            kind: 'ring',
            at: { x: e.at.x + 0.5, y: e.at.y + 0.5 },
            radius: 0.8,
            colour: p.success,
            age: 0,
            life: 0.4,
          });
          break;
        case 'upgrade':
          this.fx.push({
            kind: 'ring',
            at: { x: e.at.x + 0.5, y: e.at.y + 0.5 },
            radius: 0.9,
            colour: p.signalSoft,
            age: 0,
            life: 0.5,
          });
          this.burst({ x: e.at.x + 0.5, y: e.at.y + 0.5 }, p.signalSoft, 12, 1.5, 0.05, 0.5);
          break;
        case 'sell':
          this.burst({ x: e.at.x + 0.5, y: e.at.y + 0.5 }, p.muted, 10, 1.2, 0.05, 0.4);
          this.fx.push({
            kind: 'text',
            at: { x: e.at.x + 0.5, y: e.at.y + 0.5 },
            text: `+${e.refund}`,
            colour: p.signal,
            age: 0,
            life: 0.9,
          });
          break;
        case 'waveClear':
          if (e.bonus > 0)
            this.fx.push({
              kind: 'text',
              at: { x: 8, y: 1 },
              text: `+${e.bonus}`,
              colour: p.signal,
              age: -0.2,
              life: 1.4,
            });
          break;
        default:
          break;
      }
    }
  }

  update(dt: number): void {
    for (const q of this.particles) {
      q.age += dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.vx *= 0.9;
      q.vy *= 0.9;
    }
    this.particles = this.particles.filter((q) => q.age < q.life);
    for (const f of this.fx) f.age += dt;
    this.fx = this.fx.filter((f) => f.age < f.life);
    this.shake = Math.max(0, this.shake - dt * 0.6);
    this.alarm = Math.max(0, this.alarm - dt * 1.8);
  }

  draw(ctx: CanvasRenderingContext2D, s: number): void {
    const p = this.palette;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const f of this.fx) {
      if (f.age < 0) continue;
      const k = 1 - f.age / f.life;
      switch (f.kind) {
        case 'beam': {
          ctx.strokeStyle = alpha(TOWER_ART.lance.colour, 0.45 * k);
          ctx.lineWidth = s * 0.32 * k;
          ctx.beginPath();
          ctx.moveTo(f.from.x * s, f.from.y * s);
          ctx.lineTo(f.to.x * s, f.to.y * s);
          ctx.stroke();
          ctx.strokeStyle = alpha(p.text, 0.9 * k);
          ctx.lineWidth = Math.max(1, s * 0.06 * k);
          ctx.stroke();
          break;
        }
        case 'arc': {
          let seed = f.seed + Math.floor(f.age * 40);
          const rand = () => {
            seed = (seed * 9301 + 49297) % 233280;
            return seed / 233280 - 0.5;
          };
          for (const [w, col] of [
            [0.12, alpha(TOWER_ART.arc.colour, 0.55 * k)],
            [0.035, alpha(p.text, 0.95 * k)],
          ] as const) {
            ctx.strokeStyle = col;
            ctx.lineWidth = Math.max(1, s * w);
            ctx.beginPath();
            let prev: Point | null = null;
            for (const pt of f.points) {
              if (!prev) {
                ctx.moveTo(pt.x * s, pt.y * s);
                prev = pt;
                continue;
              }
              for (let j = 1; j <= 4; j++) {
                const t = j / 4;
                const jitter = j === 4 ? 0 : 0.18;
                ctx.lineTo(
                  (prev.x + (pt.x - prev.x) * t + rand() * jitter) * s,
                  (prev.y + (pt.y - prev.y) * t + rand() * jitter) * s,
                );
              }
              prev = pt;
            }
            ctx.stroke();
          }
          break;
        }
        case 'blast': {
          const r = f.radius * s * (0.4 + 0.6 * (1 - k * k));
          glow(ctx, f.at.x * s, f.at.y * s, r * 1.2, DUST, 0.55 * k);
          ctx.strokeStyle = alpha(TOWER_ART.mortar.colour, 0.8 * k);
          ctx.lineWidth = Math.max(1, s * 0.05 * k);
          ctx.beginPath();
          ctx.arc(f.at.x * s, f.at.y * s, r, 0, Math.PI * 2);
          ctx.stroke();
          break;
        }
        case 'ring': {
          ctx.strokeStyle = alpha(f.colour, 0.8 * k);
          ctx.lineWidth = Math.max(1, s * 0.04);
          ctx.beginPath();
          ctx.arc(f.at.x * s, f.at.y * s, f.radius * s * (1.15 - k * 0.6), 0, Math.PI * 2);
          ctx.stroke();
          break;
        }
        case 'text':
          break;
      }
    }
    for (const q of this.particles) {
      const k = 1 - q.age / q.life;
      ctx.fillStyle = alpha(q.colour, k);
      ctx.beginPath();
      ctx.arc(q.x * s, q.y * s, Math.max(0.6, q.size * s * k), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `600 ${Math.round(s * 0.3)}px 'JetBrains Mono', ui-monospace, monospace`;
    for (const f of this.fx) {
      if (f.kind !== 'text' || f.age < 0) continue;
      const k = 1 - f.age / f.life;
      const ty = (f.at.y - 0.35 - (1 - k) * 0.6) * s;
      ctx.strokeStyle = alpha(p.bgDeep, Math.min(1, k * 1.6) * 0.9);
      ctx.lineWidth = Math.max(2, s * 0.08);
      ctx.lineJoin = 'round';
      ctx.strokeText(f.text, f.at.x * s, ty);
      ctx.fillStyle = alpha(f.colour, Math.min(1, k * 1.6));
      ctx.fillText(f.text, f.at.x * s, ty);
    }
    ctx.restore();
  }
}

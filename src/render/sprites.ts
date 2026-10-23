// Vector drawings of towers and enemies, drawn around the origin at a given cell size. The board
// and the UI icons both use them, so a tower looks the same on the map and in the build palette.
import type { EnemyKind, TowerKind } from '../engine/types';
import { alpha, type Palette } from './palette';

type Ctx = CanvasRenderingContext2D;

export function glow(ctx: Ctx, x: number, y: number, r: number, color: string, a: number): void {
  if (r <= 0 || a <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, alpha(color, a));
  g.addColorStop(0.45, alpha(color, a * 0.35));
  g.addColorStop(1, alpha(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function polygon(ctx: Ctx, sides: number, r: number, rotation = 0): void {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = rotation + (i / sides) * Math.PI * 2;
    if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
}

export function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Colour family of a tower: Signal for damage, Ion for support. */
function towerColour(kind: TowerKind, p: Palette): string {
  if (kind === 'throttle' || kind === 'beacon') return p.ion;
  if (kind === 'wall') return p.lineStrong;
  return p.signal;
}

function enemyColour(kind: EnemyKind, p: Palette): string {
  switch (kind) {
    case 'bulwark':
      return p.warning;
    case 'phantom':
      return p.muted;
    case 'mender':
      return p.success;
    default:
      return p.danger;
  }
}

export interface TowerLook {
  kind: TowerKind;
  level: number;
  /** Turret heading (radians). */
  angle: number;
  /** Seconds, for idle animation. */
  time: number;
  /** 0..1 right after firing, for recoil and muzzle flash. */
  recoil: number;
}

/** Draws a tower centred on the origin; `s` is the cell size in pixels. */
export function drawTower(ctx: Ctx, t: TowerLook, s: number, p: Palette): void {
  const c = towerColour(t.kind, p);
  const half = s * 0.42;
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  if (t.kind === 'wall') {
    roundRect(ctx, -half, -half, half * 2, half * 2, s * 0.08);
    const g = ctx.createLinearGradient(0, -half, 0, half);
    g.addColorStop(0, p.raised);
    g.addColorStop(1, p.surface);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = p.lineStrong;
    ctx.lineWidth = Math.max(1, s * 0.03);
    ctx.stroke();
    ctx.strokeStyle = alpha(p.muted, 0.18);
    ctx.lineWidth = Math.max(1, s * 0.025);
    ctx.beginPath();
    for (const k of [-0.5, 0, 0.5]) {
      ctx.moveTo(-half * 0.7, k * half);
      ctx.lineTo(half * 0.7, k * half);
    }
    ctx.stroke();
    ctx.restore();
    return;
  }

  // Base plate
  roundRect(ctx, -half, -half, half * 2, half * 2, s * 0.12);
  ctx.fillStyle = p.raised;
  ctx.fill();
  ctx.strokeStyle = alpha(c, 0.35);
  ctx.lineWidth = Math.max(1, s * 0.025);
  ctx.stroke();
  // Corner brackets: a socketed agent
  ctx.strokeStyle = alpha(c, 0.7);
  ctx.lineWidth = Math.max(1, s * 0.03);
  const b = half * 0.35;
  ctx.beginPath();
  for (const [sx, sy] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ] as const) {
    ctx.moveTo(sx * half, sy * (half - b));
    ctx.lineTo(sx * half, sy * half);
    ctx.lineTo(sx * (half - b), sy * half);
  }
  ctx.stroke();

  // Level pips
  for (let i = 0; i <= t.level; i++) {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc((i - t.level / 2) * s * 0.12, half - s * 0.07, s * 0.03, 0, Math.PI * 2);
    ctx.fill();
  }

  glow(ctx, 0, 0, s * (0.55 + t.recoil * 0.25), c, 0.18 + t.recoil * 0.25);
  const lw = Math.max(1.2, s * 0.045);
  ctx.lineWidth = lw;
  ctx.strokeStyle = c;
  ctx.fillStyle = p.surface;

  switch (t.kind) {
    case 'pulse': {
      ctx.rotate(t.angle);
      const back = t.recoil * s * 0.06;
      ctx.fillStyle = c;
      roundRect(ctx, -back, -s * 0.045, s * 0.36, s * 0.09, s * 0.03);
      ctx.fill();
      ctx.fillStyle = p.surface;
      ctx.beginPath();
      ctx.arc(-back * 0.5, 0, s * 0.19, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = t.recoil > 0.4 ? p.text : p.signalSoft;
      ctx.beginPath();
      ctx.arc(-back * 0.5, 0, s * 0.07, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'arc': {
      for (const [r, a] of [
        [0.24, 0.35],
        [0.16, 0.7],
        [0.08, 1],
      ] as const) {
        ctx.strokeStyle = alpha(c, a);
        ctx.beginPath();
        ctx.arc(0, 0, s * r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = p.text;
      for (let i = 0; i < 3; i++) {
        const a = t.time * 2.4 + (i * Math.PI * 2) / 3;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * s * 0.24, Math.sin(a) * s * 0.24, s * 0.03, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'lance': {
      ctx.rotate(t.angle);
      const back = t.recoil * s * 0.1;
      ctx.beginPath();
      ctx.moveTo(s * 0.42 - back, 0);
      ctx.lineTo(s * 0.06 - back, -s * 0.1);
      ctx.lineTo(-s * 0.24 - back, -s * 0.07);
      ctx.lineTo(-s * 0.24 - back, s * 0.07);
      ctx.lineTo(s * 0.06 - back, s * 0.1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = p.signalSoft;
      ctx.lineWidth = lw * 0.6;
      ctx.beginPath();
      ctx.moveTo(-s * 0.16 - back, 0);
      ctx.lineTo(s * 0.34 - back, 0);
      ctx.stroke();
      break;
    }
    case 'mortar': {
      ctx.rotate(t.angle);
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = lw * 1.3;
      ctx.stroke();
      ctx.lineWidth = lw * 0.8;
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2 + Math.PI / 4;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * s * 0.25, Math.sin(a) * s * 0.25);
        ctx.lineTo(Math.cos(a) * s * 0.33, Math.sin(a) * s * 0.33);
        ctx.stroke();
      }
      const mouth = s * (0.11 + t.recoil * 0.03);
      ctx.fillStyle = p.bgDeep;
      ctx.beginPath();
      ctx.arc(s * 0.04, 0, mouth, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'throttle': {
      polygon(ctx, 6, s * 0.2, Math.PI / 6);
      ctx.fill();
      ctx.stroke();
      ctx.lineWidth = lw * 0.9;
      for (let i = 0; i < 3; i++) {
        const a = -t.time * 0.9 + (i * Math.PI * 2) / 3;
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.31, a, a + 1.1);
        ctx.stroke();
      }
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.06, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'beacon': {
      const sweep = t.time * 2.2;
      const g = ctx.createConicGradient ? ctx.createConicGradient(sweep, 0, 0) : null;
      if (g) {
        g.addColorStop(0, alpha(c, 0.45));
        g.addColorStop(0.18, alpha(c, 0));
        g.addColorStop(1, alpha(c, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.34, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = p.surface;
      polygon(ctx, 4, s * 0.2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.06, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
  }
  ctx.restore();
}

export interface EnemyLook {
  kind: EnemyKind;
  /** Body radius in pixels. */
  r: number;
  /** Walking heading (radians). */
  heading: number;
  time: number;
  revealed: boolean;
  /** 0..1 just after a hit. */
  flash: number;
}

export function drawEnemy(ctx: Ctx, e: EnemyLook, p: Palette): void {
  const c = enemyColour(e.kind, p);
  const r = e.r;
  ctx.save();
  ctx.lineJoin = 'round';
  const lw = Math.max(1.2, r * 0.22);
  ctx.lineWidth = lw;
  const hot = e.flash > 0 ? p.text : c;

  if (e.kind === 'phantom') {
    const flicker = e.revealed ? 1 : 0.35 + 0.15 * Math.sin(e.time * 9);
    ctx.globalAlpha = flicker;
    glow(ctx, 0, 0, r * 2.4, e.revealed ? p.ion : c, 0.25);
    ctx.setLineDash([r * 0.45, r * 0.35]);
    ctx.strokeStyle = e.revealed ? p.ion : c;
    ctx.fillStyle = alpha(e.revealed ? p.ion : c, 0.12);
    ctx.rotate(e.time * 1.5);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = e.revealed ? p.text : c;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  glow(ctx, 0, 0, r * 2.6, c, 0.3 + e.flash * 0.3);
  ctx.strokeStyle = hot;
  ctx.fillStyle = alpha(c, 0.2);

  switch (e.kind) {
    case 'spark':
      ctx.rotate(e.heading);
      polygon(ctx, 4, r);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = hot;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'mite':
      ctx.rotate(e.heading);
      polygon(ctx, 3, r * 1.15);
      ctx.fillStyle = alpha(c, 0.55);
      ctx.fill();
      ctx.stroke();
      break;
    case 'bulwark':
      ctx.rotate(e.heading);
      polygon(ctx, 6, r);
      ctx.fill();
      ctx.lineWidth = lw * 1.3;
      ctx.stroke();
      ctx.lineWidth = lw * 0.7;
      polygon(ctx, 6, r * 0.6);
      ctx.stroke();
      ctx.fillStyle = hot;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.18, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'splitter': {
      ctx.rotate(e.time * 2);
      ctx.lineWidth = lw * 0.8;
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI * 2) / 3;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, r * 0.45, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.fillStyle = hot;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.2, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'mender': {
      const pulse = (e.time * 0.8) % 1;
      ctx.strokeStyle = alpha(c, 0.35 * (1 - pulse));
      ctx.lineWidth = Math.max(1, lw * 0.6);
      ctx.beginPath();
      ctx.arc(0, 0, r * (1.2 + pulse * 3.5), 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = hot;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.lineWidth = lw * 1.2;
      ctx.beginPath();
      ctx.moveTo(-r * 0.5, 0);
      ctx.lineTo(r * 0.5, 0);
      ctx.moveTo(0, -r * 0.5);
      ctx.lineTo(0, r * 0.5);
      ctx.stroke();
      break;
    }
    case 'colossus': {
      ctx.save();
      ctx.rotate(e.time * 0.6);
      ctx.strokeStyle = alpha(p.warning, 0.75);
      ctx.lineWidth = lw * 0.7;
      ctx.setLineDash([r * 0.3, r * 0.22]);
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      ctx.rotate(e.heading);
      polygon(ctx, 8, r, Math.PI / 8);
      ctx.fill();
      ctx.lineWidth = lw * 1.2;
      ctx.stroke();
      polygon(ctx, 8, r * 0.62, Math.PI / 8);
      ctx.lineWidth = lw * 0.7;
      ctx.stroke();
      ctx.fillStyle = hot;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
  }
  ctx.restore();
}

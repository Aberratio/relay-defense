// The board's ground, painted once into the background layer: a meadow where agents may stand,
// stone circles on the sockets, dirt paths along the lanes and dark rock everywhere else. These
// colours belong to the game world only; the interface around the board keeps the brand palette.
import { tileAt, type Grid } from '../engine/grid';
import type { Cell } from '../engine/types';

const TERRAIN = {
  forest: '#141d10',
  rock: '#26262c',
  rockLight: '#33333a',
  rockMoss: '#2a3024',
  grass: '#3e6a2d',
  grassLight: '#416f2f',
  grassDark: '#3b662b',
  tuft: '#2d5121',
  flowers: ['#f2e3a0', '#f5f0f5', '#e7a6d8'],
  grid: 'rgba(10, 20, 8, 0.16)',
  stone: '#6d6c72',
  stoneDark: '#3c3b42',
  moss: '#4f7d3b',
  pathEdge: '#3f2d1b',
  path: '#7a5a36',
  pathLight: '#8d6c45',
  pebble: '#a58b65',
  crack: '#21160c',
  fog: 'rgba(214, 222, 232, 0.2)',
  fogLater: 'rgba(214, 222, 232, 0.07)',
  fogEdge: 'rgba(214, 222, 232, 0)',
} as const;

/** A repeatable pseudo-random number in [0, 1) for a tile and a salt. */
function hash(x: number, y: number, salt = 0): number {
  let h = (x * 374761393 + y * 668265263 + salt * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function paintTerrain(ctx: CanvasRenderingContext2D, grid: Grid, s: number): void {
  const { width, height } = grid;
  const tile = (x: number, y: number) => tileAt(grid, x, y);
  ctx.fillStyle = TERRAIN.forest;
  ctx.fillRect(0, 0, width * s, height * s);

  // Rock: stone with moss patches and a lit rim where it meets open ground.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (tile(x, y) !== '#') continue;
      ctx.fillStyle = TERRAIN.rock;
      ctx.fillRect(x * s, y * s, s + 0.5, s + 0.5);
      for (let k = 0; k < 3; k++) {
        if (hash(x, y, k) < 0.55) continue;
        ctx.fillStyle = hash(x, y, k + 9) < 0.5 ? TERRAIN.rockMoss : TERRAIN.rockLight;
        ctx.beginPath();
        ctx.ellipse(
          (x + 0.2 + hash(x, y, k + 3) * 0.6) * s,
          (y + 0.2 + hash(x, y, k + 5) * 0.6) * s,
          s * (0.08 + hash(x, y, k + 7) * 0.12),
          s * (0.05 + hash(x, y, k + 8) * 0.08),
          0,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }
  }
  ctx.strokeStyle = TERRAIN.rockLight;
  ctx.lineWidth = Math.max(1, s * 0.05);
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (tile(x, y) !== '#') continue;
      if (y < height - 1 && tile(x, y + 1) !== '#') {
        ctx.moveTo(x * s, (y + 1) * s);
        ctx.lineTo((x + 1) * s, (y + 1) * s);
      }
    }
  }
  ctx.stroke();

  // Meadow on every open tile.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (tile(x, y) === '#') continue;
      const v = hash(x, y, 1);
      ctx.fillStyle = v < 0.3 ? TERRAIN.grassDark : v > 0.75 ? TERRAIN.grassLight : TERRAIN.grass;
      ctx.fillRect(x * s, y * s, s + 0.5, s + 0.5);
    }
  }
  ctx.strokeStyle = TERRAIN.tuft;
  ctx.lineWidth = Math.max(1, s * 0.025);
  ctx.beginPath();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (tile(x, y) === '#') continue;
      for (let k = 0; k < 4; k++) {
        const tx = (x + 0.1 + hash(x, y, 20 + k) * 0.8) * s;
        const ty = (y + 0.15 + hash(x, y, 30 + k) * 0.8) * s;
        const h = s * 0.09;
        ctx.moveTo(tx - h * 0.4, ty);
        ctx.lineTo(tx - h * 0.6, ty - h);
        ctx.moveTo(tx, ty);
        ctx.lineTo(tx, ty - h * 1.2);
        ctx.moveTo(tx + h * 0.4, ty);
        ctx.lineTo(tx + h * 0.6, ty - h);
      }
    }
  }
  ctx.stroke();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (tile(x, y) !== '.' || hash(x, y, 40) < 0.7) continue;
      ctx.fillStyle =
        TERRAIN.flowers[Math.floor(hash(x, y, 41) * TERRAIN.flowers.length)] ?? TERRAIN.tuft;
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.arc(
          (x + 0.2 + hash(x, y, 42 + k) * 0.6) * s,
          (y + 0.2 + hash(x, y, 45 + k) * 0.6) * s,
          Math.max(0.8, s * 0.025),
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }
  }

  // A faint grid on the open floor, so placement stays readable.
  ctx.strokeStyle = TERRAIN.grid;
  ctx.lineWidth = Math.max(1, s * 0.015);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (tile(x, y) !== '.') continue;
      ctx.strokeRect(x * s + 0.5, y * s + 0.5, s - 1, s - 1);
    }
  }

  // Sockets: a mossy stone circle.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (tile(x, y) !== '^') continue;
      const cx = (x + 0.5) * s;
      const cy = (y + 0.5) * s;
      ctx.fillStyle = TERRAIN.moss;
      ctx.beginPath();
      ctx.ellipse(cx, cy, s * 0.38, s * 0.34, 0, 0, Math.PI * 2);
      ctx.fill();
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + hash(x, y, 50) * 0.5;
        const sx = cx + Math.cos(a) * s * 0.38;
        const sy = cy + Math.sin(a) * s * 0.34;
        const r = s * (0.05 + hash(x, y, 51 + k) * 0.025);
        ctx.fillStyle = TERRAIN.stoneDark;
        ctx.beginPath();
        ctx.ellipse(sx, sy + r * 0.35, r * 1.1, r * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = TERRAIN.stone;
        ctx.beginPath();
        ctx.ellipse(sx, sy, r, r * 0.75, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Lanes: a dirt path joining the centres of neighbouring lane tiles.
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
      if (tile(x, y) === 'S' || tile(x, y) === 'C') {
        if (x === 0) segments.push([x, y, x - 0.6, y]);
        if (x === width - 1) segments.push([x, y, x + 0.6, y]);
        if (y === 0) segments.push([x, y, x, y - 0.6]);
        if (y === height - 1) segments.push([x, y, x, y + 0.6]);
      }
    }
  }
  const stroke = (w: number, colour: string) => {
    ctx.strokeStyle = colour;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (const [x1, y1, x2, y2] of segments) {
      ctx.moveTo((x1 + 0.5) * s, (y1 + 0.5) * s);
      ctx.lineTo((x2 + 0.5) * s, (y2 + 0.5) * s);
    }
    ctx.stroke();
  };
  stroke(s * 0.86, TERRAIN.pathEdge);
  stroke(s * 0.74, TERRAIN.path);
  stroke(s * 0.5, TERRAIN.pathLight);
  ctx.fillStyle = TERRAIN.pebble;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (tile(x, y) !== '=') continue;
      for (let k = 0; k < 3; k++) {
        if (hash(x, y, 60 + k) < 0.4) continue;
        ctx.beginPath();
        ctx.ellipse(
          (x + 0.2 + hash(x, y, 63 + k) * 0.6) * s,
          (y + 0.2 + hash(x, y, 66 + k) * 0.6) * s,
          s * 0.03,
          s * 0.022,
          0,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }
  }
}

/**
 * Siege marks on the ground: lanes that will collapse (a cracked dirt crossing) and the fog (a
 * pale mist over its tiles). Painted into the background layer after the terrain.
 */
export function paintHazards(
  ctx: CanvasRenderingContext2D,
  s: number,
  hazards: { cracked: Cell[]; fog: Cell[]; fogLater: Cell[] },
): void {
  for (const { x, y } of hazards.cracked) {
    const cx = (x + 0.5) * s;
    const cy = (y + 0.5) * s;
    ctx.fillStyle = TERRAIN.pathEdge;
    ctx.fillRect(x * s, y * s + s * 0.07, s, s * 0.86);
    ctx.fillStyle = TERRAIN.path;
    ctx.fillRect(x * s, y * s + s * 0.13, s, s * 0.74);
    // Cracks: a jagged line across the crossing and two branches.
    ctx.strokeStyle = TERRAIN.crack;
    ctx.lineWidth = Math.max(1.2, s * 0.045);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.32, cy - s * 0.3);
    ctx.lineTo(cx - s * 0.1, cy - s * 0.08);
    ctx.lineTo(cx - s * 0.16, cy + s * 0.1);
    ctx.lineTo(cx + s * 0.08, cy + s * 0.22);
    ctx.lineTo(cx + s * 0.3, cy + s * 0.34);
    ctx.moveTo(cx - s * 0.1, cy - s * 0.08);
    ctx.lineTo(cx + s * 0.2, cy - s * 0.18);
    ctx.moveTo(cx - s * 0.16, cy + s * 0.1);
    ctx.lineTo(cx - s * 0.36, cy + s * 0.2);
    ctx.stroke();
    ctx.fillStyle = TERRAIN.rockLight;
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      ctx.ellipse(
        (x + 0.15 + hash(x, y, 70 + k) * 0.7) * s,
        (y + 0.2 + hash(x, y, 74 + k) * 0.6) * s,
        s * 0.05,
        s * 0.035,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }
  // Fog: soft overlapping puffs, so the patch reads as one bank of mist, not as tiles. Fog still
  // to come is a faint haze of the same shape.
  const banks: [Cell[], string][] = [
    [hazards.fog, TERRAIN.fog],
    [hazards.fogLater, TERRAIN.fogLater],
  ];
  for (const [cells, colour] of banks)
    for (const { x, y } of cells) {
      for (let k = 0; k < 3; k++) {
        const px = (x + 0.15 + hash(x, y, 80 + k) * 0.7) * s;
        const py = (y + 0.15 + hash(x, y, 83 + k) * 0.7) * s;
        const r = s * (0.55 + hash(x, y, 86 + k) * 0.25);
        const g = ctx.createRadialGradient(px, py, 0, px, py, r);
        g.addColorStop(0, colour);
        g.addColorStop(1, TERRAIN.fogEdge);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
}

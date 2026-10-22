import type { Cell, TileChar } from './types';

export const UNREACHABLE = Number.POSITIVE_INFINITY;

/** The four walking directions, in the fixed order used to break ties. */
export const DIRS: readonly Cell[] = [
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 0, y: -1 },
];

export interface Grid {
  width: number;
  height: number;
  tiles: TileChar[];
  spawns: Cell[];
  core: Cell;
}

const TILE_CHARS = new Set<string>(['.', '#', '=', '^', 'S', 'C']);

export function parseMap(rows: string[]): Grid {
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  if (height === 0 || width === 0) throw new Error('empty map');
  const tiles: TileChar[] = [];
  const spawns: Cell[] = [];
  let core: Cell | null = null;
  rows.forEach((row, y) => {
    if (row.length !== width) throw new Error(`map row ${y} has ${row.length} tiles, not ${width}`);
    [...row].forEach((ch, x) => {
      if (!TILE_CHARS.has(ch)) throw new Error(`unknown tile "${ch}" at ${x},${y}`);
      if (ch === 'S') spawns.push({ x, y });
      if (ch === 'C') {
        if (core) throw new Error('a map has exactly one core');
        core = { x, y };
      }
      tiles.push(ch as TileChar);
    });
  });
  if (!core) throw new Error('map has no core');
  if (spawns.length === 0) throw new Error('map has no spawn');
  return { width, height, tiles, spawns, core };
}

export function inBounds(grid: Grid, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < grid.width && y < grid.height;
}

export function index(grid: Grid, x: number, y: number): number {
  return y * grid.width + x;
}

export function tileAt(grid: Grid, x: number, y: number): TileChar {
  return inBounds(grid, x, y) ? (grid.tiles[index(grid, x, y)] ?? '#') : '#';
}

export function isWalkableTile(tile: TileChar): boolean {
  return tile === '.' || tile === '=' || tile === 'S' || tile === 'C';
}

export function isBuildableTile(tile: TileChar): boolean {
  return tile === '.' || tile === '^';
}

/**
 * Walking distance (in steps) from every cell to the core, by breadth-first search over walkable
 * tiles that no tower stands on. `blocked[i]` marks cells taken by towers.
 */
export function flowField(grid: Grid, blocked: ArrayLike<boolean>): Float64Array {
  const dist = new Float64Array(grid.width * grid.height).fill(UNREACHABLE);
  const start = index(grid, grid.core.x, grid.core.y);
  dist[start] = 0;
  const queue: number[] = [start];
  for (const i of queue) {
    const x = i % grid.width;
    const y = (i - x) / grid.width;
    const d = (dist[i] ?? UNREACHABLE) + 1;
    for (const dir of DIRS) {
      const nx = x + dir.x;
      const ny = y + dir.y;
      if (!inBounds(grid, nx, ny)) continue;
      const j = index(grid, nx, ny);
      if (dist[j] !== UNREACHABLE || blocked[j] || !isWalkableTile(grid.tiles[j] ?? '#')) continue;
      dist[j] = d;
      queue.push(j);
    }
  }
  return dist;
}

/**
 * The next cell on the way to the core. Among the neighbours one step closer, keeps the current
 * heading when it can (straighter routes), else takes the first in `DIRS` order.
 */
export function nextStep(
  grid: Grid,
  dist: ArrayLike<number>,
  cell: Cell,
  heading: Cell | null,
): Cell | null {
  const here = dist[index(grid, cell.x, cell.y)] ?? UNREACHABLE;
  if (here === 0 || here === UNREACHABLE) return null;
  const closer = (dir: Cell) => {
    const nx = cell.x + dir.x;
    const ny = cell.y + dir.y;
    return inBounds(grid, nx, ny) && dist[index(grid, nx, ny)] === here - 1;
  };
  if (heading && closer(heading)) return { x: cell.x + heading.x, y: cell.y + heading.y };
  for (const dir of DIRS) if (closer(dir)) return { x: cell.x + dir.x, y: cell.y + dir.y };
  return null;
}

/** The full route from a cell to the core (both included), or null when there is none. */
export function route(grid: Grid, dist: ArrayLike<number>, from: Cell): Cell[] | null {
  if ((dist[index(grid, from.x, from.y)] ?? UNREACHABLE) === UNREACHABLE) return null;
  const cells: Cell[] = [from];
  let cell = from;
  let heading: Cell | null = null;
  for (;;) {
    const next = nextStep(grid, dist, cell, heading);
    if (!next) return cells;
    heading = { x: next.x - cell.x, y: next.y - cell.y };
    cells.push(next);
    cell = next;
  }
}

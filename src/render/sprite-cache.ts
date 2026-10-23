// Loads the pre-rendered sprites and keeps a copy of each scaled to the pixel size it is drawn
// at, so the board blits small bitmaps instead of resampling 256 px images every frame.
//
// Every sprite is a square orthographic frame of FRAME model units, from a camera ELEVATION
// degrees above the ground aimed TARGET_Z units up (art/sprites.json, kept in step by a test).
// The ground point under a character therefore sits GROUND of the image below its centre.
const urls = import.meta.glob('../assets/sprites/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

/** Camera height above the ground, in degrees. */
export const ELEVATION = 35;
/** Width of the rendered frame in model units. */
export const FRAME = 1.45;
/** Height the camera aims at, in model units. */
export const TARGET_Z = 0.45;
const RAD = (ELEVATION * Math.PI) / 180;
/** On screen, a height h appears as h * TILT. */
export const TILT = Math.cos(RAD);
/** On screen, a circle on the ground appears this much flatter than wide. */
export const SQUASH = Math.sin(RAD);
/** How far below the image centre the ground point lies, as a share of the image size. */
export const GROUND = (TARGET_Z * TILT) / FRAME;

const images = new Map<string, HTMLImageElement>();

function image(name: string): HTMLImageElement | undefined {
  let img = images.get(name);
  if (!img && typeof Image !== 'undefined') {
    const url = Object.entries(urls).find(([path]) => path.endsWith(`/${name}.png`))?.[1];
    if (!url) return undefined;
    img = new Image();
    img.decoding = 'async';
    img.src = url;
    images.set(name, img);
  }
  return img;
}

/** Starts loading these sprites, so the first frames of a level are not empty. */
export function preloadSprites(names: Iterable<string>): void {
  for (const name of names) image(name);
}

export interface Scaled {
  img: CanvasImageSource;
  /** Side of the scaled bitmap in whole pixels. */
  px: number;
}

export class SpriteCache {
  private scaled = new Map<string, Scaled>();

  /** Forget the scaled copies, e.g. after the board changes size. */
  clear(): void {
    this.scaled.clear();
  }

  /** The sprite scaled to about `size` px square, or undefined while it is still loading. */
  get(name: string, size: number): Scaled | undefined {
    const px = Math.max(8, Math.round(size));
    const key = `${name}@${px}`;
    const hit = this.scaled.get(key);
    if (hit) return hit;
    const img = image(name);
    if (!img || !img.complete || img.naturalWidth === 0) return undefined;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = px;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { img, px };
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    // Halve in steps: one big downscale aliases thin outlines.
    let src: CanvasImageSource = img;
    let w = img.naturalWidth;
    while (w / 2 >= px * 1.5) {
      const step = document.createElement('canvas');
      step.width = step.height = Math.round(w / 2);
      const sctx = step.getContext('2d');
      if (!sctx) break;
      sctx.imageSmoothingQuality = 'high';
      sctx.drawImage(src, 0, 0, step.width, step.height);
      src = step;
      w = step.width;
    }
    ctx.drawImage(src, 0, 0, px, px);
    const scaled = { img: canvas, px };
    this.scaled.set(key, scaled);
    return scaled;
  }
}

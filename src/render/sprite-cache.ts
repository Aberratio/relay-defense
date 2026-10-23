// Loads the pre-rendered sprites and keeps a copy of each scaled to the size it is drawn at, so
// the board blits small bitmaps instead of resampling 256 px images every frame.
//
// Every sprite is 256 px of a 1.45-unit orthographic frame from a camera 35 degrees above the
// ground, aimed 0.45 units up (art/sprites.json). The ground point under a character therefore
// sits GROUND of the image height below the image centre.
const urls = import.meta.glob('../assets/sprites/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

/** Width of the rendered frame in model units. */
export const FRAME = 1.45;
/** How far below the image centre the ground point lies, as a share of the image size. */
export const GROUND = (0.45 * Math.cos((35 * Math.PI) / 180)) / FRAME;

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

/** Starts loading every sprite, so the first frames of a level are not empty. */
export function preloadSprites(): Promise<void> {
  const names = Object.keys(urls).map((p) => p.replace(/^.*\//, '').replace(/\.png$/, ''));
  return Promise.all(
    names.map(
      (n) =>
        image(n)
          ?.decode()
          .catch(() => undefined) ?? Promise.resolve(),
    ),
  ).then(() => undefined);
}

export class SpriteCache {
  private scaled = new Map<string, HTMLCanvasElement>();

  /** Forget the scaled copies, e.g. after the board changes size. */
  clear(): void {
    this.scaled.clear();
  }

  /** The sprite scaled to `size` px square, or undefined while it is still loading. */
  get(name: string, size: number): CanvasImageSource | undefined {
    const px = Math.max(8, Math.round(size));
    const key = `${name}@${px}`;
    const hit = this.scaled.get(key);
    if (hit) return hit;
    const img = image(name);
    if (!img || !img.complete || img.naturalWidth === 0) return undefined;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = px;
    const ctx = canvas.getContext('2d');
    if (!ctx) return img;
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
    this.scaled.set(key, canvas);
    return canvas;
  }
}

// Encodes PNG files to WebP with alpha in headless Chromium (Playwright), so the sprite pipeline
// needs no native image library. Lossy colour at QUALITY, lossless alpha (Chromium's default).
//
//   npx tsx scripts/webp.ts a.png b.png    writes a.webp and b.webp next to them
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

/** WebP quality: 0.85 keeps the outlines clean at a seventh of the PNG weight. */
export const QUALITY = 0.85;

export interface Encoded {
  to: string;
  bytes: number;
  /** Largest difference against the PNG in alpha or in alpha-weighted colour, over visible pixels. */
  maxDiff: number;
  /** Mean difference per channel over the same pixels. */
  meanDiff: number;
}

/** Encodes each `from` PNG to the `to` WebP and reports how far the result drifts from it. */
export async function encodeWebp(jobs: { from: string; to: string }[]): Promise<Encoded[]> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    // tsx keeps function names by wrapping them in __name(), which the page does not have.
    await page.evaluate('globalThis.__name = (f) => f');
    const done: Encoded[] = [];
    for (const { from, to } of jobs) {
      const png = readFileSync(from).toString('base64');
      const out = await page.evaluate(
        async ([data, quality]) => {
          const decode = async (blob: Blob) => {
            const bmp = await createImageBitmap(blob, {
              premultiplyAlpha: 'none',
              colorSpaceConversion: 'none',
            });
            const canvas = new OffscreenCanvas(bmp.width, bmp.height);
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('no 2d context');
            ctx.drawImage(bmp, 0, 0);
            return { canvas, pixels: ctx.getImageData(0, 0, bmp.width, bmp.height).data };
          };
          const bin = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
          const src = await decode(new Blob([bin], { type: 'image/png' }));
          const webp = await src.canvas.convertToBlob({ type: 'image/webp', quality });
          const back = await decode(webp);
          let max = 0;
          let sum = 0;
          let n = 0;
          for (let i = 0; i < src.pixels.length; i += 4) {
            const alpha = src.pixels[i + 3] ?? 0;
            if (alpha === 0) continue;
            const alphaBack = back.pixels[i + 3] ?? 0;
            for (let c = 0; c < 4; c++) {
              // Colour weighted by its alpha: what the pixel adds to the board.
              const d =
                c === 3
                  ? Math.abs(alpha - alphaBack)
                  : Math.abs(
                      ((src.pixels[i + c] ?? 0) * alpha - (back.pixels[i + c] ?? 0) * alphaBack) /
                        255,
                    );
              if (d > max) max = d;
              sum += d;
              n++;
            }
          }
          const bytes = new Uint8Array(await webp.arrayBuffer());
          let text = '';
          for (const b of bytes) text += String.fromCharCode(b);
          return { webp: btoa(text), type: webp.type, maxDiff: max, meanDiff: n ? sum / n : 0 };
        },
        [png, QUALITY] as const,
      );
      if (out.type !== 'image/webp') throw new Error(`Chromium did not encode WebP for ${from}`);
      const buf = Buffer.from(out.webp, 'base64');
      writeFileSync(to, buf);
      done.push({ to, bytes: buf.length, maxDiff: out.maxDiff, meanDiff: out.meanDiff });
    }
    return done;
  } finally {
    await browser.close();
  }
}

if (process.argv[1]?.endsWith('webp.ts')) {
  const files = process.argv.slice(2);
  const other = files.filter((f) => !/\.png$/i.test(f));
  if (other.length) throw new Error(`not a .png file: ${other.join(', ')}`);
  for (const r of await encodeWebp(
    files.map((f) => ({ from: f, to: f.replace(/\.png$/i, '.webp') })),
  ))
    console.info(`${r.to}: ${r.bytes} B, max diff ${r.maxDiff}, mean ${r.meanDiff.toFixed(2)}`);
}

// Renders the game sprites from the CC0 models in art/models with Blender, as described in
// art/sprites.json, into src/assets/sprites/. Needs Blender 4.4 or newer: set BLENDER to its
// executable, or install it in the default place. The PNGs are committed, so CI never needs it.
//
//   npm run sprites                 every sprite
//   npm run sprites -- archer ogre  only these
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

interface SpriteSpec {
  name: string;
  tiers?: number;
}

export interface Manifest {
  sprites: SpriteSpec[];
}

/** File names a manifest produces: `name-1..n.png` for tiered defenders, `name.png` otherwise. */
export function spriteFiles(manifest: Manifest): string[] {
  return manifest.sprites.flatMap((s) =>
    (s.tiers ?? 1) > 1
      ? Array.from({ length: s.tiers ?? 1 }, (_, i) => `${s.name}-${i + 1}.png`)
      : [`${s.name}.png`],
  );
}

function blender(): string {
  const candidates = [
    process.env.BLENDER,
    'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe',
    '/Applications/Blender.app/Contents/MacOS/Blender',
    '/usr/bin/blender',
  ].filter((p): p is string => !!p);
  const found = candidates.find((p) => existsSync(p));
  if (!found) throw new Error('Blender not found: set BLENDER to its executable.');
  return found;
}

function main(): void {
  const manifestPath = resolve('art/sprites.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest;
  const only = new Set(process.argv.slice(2));
  const out = resolve('src/assets/sprites');
  mkdirSync(out, { recursive: true });
  const exe = blender();
  for (const spec of manifest.sprites) {
    if (only.size && !only.has(spec.name)) continue;
    const tiers = spec.tiers ?? 1;
    for (let tier = 1; tier <= tiers; tier++) {
      const file = join(out, tiers > 1 ? `${spec.name}-${tier}.png` : `${spec.name}.png`);
      execFileSync(
        exe,
        [
          '--background',
          '--factory-startup',
          '--python',
          resolve('art/blender/render_sprite.py'),
          '--',
          manifestPath,
          spec.name,
          String(tier),
          file,
        ],
        { stdio: ['ignore', 'ignore', 'inherit'] },
      );
      console.info(`rendered ${file}`);
    }
  }
}

if (process.argv[1]?.endsWith('sprites.ts')) main();

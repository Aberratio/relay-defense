// Renders the game sprites from the CC0 models in art/models with Blender, as described in
// art/sprites.json, into src/assets/sprites/. Needs Blender 4.2 or newer (made with 5.2): set
// BLENDER to its executable or command, or install it in the default place. The PNGs are
// committed, so CI never needs it.
//
//   npm run sprites                 every sprite
//   npm run sprites -- archer ogre  only these
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

interface SpriteSpec {
  name: string;
  tiers?: number;
}

export interface Manifest {
  sprites: SpriteSpec[];
}

/** The file one level renders to: `name-<tier>.png` for tiered defenders, `name.png` otherwise. */
export function spriteFile(spec: SpriteSpec, tier: number): string {
  return (spec.tiers ?? 1) > 1 ? `${spec.name}-${tier}.png` : `${spec.name}.png`;
}

/** Every file a manifest produces. */
export function spriteFiles(manifest: Manifest): string[] {
  return manifest.sprites.flatMap((s) =>
    Array.from({ length: s.tiers ?? 1 }, (_, i) => spriteFile(s, i + 1)),
  );
}

/** BLENDER if set (a path or a command), else the newest default install, else `blender` on PATH. */
function blender(): string {
  if (process.env.BLENDER) return process.env.BLENDER;
  const windows = 'C:/Program Files/Blender Foundation';
  const installs = existsSync(windows)
    ? readdirSync(windows)
        .filter((d) => /^Blender \d/.test(d))
        .sort((a, b) => b.localeCompare(a, 'en', { numeric: true }))
        .map((d) => `${windows}/${d}/blender.exe`)
    : [];
  const candidates = [
    ...installs,
    '/Applications/Blender.app/Contents/MacOS/Blender',
    '/snap/bin/blender',
    '/usr/bin/blender',
  ];
  return candidates.find((p) => existsSync(p)) ?? 'blender';
}

function main(): void {
  const manifestPath = resolve('art/sprites.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest;
  const only = new Set(process.argv.slice(2));
  const unknown = [...only].filter((n) => !manifest.sprites.some((s) => s.name === n));
  if (unknown.length) throw new Error(`not in art/sprites.json: ${unknown.join(', ')}`);
  const out = resolve('src/assets/sprites');
  mkdirSync(out, { recursive: true });
  const exe = blender();
  for (const spec of manifest.sprites) {
    if (only.size && !only.has(spec.name)) continue;
    const tiers = spec.tiers ?? 1;
    for (let tier = 1; tier <= tiers; tier++) {
      const file = join(out, spriteFile(spec, tier));
      const before = existsSync(file) ? statSync(file).mtimeMs : 0;
      execFileSync(
        exe,
        [
          '--background',
          '--factory-startup',
          '--python-exit-code',
          '1',
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
      if (!existsSync(file) || statSync(file).mtimeMs === before)
        throw new Error(`Blender did not write ${file}`);
      console.info(`rendered ${file}`);
    }
  }
}

if (process.argv[1]?.endsWith('sprites.ts')) main();

// Cross-engine determinism check. A duel's result is computed in each player's browser, so the
// same actions must give the same game in every JavaScript engine, not only in Node. This plays
// every reference replay in Node and in the named Playwright browsers and compares the lives and
// credits after every wave and a hash of the whole simulated state after every tick.
//
//   npm run determinism                    WebKit and Firefox
//   npm run determinism -- webkit          one browser
//
// Needs the browsers installed: npx playwright install webkit firefox
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { firefox, webkit, type BrowserType } from 'playwright';
import { build } from 'vite';
import { fingerprints, type Fingerprint } from './determinism-entry';

const ENGINES: Record<string, BrowserType> = { webkit, firefox };
const names = process.argv.slice(2);
const chosen = names.length ? names : Object.keys(ENGINES);

async function bundle(): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), 'heartwood-determinism-'));
  try {
    await build({
      configFile: false,
      logLevel: 'warn',
      build: {
        outDir: dir,
        emptyOutDir: true,
        minify: false,
        lib: {
          entry: fileURLToPath(new URL('./determinism-entry.ts', import.meta.url)),
          name: 'Determinism',
          formats: ['iife'],
          fileName: () => 'entry.js',
        },
      },
    });
    return readFileSync(join(dir, 'entry.js'), 'utf8');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** The first difference between two runs, or null. */
function differs(a: Fingerprint, b: Fingerprint | undefined): string | null {
  if (!b) return 'missing';
  if (a.outcome !== b.outcome) return `outcome ${a.outcome} vs ${b.outcome}`;
  const wave = a.waves.findIndex((w, i) => String(w) !== String(b.waves[i]));
  if (wave >= 0) return `after wave ${wave + 1}: ${a.waves[wave]} vs ${b.waves[wave]}`;
  if (a.ticks !== b.ticks) return `ticks ${a.ticks} vs ${b.ticks}`;
  if (a.hash !== b.hash) return `state hash ${a.hash} vs ${b.hash}`;
  return null;
}

const reference = fingerprints();
const code = await bundle();
let failed = 0;
for (const name of chosen) {
  const type = ENGINES[name];
  if (!type) throw new Error(`unknown browser "${name}" (${Object.keys(ENGINES).join(', ')})`);
  const browser = await type.launch();
  const page = await browser.newPage();
  await page.addScriptTag({ content: code });
  const runs = await page.evaluate(() =>
    (
      globalThis as unknown as { Determinism: { fingerprints(): Fingerprint[] } }
    ).Determinism.fingerprints(),
  );
  const version = browser.version();
  await browser.close();
  const bad = reference
    .map((r, i) => ({ name: r.name, diff: differs(r, runs[i]) }))
    .filter((r) => r.diff !== null);
  failed += bad.length;
  console.info(
    `${name} ${version}: ${reference.length - bad.length}/${reference.length} replays identical to Node ${process.version}`,
  );
  for (const b of bad) console.error(`  ${b.name}: ${b.diff}`);
}
if (failed) {
  console.error(`${failed} replays differ between engines`);
  process.exitCode = 1;
}

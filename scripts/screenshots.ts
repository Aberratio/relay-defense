// Takes the README screenshots by playing levels through the real UI in Chromium: it clicks the
// agents of a reference solution (tests/solutions.ts) onto the board, starts waves and captures
// the screen mid-fight. It is also a browser smoke test: it fails on any page error.
//
//   npm run dev -- --port 5391       (in another terminal)
//   npm run screenshots [-- http://localhost:5391/]
import { mkdirSync } from 'node:fs';
import { chromium, type Page } from 'playwright';
import type { Action } from '../src/engine/replay';
import { LEVELS } from '../src/levels/levels';
import { SOLUTIONS } from '../tests/solutions';

const base = process.argv[2] ?? 'http://localhost:5391/';
const out = 'docs/screenshots';
mkdirSync(out, { recursive: true });

async function clickCell(page: Page, x: number, y: number): Promise<void> {
  const box = await page.locator('#board').boundingBox();
  if (!box) throw new Error('board not visible');
  const size = box.width / 16;
  await page.mouse.click(box.x + (x + 0.5) * size, box.y + (y + 0.5) * size);
}

async function perform(page: Page, levelId: string, action: Action): Promise<void> {
  const level = LEVELS.find((l) => l.id === levelId);
  if (!level) throw new Error(levelId);
  if (action[0] === 'build') {
    await page.keyboard.press(String(level.towers.indexOf(action[1]) + 1));
    await clickCell(page, action[2], action[3]);
    await page.keyboard.press('Escape');
  } else if (action[0] === 'up') {
    await clickCell(page, action[1], action[2]);
    await page.keyboard.press('u');
    await page.keyboard.press('Escape');
  }
}

/** Opens a level, builds the solution up to wave `wave`, starts it and waits `seconds`. */
async function playTo(page: Page, levelId: string, wave: number, seconds: number): Promise<void> {
  const solution = SOLUTIONS.find((s) => s.level === levelId);
  if (!solution) throw new Error(levelId);
  await page.locator('.dialog .btn-primary').click();
  await page.locator('#speed').click();
  await page.locator('#speed').click();
  for (let w = 0; w <= wave; w++) {
    for (const action of solution.waves[w] ?? []) await perform(page, levelId, action);
    if (w === wave) {
      await page.locator('#speed').click(); // back to 1x for a calm frame
      await page.locator('#start-wave').click();
      await page.waitForTimeout(seconds * 1000);
    } else {
      await page.locator('#start-wave').click();
      await page.locator('#start-wave:not([disabled])').waitFor({ timeout: 120_000 });
    }
  }
}

const browser = await chromium.launch();
const errors: string[] = [];
async function open(path: string, width: number, height: number, scale = 1): Promise<Page> {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: scale });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(new URL(path, base).toString());
  await page.waitForLoadState('networkidle');
  return page;
}

const menu = await open('?lang=en', 1440, 900);
await menu.screenshot({ path: `${out}/menu-en.png` });
await menu.close();

const brief = await open('?lang=en&level=ghost-protocol', 1440, 900);
await brief.screenshot({ path: `${out}/briefing-en.png` });
await brief.close();

const maze = await open('?lang=en&level=two-fronts', 1440, 900);
await playTo(maze, 'two-fronts', 3, 9);
await maze.screenshot({ path: `${out}/two-fronts-en.png` });
await maze.close();

const split = await open('?lang=pl&level=split-brain', 1440, 900);
await playTo(split, 'split-brain', 4, 10);
await split.screenshot({ path: `${out}/split-brain-pl.png` });
await split.close();

const boss = await open('?lang=en&level=colossus', 1440, 900);
await playTo(boss, 'colossus', 4, 14);
await boss.screenshot({ path: `${out}/colossus-en.png` });
await boss.close();

const phone = await open('?lang=pl&level=open-floor', 390, 844, 2);
await playTo(phone, 'open-floor', 2, 8);
await phone.screenshot({ path: `${out}/phone-pl.png`, fullPage: true });
await phone.close();

await browser.close();
if (errors.length) {
  console.error(`Page errors:\n${errors.join('\n')}`);
  process.exit(1);
}
console.info(`Screenshots written to ${out}/`);

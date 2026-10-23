// Browser smoke test of the production build: serves dist/ with `vite preview`, plays the first
// level in Chromium through the UI, and checks the embed mode reports its height to a parent page.
// Fails on any page error. Run after `npm run build`: `npm run smoke`.
import { chromium } from 'playwright';
import { preview } from 'vite';

const server = await preview({ preview: { port: 4719, strictPort: true, host: 'localhost' } });
const base = 'http://localhost:4719/';
const browser = await chromium.launch();
const errors: string[] = [];
const fail = (msg: string) => {
  throw new Error(msg);
};

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}?lang=en`);
  await page.locator('.level-card').first().click();
  await page.locator('.dialog .btn-primary').click();
  // Two Pulse agents on the sockets next to the first bend, then the first wave at top speed.
  const box = (await page.locator('#board').boundingBox()) ?? fail('no board');
  const cell = box.width / 16;
  for (const [x, y] of [
    [11, 4],
    [13, 3],
  ] as const) {
    await page.keyboard.press('1');
    await page.mouse.click(box.x + (x + 0.5) * cell, box.y + (y + 0.5) * cell);
    await page.keyboard.press('Escape');
  }
  const credits = await page.locator('#stat-credits .stat-value').textContent();
  if (credits !== '30') fail(`expected 30 credits after building, got ${credits}`);
  await page.locator('#speed').click();
  await page.locator('#speed').click();
  await page.locator('#start-wave').click();
  await page.locator('#start-wave:not([disabled])').waitFor({ timeout: 60_000 });
  const wave = await page.locator('#stat-wave .stat-value').textContent();
  if (!wave?.startsWith('2')) fail(`expected wave 2 after clearing the first, got ${wave}`);

  // Siege: the card under the levels opens the first chapter.
  await page.goto(`${base}?lang=en`);
  await page.locator('#siege .btn-primary').click();
  const eyebrow = await page.locator('.dialog .dialog-eyebrow').textContent();
  if (!eyebrow?.startsWith('Siege')) fail(`expected the Siege briefing, got ${eyebrow}`);
  await page.locator('.dialog .btn-primary').click();
  const title = await page.locator('#level-name').textContent();
  if (!title?.startsWith('Siege 1')) fail(`expected Siege chapter 1, got ${title}`);

  // Embed: a parent page frames the game and receives its height.
  const parent = await browser.newPage({ viewport: { width: 1000, height: 800 } });
  parent.on('pageerror', (e) => errors.push(e.message));
  await parent.goto(base);
  const height = await parent.evaluate(
    (src) =>
      new Promise<number>((resolve, reject) => {
        window.addEventListener(
          'message',
          (e: MessageEvent<{ type?: string; height?: number }>) => {
            if (e.data?.type === 'relay-defense:height' && typeof e.data.height === 'number')
              resolve(e.data.height);
          },
        );
        const frame = document.createElement('iframe');
        frame.src = src;
        frame.style.width = '900px';
        document.body.replaceChildren(frame);
        setTimeout(() => reject(new Error('no height message')), 10_000);
      }),
    `${base}?embed=1&lang=pl`,
  );
  if (!(height > 300)) fail(`implausible embed height ${height}`);
  console.info(`Smoke test passed: level played, Siege opened, embed height ${height}px.`);
} finally {
  await browser.close();
  server.httpServer.close();
}
if (errors.length) {
  console.error(`Page errors:\n${errors.join('\n')}`);
  process.exit(1);
}

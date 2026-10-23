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
  // Menu: the first levels are open, the fourth is locked and says so; unlock all opens it.
  const locked = page.locator('.level-node').nth(3);
  if ((await locked.getAttribute('aria-disabled')) !== 'true') fail('level 4 should be locked');
  if (!(await locked.getAttribute('aria-label'))?.endsWith('locked'))
    fail('a locked level should be announced as locked');
  await locked.focus();
  await page.keyboard.press('Enter');
  await page.locator('#menu-status button').click();
  if ((await locked.getAttribute('aria-disabled')) !== null) fail('unlock all left level 4 shut');
  await page.evaluate(() => localStorage.removeItem('relay-defense:unlock-all:v1'));
  await page.locator('.btn-play').click();
  const first = await page.locator('.dialog .dialog-eyebrow').textContent();
  if (!first?.startsWith('Level 1')) fail(`the call to action should open level 1, got ${first}`);
  await page.goto(`${base}?lang=en`);
  await page.locator('.level-node').first().click();
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

  // Narrow embed: kokot.it frames the game 326 px wide on a 360 px phone and sizes the frame to
  // the reported height. Neither the Siege nor a level may then scroll inside the frame, sideways
  // or by a stray pixel of height.
  const narrow = await browser.newPage({ viewport: { width: 360, height: 740 } });
  narrow.on('pageerror', (e) => errors.push(e.message));
  await narrow.goto(base);
  for (const lang of ['pl', 'en']) {
    await narrow.evaluate((src) => {
      const frame = document.createElement('iframe');
      frame.src = src;
      frame.style.cssText = 'display:block;width:326px;height:400px;border:0';
      window.onmessage = (e: MessageEvent<{ type?: string; height?: number }>) => {
        if (e.data?.type === 'relay-defense:height') frame.style.height = `${e.data.height}px`;
      };
      document.body.style.margin = '0';
      document.body.replaceChildren(frame);
    }, `${base}?embed=1&lang=${lang}`);
    const frame =
      (await (await narrow.waitForSelector('iframe')).contentFrame()) ?? fail('no frame');
    const overflow = async (screen: string) => {
      // Two frames for the height report and the frame resize to settle.
      await frame.evaluate(
        () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
      );
      await narrow.waitForTimeout(200);
      const { sw, cw, sh, ch, clipped } = await frame.evaluate(() => {
        const el = document.scrollingElement ?? document.documentElement;
        // A defender card whose name runs past its own box or into the next column.
        const clipped = [...document.querySelectorAll<HTMLElement>('.tool')]
          .filter((tool) => {
            const name = tool.querySelector<HTMLElement>('.tool-name');
            return (
              tool.scrollWidth > tool.clientWidth ||
              (name !== null && name.scrollWidth > name.clientWidth)
            );
          })
          .map((tool) => tool.querySelector('.tool-name')?.textContent);
        return {
          sw: el.scrollWidth,
          cw: el.clientWidth,
          sh: el.scrollHeight,
          ch: el.clientHeight,
          clipped,
        };
      });
      if (sw > cw) fail(`${screen} (${lang}) overflows a 326 px frame sideways: ${sw} > ${cw}`);
      if (sh > ch) fail(`${screen} (${lang}) is taller than its reported height: ${sh} > ${ch}`);
      if (clipped.length) fail(`${screen} (${lang}) clips defender names: ${clipped.join(', ')}`);
    };
    await frame.locator('.level-node').first().waitFor();
    await overflow('menu');
    await frame.locator('#siege .btn-primary').click();
    await frame.locator('.dialog .btn-primary').click();
    await overflow('Siege');
    await frame.locator('#home').click();
    await frame.locator('.level-node').first().click();
    await frame.locator('.dialog .btn-primary').click();
    await overflow('level 1');
  }
  console.info(
    `Smoke test passed: unlock path checked, level played, Siege opened, embed height ${height}px, narrow embed fits.`,
  );
} finally {
  await browser.close();
  server.httpServer.close();
}
if (errors.length) {
  console.error(`Page errors:\n${errors.join('\n')}`);
  process.exit(1);
}

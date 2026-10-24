// Browser smoke test of the production build: serves dist/ with `vite preview`, plays the first
// level in Chromium through the UI, and checks the embed mode reports its height to a parent page.
// Fails on any page error. Run after `npm run build`: `npm run smoke`.
import { chromium, type Frame, type Page } from 'playwright';
import { preview } from 'vite';
import { SIEGE } from '../src/levels/siege';

const server = await preview({ preview: { port: 4719, strictPort: true, host: 'localhost' } });
const base = 'http://localhost:4719/';
const browser = await chromium.launch();
const errors: string[] = [];
const fail = (msg: string) => {
  throw new Error(msg);
};

/** Frames the game in a parent page that sizes the frame to the reported height, like kokot.it. */
const mount = async (page: Page, width: number, src: string): Promise<Frame> => {
  await page.evaluate(
    ([src, width]) => {
      const frame = document.createElement('iframe');
      frame.src = src;
      frame.style.cssText = `display:block;width:${width}px;height:400px;border:0`;
      window.onmessage = (e: MessageEvent<{ type?: string; height?: number }>) => {
        if (e.data?.type === 'relay-defense:height') frame.style.height = `${e.data.height}px`;
      };
      document.body.style.margin = '0';
      document.body.replaceChildren(frame);
    },
    [src, width] as const,
  );
  return (await (await page.waitForSelector('iframe')).contentFrame()) ?? fail('no frame');
};
/** Two frames for the height report and the frame resize to settle. */
const settle = async (frame: Frame) => {
  await frame.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  await frame.page().waitForTimeout(200);
};
const frameHeight = (page: Page) =>
  page.evaluate(() => document.querySelector('iframe')?.getBoundingClientRect().height ?? 0);
/** The open dialog sits wholly inside the frame: no scrolling inside the overlay or the frame. */
const dialogFits = async (frame: Frame, what: string) => {
  await settle(frame);
  const r = await frame.evaluate(() => {
    const overlay = document.getElementById('overlay') as HTMLElement;
    const el = document.scrollingElement ?? document.documentElement;
    const bottom = (document.getElementById('dialog') as HTMLElement).getBoundingClientRect()
      .bottom;
    return {
      inner: overlay.scrollHeight - overlay.clientHeight,
      outer: el.scrollHeight - el.clientHeight,
      below: Math.ceil(bottom + el.scrollTop) - el.clientHeight,
    };
  });
  if (r.inner > 0) fail(`${what} scrolls inside the overlay by ${r.inner} px`);
  if (r.outer > 0) fail(`${what} scrolls inside the frame by ${r.outer} px`);
  if (r.below > 0) fail(`${what} ends ${r.below} px below the frame`);
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

  // Two tabs: a win saved in one shows in the other's open menu without a reload.
  const tabs = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const [tabA, tabB] = [await tabs.newPage(), await tabs.newPage()];
  for (const tab of [tabA, tabB]) {
    tab.on('pageerror', (e) => errors.push(e.message));
    await tab.goto(`${base}?lang=en`);
  }
  await tabA.evaluate(() =>
    localStorage.setItem('relay-defense:progress:v1', JSON.stringify({ handshake: 3 })),
  );
  await tabB
    .locator('.level-node[aria-label$="3 of 3 stars"]')
    .first()
    .waitFor({ timeout: 5000 })
    .catch(() => fail('a win saved in another tab did not show in the open menu'));
  // A Siege checkpoint saved in the other tab: the menu offers it, and a button that held the
  // focus during the redraw still holds it.
  await tabB.locator('.level-node').nth(1).focus();
  await tabA.evaluate(
    ([version]) =>
      localStorage.setItem(
        'relay-defense:siege:v1',
        JSON.stringify({
          stars: [3, 2],
          checkpoint: { version, chapter: 2, carry: { credits: 90, towers: [] } },
        }),
      ),
    [SIEGE.version] as const,
  );
  await tabB
    .locator('#siege .btn-primary', { hasText: 'chapter 3' })
    .waitFor({ timeout: 5000 })
    .catch(() => fail('a Siege checkpoint saved in another tab did not show in the open menu'));
  const kept = await tabB.evaluate(
    () => document.activeElement === document.querySelectorAll('.level-node')[1],
  );
  if (!kept) fail('redrawing the menu after another tab saved lost the focus');
  await tabs.close();

  // Accessibility: names, headings, focus and shortcuts a keyboard or screen-reader player meets.
  const a11y = await browser.newPage({ viewport: { width: 360, height: 740 } });
  a11y.on('pageerror', (e) => errors.push(e.message));
  await a11y.goto(`${base}?lang=en`);
  // A level button's name starts with what it shows, so speech input can say "01 ..." to press it.
  const node = a11y.locator('.level-node').first();
  const shown = `${await node.locator('.level-num').textContent()} ${await node.locator('.node-name').textContent()}`;
  const named = await node.getAttribute('aria-label');
  if (!named?.startsWith(shown)) fail(`level button "${named}" should start with "${shown}"`);
  // In a level the page still has one h1, also on a phone where the top bar hides the level name.
  await a11y.goto(`${base}?lang=en&level=handshake`);
  await a11y.locator('.dialog .btn-primary').click();
  const h1 = await a11y.getByRole('heading', { level: 1 }).allTextContents();
  if (h1.length !== 1 || !h1[0]?.includes('1'))
    fail(`a level should have one h1 naming it, got ${JSON.stringify(h1)}`);
  // A placement error reaches the announcer, which is always in the accessibility tree: a Pulse
  // agent on the path next to the Heart Tree.
  await a11y.locator('#board').focus();
  await a11y.keyboard.press('1');
  await a11y.keyboard.press('ArrowLeft');
  await a11y.keyboard.press('Enter');
  await a11y
    .waitForFunction(
      () => {
        const toast = document.getElementById('toast')?.textContent;
        return !!toast && document.getElementById('announcer')?.textContent === toast;
      },
      undefined,
      { timeout: 2000 },
    )
    .catch(() => fail('a placement error was not announced'));
  await a11y.keyboard.press('Escape');
  // Letter shortcuts act only while the focus is in the game, not on help or the language switch.
  const pressed = () => a11y.locator('#pause').getAttribute('aria-pressed');
  await a11y.locator('#start-wave').click();
  await a11y.locator('#help-open').focus();
  await a11y.keyboard.press('p');
  if ((await pressed()) !== 'false') fail('"p" on the help button paused the game');
  await a11y.locator('#board').focus();
  await a11y.keyboard.press('p');
  if ((await pressed()) !== 'true') fail('"p" on the board did not pause the game');
  await a11y.locator('#pause').focus();
  await a11y.keyboard.press('p');
  if ((await pressed()) !== 'false') fail('"p" on the pause button did not resume the game');
  // Losing and going back to all levels puts the focus on the menu, not on the page.
  await a11y.locator('#speed').click();
  await a11y.locator('#speed').click();
  const t0 = Date.now();
  while (!(await a11y.locator('.dialog-result').count())) {
    if (Date.now() - t0 > 120_000) fail('level 1 without defenders was not lost in time');
    const start = a11y.locator('#start-wave:not([disabled])');
    if (await start.count()) await start.click();
    await a11y.waitForTimeout(300);
  }
  await a11y.locator('.dialog .btn', { hasText: 'All levels' }).click();
  const focused = await a11y.evaluate(() => document.activeElement?.getAttribute('data-role'));
  if (focused !== 'play') fail(`after "All levels" the focus is on ${focused}, not Play`);
  await a11y.close();
  // Forced colours (Windows High Contrast) drop box-shadow, so the focus ring needs an outline.
  const forced = await browser.newPage({ forcedColors: 'active' });
  await forced.goto(`${base}?lang=en`);
  await forced.keyboard.press('Tab');
  const ring = await forced.evaluate(() => {
    const s = getComputedStyle(document.activeElement as Element);
    return `${s.outlineStyle} ${s.outlineWidth}`;
  });
  if (ring.startsWith('none') || ring.endsWith(' 0px'))
    fail(`no focus ring in forced colours: outline ${ring}`);
  await forced.close();

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
    const frame = await mount(narrow, 326, `${base}?embed=1&lang=${lang}`);
    const overflow = async (screen: string) => {
      await settle(frame);
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
    // Picking a defender fills the info panel, which keeps room for it, so the frame does not
    // grow and push the wave panel down under the player's finger.
    const picked = await frameHeight(narrow);
    await frame.locator('.tool').first().click();
    await overflow('level 1 with a defender picked');
    const after = await frameHeight(narrow);
    if (after !== picked)
      fail(`picking a defender (${lang}) resized the frame: ${picked} -> ${after}`);
    // Help is taller than a level: the frame grows to hold it, nothing scrolls inside the frame.
    await frame.locator('#help-open').click();
    await dialogFits(frame, `help in level 1 (${lang})`);
    // A reader who scrolled the page down to the Close button must not be left below the game once
    // the frame shrinks back: closing brings the board into view. Text follows the frame, as on a
    // case study, so the page cannot simply run out of scroll.
    await narrow.evaluate(() => {
      const text = document.createElement('div');
      text.style.height = '3000px';
      document.body.append(text);
      const frame = document.querySelector('iframe') as HTMLIFrameElement;
      window.scrollTo(
        0,
        frame.getBoundingClientRect().bottom + window.scrollY - window.innerHeight,
      );
    });
    await narrow.keyboard.press('Escape');
    await settle(frame);
    const board = await narrow.evaluate(async () => {
      const iframe = document.querySelector('iframe') as HTMLIFrameElement;
      const canvas = iframe.contentDocument?.getElementById('board');
      const top = iframe.getBoundingClientRect().top + (canvas?.getBoundingClientRect().top ?? 0);
      const bottom = top + (canvas?.getBoundingClientRect().height ?? 0);
      return { top: Math.round(top), bottom: Math.round(bottom), view: window.innerHeight };
    });
    if (board.bottom <= 0 || board.top >= board.view)
      fail(`closing help (${lang}) left the board off screen: ${board.top}..${board.bottom}`);
  }

  // Wide embed: kokot.it frames the game 966 px wide on a 1280 px screen, where a level is about
  // 510 px tall and the longest briefing is not. Its Begin button must be in the frame.
  const wide = await browser.newPage({ viewport: { width: 1000, height: 800 } });
  wide.on('pageerror', (e) => errors.push(e.message));
  await wide.goto(base);
  const wideFrame = await mount(wide, 966, `${base}?embed=1&lang=pl&level=split-brain`);
  await wideFrame.locator('.dialog .btn-primary').waitFor();
  await dialogFits(wideFrame, 'the split-brain briefing at 966 px');
  console.info(
    `Smoke test passed: unlock path checked, level played, Siege opened, accessibility checks, embed height ${height}px, narrow embed fits, dialogs fit the frame.`,
  );
} finally {
  await browser.close();
  server.httpServer.close();
}
if (errors.length) {
  console.error(`Page errors:\n${errors.join('\n')}`);
  process.exit(1);
}

// Browser smoke test of the production build: serves dist/ with `vite preview`, plays the first
// level in Chromium through the UI, and checks the embed mode reports its height to a parent page.
// Fails on any page error. Run after `npm run build`: `npm run smoke`.
import { chromium, type Frame, type Page } from 'playwright';
import { preview } from 'vite';
import { LEVELS } from '../src/levels/levels';
import { SIEGE } from '../src/levels/siege';
import { SOLUTIONS } from '../tests/solutions';

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
/**
 * A blank same-origin page to frame the game in. A copy of the game as the host page would take
 * the frame's saves through its storage listener with its own DOM already replaced.
 */
const host = async (page: Page) => {
  await page.route(`${base}host.html`, (route) =>
    route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>host</title>' }),
  );
  await page.goto(`${base}host.html`);
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
  // Every note over the board, to find the one for the first Goblin after the wave.
  await page.evaluate(() => {
    const toast = document.getElementById('toast') as HTMLElement;
    const seen: string[] = [];
    (window as unknown as { toasts: string[] }).toasts = seen;
    new MutationObserver(() => {
      if (!toast.hidden) seen.push(`${toast.className}: ${toast.textContent}`);
    }).observe(toast, { attributes: true, childList: true });
  });
  await page.locator('#start-wave').click();
  await page.locator('#start-wave:not([disabled])').waitFor({ timeout: 60_000 });
  const toasts = await page.evaluate(() => (window as unknown as { toasts: string[] }).toasts);
  if (!toasts.includes('toast is-news: New in the bestiary: Goblin.'))
    fail(`the first Goblin got no bestiary note, notes: ${JSON.stringify(toasts)}`);
  const wave = await page.locator('#stat-wave .stat-value').textContent();
  if (!wave?.startsWith('2')) fail(`expected wave 2 after clearing the first, got ${wave}`);

  // Bestiary: the Archer (available) and the Goblin (on the board) of level 1 are found and saved
  // under their own key; a monster not met yet shows only where it appears. Escape closes it and
  // the focus goes back to the menu button.
  await page.locator('#home').click();
  const book = page.locator('#hero-actions [data-role="bestiary"]');
  if ((await book.getAttribute('aria-label')) !== 'Bestiary, 2 of 14 cards found')
    fail(`bestiary button says "${await book.getAttribute('aria-label')}" after level 1`);
  const saved = await page.evaluate(() => localStorage.getItem('relay-defense:bestiary:v1'));
  if (saved !== '{"towers":["pulse"],"enemies":["spark"]}') fail(`bestiary saved ${saved}`);
  await book.click();
  const goblin = page.locator('.dialog-bestiary .card[data-kind="spark"]');
  if ((await goblin.getAttribute('class')) !== 'card') fail('the Goblin card is not found');
  if (!(await goblin.textContent())?.includes('Answered by: Archer'))
    fail('the Goblin card does not name the defender that answers it');
  const troll = page.locator('.dialog-bestiary .card[data-kind="bulwark"]');
  if ((await troll.getAttribute('class')) !== 'card is-unknown') fail('the Troll card is open');
  if ((await troll.textContent())?.includes('Troll')) fail('an unfound card gives its name away');
  if ((await troll.locator('h4').textContent()) !== 'Monster not met yet')
    fail('an unfound card should say what kind of character is missing');
  if (!(await troll.textContent())?.includes('Appears in: 3. Iron Hides'))
    fail('an unfound card does not say where it appears');
  await page.keyboard.press('Escape');
  if (!(await page.locator('#overlay').isHidden())) fail('Escape did not close the bestiary');
  const back = await page.evaluate(() => document.activeElement?.getAttribute('data-role'));
  if (back !== 'bestiary') fail(`closing the bestiary left the focus on ${back}`);
  // A guest who won levels before the bestiary existed finds their cards already open.
  await page.evaluate(() => {
    localStorage.removeItem('relay-defense:bestiary:v1');
    localStorage.setItem('relay-defense:progress:v1', JSON.stringify({ handshake: 3 }));
  });
  await page.reload();
  if ((await book.getAttribute('aria-label')) !== 'Bestiary, 2 of 14 cards found')
    fail('cards of levels won before the bestiary are not open');
  // A found card names only characters already met: the Unicorn answers three monsters, none met.
  await page.evaluate(() =>
    localStorage.setItem('relay-defense:bestiary:v1', JSON.stringify({ towers: ['lance'] })),
  );
  await page.reload();
  await book.click();
  const unicorn = await page.locator('.card[data-kind="lance"] .card-link').textContent();
  if (unicorn !== 'Answers: not met yet: 3') fail(`the Unicorn card says "${unicorn}"`);
  await page.keyboard.press('Escape');
  await page.evaluate(() => localStorage.clear());

  // Result: a level's dialog says what the win changed. A first win of level 3 opens level 4 and
  // counts the defender waiting there (not met yet, so not named); the cards found on the way are
  // listed. A replay of level 1 that beats its saved stars is a record.
  const win = async (id: string) => {
    const level = LEVELS.find((l) => l.id === id) ?? fail(`no level ${id}`);
    const solution = SOLUTIONS.find((sol) => sol.level === id) ?? fail(`no solution for ${id}`);
    await page.goto(`${base}?lang=en&level=${id}`);
    await page.locator('.dialog .btn-primary').click();
    await page.locator('#speed').click();
    await page.locator('#speed').click();
    const board = (await page.locator('#board').boundingBox()) ?? fail('no board');
    const at = (x: number, y: number) =>
      page.mouse.click(
        board.x + ((x + 0.5) * board.width) / 16,
        board.y + ((y + 0.5) * board.width) / 16,
      );
    for (let w = 0; w < level.waves.length; w++) {
      for (const action of solution.waves[w] ?? []) {
        if (action[0] === 'build') {
          await page.keyboard.press(String(level.towers.indexOf(action[1]) + 1));
          await at(action[2], action[3]);
        } else if (action[0] === 'up') {
          await at(action[1], action[2]);
          await page.keyboard.press('u');
        } else fail(`the smoke test cannot play "${action[0]}"`);
        await page.keyboard.press('Escape');
      }
      await page.locator('#start-wave').click();
      await page
        .locator('#start-wave:not([disabled]), .dialog-result')
        .first()
        .waitFor({ timeout: 120_000 });
    }
    await page.locator('.dialog-result').waitFor({ timeout: 10_000 });
    return page.locator('.dialog-result .result-news li').allTextContents();
  };
  await page.evaluate(() =>
    localStorage.setItem(
      'relay-defense:progress:v1',
      JSON.stringify({ handshake: 3, 'fan-out': 3 }),
    ),
  );
  const opened = await win('bulwark');
  const expected = [
    'Now open: 4. Open Meadow. Waiting there: a new defender.',
    'New in the bestiary: Unicorn and Troll.',
  ];
  if (JSON.stringify(opened) !== JSON.stringify(expected))
    fail(`level 3 result says ${JSON.stringify(opened)}`);
  await page.evaluate(() =>
    localStorage.setItem('relay-defense:progress:v1', JSON.stringify({ handshake: 1 })),
  );
  const record = await win('handshake');
  if (JSON.stringify(record) !== JSON.stringify(['New best: 3 of 3 stars, up from 1.']))
    fail(`level 1 replay result says ${JSON.stringify(record)}`);
  await page.evaluate(() => localStorage.clear());

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
  if (h1.length !== 1 || h1[0] !== '1. First Watch')
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
  forced.on('pageerror', (e) => errors.push(e.message));
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
  await host(narrow);
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
    // The bestiary, the longest dialog, grows the frame like help does and fits 326 px.
    const menuHeight = await frameHeight(narrow);
    await frame.locator('[data-role="bestiary"]').click();
    await dialogFits(frame, `the bestiary (${lang})`);
    await overflow('the bestiary');
    await frame.locator('.dialog-bestiary .btn').click();
    await settle(frame);
    if ((await frameHeight(narrow)) !== menuHeight)
      fail(`closing the bestiary (${lang}) did not give the menu its height back`);
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
  await host(wide);
  const wideFrame = await mount(wide, 966, `${base}?embed=1&lang=pl&level=split-brain`);
  await wideFrame.locator('.dialog .btn-primary').waitFor();
  await dialogFits(wideFrame, 'the split-brain briefing at 966 px');

  // Duel: a new duel on a phone. Pick the Siege meadow, build one Archer, let the sparring waves
  // through and get the challenge link; it carries the Archer and reads back as a challenge.
  const duel = await browser.newPage({ viewport: { width: 360, height: 740 } });
  duel.on('pageerror', (e) => errors.push(e.message));
  await duel.goto(`${base}?lang=en&mode=duel`);
  await duel.locator('.dialog .duel-map[data-map="siege"]').click();
  await duel.locator('.dialog .btn-primary').click();
  const duelBox = (await duel.locator('#board').boundingBox()) ?? fail('no duel board');
  const duelCell = duelBox.width / 16;
  await duel.keyboard.press('1');
  // Touch-free: a mouse click builds at once. Cell (3, 3) is meadow floor.
  await duel.mouse.click(duelBox.x + 3.5 * duelCell, duelBox.y + 3.5 * duelCell);
  await duel.keyboard.press('Escape');
  await duel.locator('#speed').click();
  await duel.locator('#speed').click();
  await duel.locator('#start-wave').click();
  // During the wave a move is refused: a replay could not repeat it.
  await duel.keyboard.press('1');
  await duel.mouse.click(duelBox.x + 4.5 * duelCell, duelBox.y + 3.5 * duelCell);
  const waits = await duel.locator('#toast').textContent();
  if (waits !== 'In a duel, moves wait until the wave is over.')
    fail(`a move during a duel wave said "${waits}"`);
  await duel.keyboard.press('Escape');
  await duel.locator('.dialog .duel-link').waitFor({ timeout: 120_000 });
  const link = await duel.locator('.dialog .duel-link').inputValue();
  if (!link.startsWith(`${base}?lang=en#duel=1~1~s~p33...`)) fail(`the challenge link is ${link}`);
  const wideDuel = await duel.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  if (wideDuel > 0) fail(`the duel share dialog scrolls sideways by ${wideDuel} px at 360 px`);
  // Copy: either the clipboard takes it, or the link field gets the focus to copy by hand.
  await duel.locator('.dialog .btn-primary').click();
  await duel.locator('.dialog [role="status"]:not(:empty)').waitFor();
  const copied = await duel.evaluate(() => ({
    status: document.querySelector('.dialog [role="status"]')?.textContent,
    focus: document.activeElement?.id,
  }));
  if (copied.status !== 'Link copied.' && copied.focus !== 'duel-link')
    fail(`copying the link said "${copied.status}" and left the focus on ${copied.focus}`);

  console.info(
    `Smoke test passed: unlock path checked, level played, Siege opened, accessibility checks, embed height ${height}px, narrow embed fits, dialogs fit the frame, duel challenge link made.`,
  );
} finally {
  await browser.close();
  server.httpServer.close();
}
if (errors.length) {
  console.error(`Page errors:\n${errors.join('\n')}`);
  process.exit(1);
}

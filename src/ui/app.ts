// The application: menu, briefing, play screen, results and help. Owns the game loop (fixed 30 Hz
// simulation, rendering every animation frame) and all input: mouse, touch and keyboard.
import { Game, type GameEvent } from '../engine/game';
import { tileAt } from '../engine/grid';
import { DT, ENEMIES, TOWERS } from '../engine/stats';
import {
  ENEMY_KINDS,
  TARGET_MODES,
  type Cell,
  type EnemyKind,
  type LevelDef,
  type PlaceError,
  type TowerKind,
} from '../engine/types';
import { LEVELS } from '../levels/levels';
import { BoardRenderer, type BoardView } from '../render/board';
import { readPalette, type Palette } from '../render/palette';
import { drawEnemy, drawTower } from '../render/sprites';
import { strings, type Lang, type Strings } from './i18n';
import { loadProgress, recordResult, starsFor, type Progress } from './progress';

export interface AppOptions {
  lang: Lang;
  embed: boolean;
  reducedMotion: boolean;
  /** Level to open straight away (`?level=`), skipping the menu. */
  startLevel?: string;
}

type Info =
  | { type: 'kind'; kind: TowerKind }
  | { type: 'tower'; id: number }
  | { type: 'enemy'; kind: EnemyKind }
  | null;

const SPEEDS = [1, 2, 3] as const;
const REPO_URL = 'https://github.com/Aberratio/relay-defense';

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} missing`);
  return el;
}

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: { class?: string; text?: string; attrs?: Record<string, string> } = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props.class) el.className = props.class;
  if (props.text !== undefined) el.textContent = props.text;
  for (const [k, v] of Object.entries(props.attrs ?? {})) el.setAttribute(k, v);
  for (const c of children) el.append(c);
  return el;
}

function fmt(n: number, digits = 1): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(digits);
}

/** Which tower and enemy kinds a level shows for the first time. */
export function newKinds(index: number): { towers: TowerKind[]; enemies: EnemyKind[] } {
  const seenT = new Set<TowerKind>();
  const seenE = new Set<EnemyKind>();
  LEVELS.slice(0, index).forEach((l) => {
    l.towers.forEach((t) => seenT.add(t));
    l.waves.forEach((w) => w.groups.forEach((g) => seenE.add(g.enemy)));
  });
  const level = LEVELS[index];
  if (!level) return { towers: [], enemies: [] };
  const enemies = new Set<EnemyKind>();
  level.waves.forEach((w) => w.groups.forEach((g) => enemies.add(g.enemy)));
  return {
    towers: level.towers.filter((t) => !seenT.has(t)),
    enemies: ENEMY_KINDS.filter((e) => enemies.has(e) && !seenE.has(e)),
  };
}

export class App {
  private lang: Lang;
  private t: Strings;
  private palette: Palette;
  private renderer: BoardRenderer;
  private canvas: HTMLCanvasElement;
  private progress: Progress;
  private game: Game | null = null;
  private levelIndex = 0;
  private selectedKind: TowerKind | null = null;
  private selectedTower: number | null = null;
  private info: Info = null;
  private hover: Cell | null = null;
  private cursor: Cell | null = null;
  private keyboardCursor = false;
  private armedTouch: string | null = null;
  private speedIndex = 0;
  private paused = false;
  private acc = 0;
  private last = 0;
  private resultTimer = 0;
  private toastTimer = 0;
  private dialogKind: 'brief' | 'result' | 'help' | null = null;
  /** The element that had focus when a dialog opened, to return to on close. */
  private opener: HTMLElement | null = null;
  private infoRefresh = 0;
  private hud = { lives: -1, credits: -1, wave: '' };
  private ghostCache: {
    key: string;
    valid: boolean;
    routes: Cell[][] | null;
    error: PlaceError | null;
  } | null = null;

  constructor(private opts: AppOptions) {
    this.lang = opts.lang;
    this.t = strings(this.lang);
    this.palette = readPalette();
    this.canvas = $('board') as HTMLCanvasElement;
    this.renderer = new BoardRenderer(this.canvas, this.palette, opts.reducedMotion);
    this.progress = loadProgress();
  }

  start(): void {
    this.bindStatic();
    this.applyLang(this.lang);
    const start = this.opts.startLevel
      ? LEVELS.findIndex((l) => l.id === this.opts.startLevel)
      : -1;
    if (start >= 0) this.openLevel(start);
    else this.showMenu();
    requestAnimationFrame((ts) => this.frame(ts));
  }

  // ---- Static wiring ---------------------------------------------------------------------

  private bindStatic(): void {
    $('home').addEventListener('click', () => this.showMenu());
    $('help-open').addEventListener('click', () => this.openHelp());
    $('restart').addEventListener('click', () => this.openLevel(this.levelIndex, false));
    $('pause').addEventListener('click', () => this.togglePause());
    $('speed').addEventListener('click', () => this.cycleSpeed());
    $('start-wave').addEventListener('click', () => this.startWave());
    for (const btn of $('lang-switch').querySelectorAll<HTMLButtonElement>('button[data-lang]')) {
      btn.addEventListener('click', () => this.applyLang(btn.dataset.lang === 'pl' ? 'pl' : 'en'));
    }
    $('overlay').addEventListener('click', (e) => {
      if (e.target === $('overlay') && this.dialogKind === 'help') this.closeDialog();
    });

    const c = this.canvas;
    c.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      this.keyboardCursor = false;
      this.setHover(this.renderer.cellAt(e.clientX, e.clientY));
    });
    c.addEventListener('pointerleave', (e) => {
      if (e.pointerType !== 'touch' && !this.keyboardCursor) this.setHover(null);
    });
    c.addEventListener('pointerup', (e) => {
      // Only the primary button acts: a right click cancels (contextmenu), it never builds.
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const cell = this.renderer.cellAt(e.clientX, e.clientY);
      if (!cell) return;
      const tower = this.game?.towerAt(cell.x, cell.y);
      if (e.pointerType === 'touch' && this.selectedKind && !tower) {
        // Touch: the first tap previews the placement, a second tap on the same tile builds.
        const key = `${cell.x},${cell.y}`;
        this.setHover(cell);
        if (this.armedTouch !== key) {
          this.armedTouch = key;
          const ghost = this.ghost();
          if (ghost && !ghost.valid && ghost.error) this.toast(this.t.placeErrors[ghost.error]);
          return;
        }
        this.armedTouch = null;
      }
      this.actOn(cell);
    });
    c.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.cancel();
    });
    c.addEventListener('keydown', (e) => this.boardKey(e));
    c.addEventListener('blur', () => {
      if (this.keyboardCursor) {
        this.keyboardCursor = false;
        this.setHover(null);
      }
    });
    document.addEventListener('keydown', (e) => this.globalKey(e));
    new ResizeObserver(() => this.renderer.resize()).observe(c);
  }

  private applyLang(lang: Lang): void {
    this.lang = lang;
    this.t = strings(lang);
    document.documentElement.lang = lang;
    for (const el of document.querySelectorAll<HTMLElement>('[data-i18n]')) {
      const key = el.dataset.i18n as keyof Strings;
      const value = this.t[key];
      if (typeof value === 'string') el.textContent = value;
    }
    $('home').title = this.t.menu;
    $('help-open').setAttribute('aria-label', this.t.help);
    $('help-open').title = this.t.help;
    $('lang-switch').setAttribute('aria-label', this.t.langLabel);
    for (const btn of $('lang-switch').querySelectorAll<HTMLButtonElement>('button')) {
      btn.setAttribute('aria-pressed', String(btn.dataset.lang === lang));
    }
    this.canvas.setAttribute('aria-label', this.t.boardLabel);
    this.renderLevels();
    if (this.game) {
      $('level-name').textContent = this.levelTitle(this.levelIndex);
      this.renderPalette();
      this.renderInfo();
      this.renderWaves();
      this.renderControls();
    }
    if (this.dialogKind === 'help') this.openHelp();
    else if (this.dialogKind === 'brief') this.openBrief();
    else if (this.dialogKind === 'result') this.openResult();
  }

  private levelTitle(index: number): string {
    const level = LEVELS[index];
    return level
      ? `${index + 1}. ${this.t.levelCopy[level.id as keyof Strings['levelCopy']].name}`
      : '';
  }

  private copyOf(level: LevelDef) {
    return this.t.levelCopy[level.id as keyof Strings['levelCopy']];
  }

  // ---- Screens ---------------------------------------------------------------------------

  private showMenu(): void {
    this.closeDialog();
    window.clearTimeout(this.resultTimer);
    this.game = null;
    $('menu').hidden = false;
    $('game').hidden = true;
    $('stats').hidden = true;
    $('controls').hidden = true;
    $('level-name').textContent = '';
    this.renderLevels();
  }

  private renderLevels(): void {
    const list = $('levels');
    list.replaceChildren(
      ...LEVELS.map((level, i) => {
        const copy = this.copyOf(level);
        const stars = this.progress[level.id] ?? 0;
        const played = level.id in this.progress;
        const fresh = newKinds(i);
        const icons = h('span', { class: 'level-icons', attrs: { 'aria-hidden': 'true' } }, [
          ...fresh.towers.map((k) => this.towerIcon(k, 22)),
          ...fresh.enemies.map((k) => this.enemyIcon(k, 22)),
        ]);
        const btn = h('button', { class: 'level-card', attrs: { type: 'button' } }, [
          h('span', { class: 'level-num', text: String(i + 1).padStart(2, '0') }),
          h('span', { class: 'level-body' }, [
            h('span', { class: 'level-title', text: copy.name }),
            h('span', { class: 'level-brief', text: copy.brief }),
          ]),
          h('span', { class: 'level-side' }, [
            icons,
            this.starsEl(stars, played ? this.t.starsLabel(stars) : this.t.notPlayed),
          ]),
        ]);
        btn.addEventListener('click', () => this.openLevel(i));
        return h('li', {}, [btn]);
      }),
    );
  }

  private starsEl(n: number, label: string): HTMLElement {
    const el = h('span', { class: 'stars', attrs: { role: 'img', 'aria-label': label } });
    for (let i = 0; i < 3; i++)
      el.append(h('span', { class: i < n ? 'star on' : 'star', attrs: { 'aria-hidden': 'true' } }));
    return el;
  }

  private openLevel(index: number, brief = true): void {
    const level = LEVELS[index];
    if (!level) return;
    window.clearTimeout(this.resultTimer);
    this.closeDialog();
    this.levelIndex = index;
    this.game = new Game(level);
    this.renderer.setGame(this.game);
    this.selectedKind = null;
    this.selectedTower = null;
    this.info = null;
    this.paused = false;
    this.acc = 0;
    this.hud = { lives: -1, credits: -1, wave: '' };
    this.cursor = { ...this.game.grid.core };
    this.hover = null;
    this.keyboardCursor = false;
    this.armedTouch = null;
    this.ghostCache = null;
    window.clearTimeout(this.toastTimer);
    $('toast').hidden = true;
    $('menu').hidden = true;
    $('game').hidden = false;
    $('stats').hidden = false;
    $('controls').hidden = false;
    $('level-name').textContent = this.levelTitle(index);
    this.renderer.resize();
    this.renderPalette();
    this.renderInfo();
    this.renderWaves();
    this.renderControls();
    this.refreshHud();
    if (brief) this.openBrief();
    else this.canvas.focus({ preventScroll: true });
  }

  // ---- Dialogs ---------------------------------------------------------------------------

  private showDialog(
    kind: 'brief' | 'result' | 'help',
    content: Node[],
    focus?: HTMLElement,
  ): void {
    if (!this.dialogKind) {
      const active = document.activeElement;
      this.opener = active instanceof HTMLElement && active !== document.body ? active : null;
    }
    this.dialogKind = kind;
    const dialog = $('dialog');
    dialog.className = `dialog dialog-${kind}`;
    dialog.replaceChildren(...content);
    $('overlay').hidden = false;
    this.setInert(true);
    (focus ?? dialog.querySelector<HTMLElement>('button'))?.focus({ preventScroll: true });
    // In a frame the page around it scrolls, not the frame: bring the dialog into view.
    if (this.opts.embed) dialog.scrollIntoView({ block: 'nearest' });
  }

  private closeDialog(): void {
    if (!this.dialogKind) return;
    this.dialogKind = null;
    $('overlay').hidden = true;
    this.setInert(false);
    const back = this.opener?.isConnected && !this.opener.closest('[hidden]') ? this.opener : null;
    this.opener = null;
    if (this.game) this.canvas.focus({ preventScroll: true });
    else back?.focus({ preventScroll: true });
  }

  /** Everything behind an open dialog is out of reach for focus and assistive technology. */
  private setInert(on: boolean): void {
    for (const el of document.querySelectorAll<HTMLElement>('#app > header, #app > main')) {
      el.inert = on;
    }
  }

  private openBrief(): void {
    const level = LEVELS[this.levelIndex];
    if (!level) return;
    const copy = this.copyOf(level);
    const fresh = newKinds(this.levelIndex);
    const items = [
      ...fresh.towers.map((k) =>
        this.entry(this.towerIcon(k, 40), this.t.towers[k].name, this.t.towers[k].text),
      ),
      ...fresh.enemies.map((k) =>
        this.entry(this.enemyIcon(k, 40), this.t.enemies[k].name, this.t.enemies[k].text),
      ),
    ];
    const go = h('button', {
      class: 'btn btn-primary',
      text: this.t.begin,
      attrs: { type: 'button' },
    });
    go.addEventListener('click', () => this.closeDialog());
    this.showDialog(
      'brief',
      [
        h('p', {
          class: 'dialog-eyebrow',
          text: `${this.t.level} ${this.levelIndex + 1} / ${LEVELS.length}`,
        }),
        h('h2', { text: copy.name, attrs: { id: 'dialog-title' } }),
        h('p', { class: 'dialog-lead', text: copy.brief }),
        h('div', { class: 'dialog-focus' }, [
          h('strong', { text: this.t.newHere }),
          h('p', { text: copy.focus }),
        ]),
        ...(items.length ? [h('ul', { class: 'entries' }, items)] : []),
        h('div', { class: 'dialog-actions' }, [go]),
      ],
      go,
    );
  }

  private entry(icon: HTMLElement, name: string, text: string): HTMLElement {
    return h('li', { class: 'entry' }, [
      icon,
      h('div', {}, [h('strong', { text: name }), h('p', { text })]),
    ]);
  }

  private openHelp(): void {
    const close = h('button', {
      class: 'btn btn-ghost',
      text: this.t.close,
      attrs: { type: 'button' },
    });
    close.addEventListener('click', () => this.closeDialog());
    const keys = h(
      'dl',
      { class: 'keys' },
      this.t.keys.flatMap(([k, v]) => [h('dt', {}, [h('kbd', { text: k })]), h('dd', { text: v })]),
    );
    const source = h('a', {
      text: this.t.source,
      attrs: { href: REPO_URL, target: '_blank', rel: 'noopener' },
    });
    this.showDialog('help', [
      h('h2', { text: this.t.howTitle, attrs: { id: 'dialog-title' } }),
      h(
        'ol',
        { class: 'how' },
        this.t.how.map((line) => h('li', { text: line })),
      ),
      h('p', { class: 'dialog-note', text: this.t.starsRule }),
      h('h3', { text: this.t.keysTitle }),
      keys,
      h('div', { class: 'dialog-actions' }, [
        // In the portfolio frame the page around it already links the repository.
        ...(this.opts.embed ? [] : [h('p', { class: 'dialog-note' }, [source])]),
        close,
      ]),
    ]);
  }

  private openResult(): void {
    const game = this.game;
    if (!game) return;
    const won = game.phase === 'won';
    const stars = won ? starsFor(game.lives, game.maxLives) : 0;
    const actions: HTMLElement[] = [];
    const next = LEVELS[this.levelIndex + 1];
    const button = (text: string, cls: string, run: () => void) => {
      const b = h('button', { class: `btn ${cls}`, text, attrs: { type: 'button' } });
      b.addEventListener('click', run);
      actions.push(b);
      return b;
    };
    let primary: HTMLElement;
    if (won && next)
      primary = button(this.t.nextLevel, 'btn-primary', () => this.openLevel(this.levelIndex + 1));
    else
      primary = button(won ? this.t.replay : this.t.tryAgain, 'btn-primary', () =>
        this.openLevel(this.levelIndex, false),
      );
    if (won && next)
      button(this.t.replay, 'btn-ghost', () => this.openLevel(this.levelIndex, false));
    button(this.t.backToLevels, 'btn-ghost', () => this.showMenu());
    const text = won
      ? this.t.victoryText(game.lives, game.maxLives)
      : this.t.defeatText(game.wave + 1, game.waveCount);
    this.showDialog(
      'result',
      [
        h('p', { class: 'dialog-eyebrow', text: this.levelTitle(this.levelIndex) }),
        h('h2', { text: won ? this.t.victory : this.t.defeat, attrs: { id: 'dialog-title' } }),
        ...(won ? [this.starsEl(stars, this.t.starsLabel(stars))] : []),
        h('p', { class: 'dialog-lead', text }),
        ...(won && !next ? [h('p', { class: 'dialog-note', text: this.t.allDone })] : []),
        ...(!won ? [h('p', { class: 'dialog-note', text: this.t.defeatHint })] : []),
        h('div', { class: 'dialog-actions' }, actions),
      ],
      primary,
    );
    $('dialog').classList.add(won ? 'is-won' : 'is-lost');
  }

  // ---- Panels ----------------------------------------------------------------------------

  private towerIcon(kind: TowerKind, size: number, level = 0): HTMLCanvasElement {
    return this.icon(size, (ctx, s) =>
      drawTower(ctx, { kind, level, angle: -Math.PI / 4, time: 0.6, recoil: 0 }, s, this.palette),
    );
  }

  private enemyIcon(kind: EnemyKind, size: number): HTMLCanvasElement {
    const r = Math.min(0.36, ENEMIES[kind].radius * 1.15);
    return this.icon(size, (ctx, s) =>
      drawEnemy(
        ctx,
        { kind, r: r * s, heading: -Math.PI / 2, time: 0.4, revealed: true, flash: 0 },
        this.palette,
      ),
    );
  }

  private icon(
    size: number,
    draw: (ctx: CanvasRenderingContext2D, s: number) => void,
  ): HTMLCanvasElement {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const c = h('canvas', {
      class: 'icon',
      attrs: { 'aria-hidden': 'true', width: String(size * dpr), height: String(size * dpr) },
    });
    c.style.width = `${size}px`;
    c.style.height = `${size}px`;
    const ctx = c.getContext('2d');
    if (ctx) {
      ctx.translate((size * dpr) / 2, (size * dpr) / 2);
      draw(ctx, size * dpr);
    }
    return c;
  }

  private renderPalette(): void {
    const game = this.game;
    if (!game) return;
    const pal = $('palette');
    pal.replaceChildren(
      ...game.level.towers.map((kind, i) => {
        const btn = h('button', { class: 'tool', attrs: { type: 'button', 'data-kind': kind } }, [
          this.towerIcon(kind, 34),
          h('span', { class: 'tool-name', text: this.t.towers[kind].name }),
          h('span', { class: 'tool-cost', text: String(TOWERS[kind].levels[0].cost) }),
          h('kbd', { class: 'tool-key', text: String(i + 1) }),
        ]);
        btn.addEventListener('click', () => this.pickKind(kind));
        return btn;
      }),
    );
    this.updatePalette();
  }

  private updatePalette(): void {
    const game = this.game;
    if (!game) return;
    for (const btn of $('palette').querySelectorAll<HTMLButtonElement>('.tool')) {
      const kind = btn.dataset.kind as TowerKind;
      btn.setAttribute('aria-pressed', String(this.selectedKind === kind));
      btn.classList.toggle('is-poor', game.credits < TOWERS[kind].levels[0].cost);
    }
  }

  private pickKind(kind: TowerKind | null): void {
    this.selectedKind = this.selectedKind === kind ? null : kind;
    this.selectedTower = null;
    this.armedTouch = null;
    this.info = this.selectedKind ? { type: 'kind', kind: this.selectedKind } : null;
    this.ghostCache = null;
    this.updatePalette();
    this.renderInfo();
  }

  private selectTower(id: number | null): void {
    this.selectedTower = id;
    this.selectedKind = null;
    this.info = id !== null ? { type: 'tower', id } : null;
    this.updatePalette();
    this.renderInfo();
  }

  private statRows(kind: TowerKind, level: number, next?: number): HTMLElement {
    const spec = TOWERS[kind];
    const l = spec.levels[level] ?? spec.levels[0];
    const n = next !== undefined ? spec.levels[next] : undefined;
    const rows: [string, string, string?][] = [];
    const pair = (label: string, a: number, b: number | undefined, f: (v: number) => string) =>
      rows.push([label, f(a), b !== undefined && b !== a ? f(b) : undefined]);
    if (!spec.passive) {
      pair(this.t.damage, l.damage, n?.damage, (v) => fmt(v));
      pair(this.t.rate, l.rate, n?.rate, (v) => fmt(v, 2));
    }
    if (kind !== 'wall')
      pair(kind === 'beacon' ? this.t.reveal : this.t.range, l.range, n?.range, (v) => fmt(v));
    if (kind === 'arc') pair(this.t.chain, l.special, n?.special, (v) => fmt(v));
    if (kind === 'mortar') {
      pair(this.t.blast, l.special, n?.special, (v) => fmt(v, 2));
      rows.push([this.t.deadZone, fmt(spec.minRange ?? 0)]);
    }
    if (kind === 'throttle')
      pair(this.t.slow, l.special, n?.special, (v) => `${Math.round(v * 100)}%`);
    if (kind === 'beacon')
      pair(this.t.boost, l.special, n?.special, (v) => `+${Math.round(v * 100)}%`);
    if (kind === 'lance') rows.push([this.t.armour, this.t.ignoresArmour]);
    return h(
      'dl',
      { class: 'stat-rows' },
      rows.flatMap(([label, a, b]) => [
        h('dt', { text: label }),
        h('dd', {}, b ? [a, h('span', { class: 'next', text: ` → ${b}` })] : [a]),
      ]),
    );
  }

  /** Rebuilds the info panel and keeps keyboard focus on the matching control. */
  private renderInfo(): void {
    const panel = $('info');
    const active = document.activeElement;
    const key =
      active instanceof HTMLElement && panel.contains(active)
        ? (active.dataset.role ?? active.dataset.mode ?? null)
        : null;
    this.buildInfo();
    if (key) {
      const again = panel.querySelector<HTMLElement>(`[data-role="${key}"], [data-mode="${key}"]`);
      if (again && !(again as HTMLButtonElement).disabled) again.focus({ preventScroll: true });
      else this.canvas.focus({ preventScroll: true });
    }
  }

  private buildInfo(): void {
    const panel = $('info');
    const game = this.game;
    const info = this.info;
    if (!game || !info) {
      panel.replaceChildren(h('p', { class: 'hint', text: this.t.selectHint }));
      return;
    }
    if (info.type === 'kind') {
      const kind = info.kind;
      panel.replaceChildren(
        h('div', { class: 'info-head' }, [
          this.towerIcon(kind, 40),
          h('div', {}, [
            h('h3', { text: this.t.towers[kind].name }),
            h('p', { class: 'info-meta', text: `${this.t.cost} ${TOWERS[kind].levels[0].cost}` }),
          ]),
        ]),
        h('p', { class: 'info-text', text: this.t.towers[kind].text }),
        this.statRows(kind, 0),
      );
      return;
    }
    if (info.type === 'enemy') {
      const kind = info.kind;
      const spec = ENEMIES[kind];
      const hp = Math.round(spec.hp * (game.level.hpScale ?? 1));
      panel.replaceChildren(
        h('div', { class: 'info-head' }, [
          this.enemyIcon(kind, 40),
          h('div', {}, [h('h3', { text: this.t.enemies[kind].name }), this.traitsEl(kind)]),
        ]),
        h('p', { class: 'info-text', text: this.t.enemies[kind].text }),
        h(
          'dl',
          { class: 'stat-rows' },
          (
            [
              [this.t.hp, `${hp}+`],
              [this.t.speedStat, fmt(spec.speed, 2)],
              [this.t.armour, String(spec.armour)],
              [this.t.leak, String(spec.leak)],
              [this.t.bounty, String(spec.bounty)],
            ] as const
          ).flatMap(([a, b]) => [h('dt', { text: a }), h('dd', { text: b })]),
        ),
      );
      return;
    }
    const tower = game.towerById(info.id);
    if (!tower) {
      this.info = null;
      this.selectedTower = null;
      this.renderInfo();
      return;
    }
    const spec = TOWERS[tower.kind];
    const cost = game.upgradeCost(tower);
    const upgrade = h('button', {
      class: 'btn btn-primary',
      attrs: { type: 'button', 'data-role': 'upgrade' },
    });
    upgrade.addEventListener('click', () => this.upgradeSelected());
    const sell = h('button', {
      class: 'btn btn-ghost',
      attrs: { type: 'button', 'data-role': 'sell' },
    });
    sell.addEventListener('click', () => this.sellSelected());
    const children: Node[] = [
      h('div', { class: 'info-head' }, [
        this.towerIcon(tower.kind, 40, tower.level),
        h('div', {}, [
          h('h3', { text: this.t.towers[tower.kind].name }),
          h('p', {
            class: 'info-meta',
            text: `${this.t.level} ${tower.level + 1} / ${spec.levels.length}`,
          }),
        ]),
      ]),
      this.statRows(tower.kind, tower.level, cost !== null ? tower.level + 1 : undefined),
    ];
    if (!spec.passive) {
      const modes = h('div', {
        class: 'modes',
        attrs: { role: 'group', 'aria-label': this.t.target },
      });
      for (const mode of TARGET_MODES) {
        const b = h('button', {
          class: 'mode',
          text: this.t.modes[mode],
          attrs: {
            type: 'button',
            'data-mode': mode,
            'aria-pressed': String(tower.mode === mode),
            title: this.t.modeHelp[mode],
          },
        });
        b.addEventListener('click', () => {
          game.setMode(tower.id, mode);
          this.renderInfo();
        });
        modes.append(b);
      }
      children.push(h('p', { class: 'info-label', text: this.t.target }), modes);
      children.push(h('p', { class: 'info-meta', attrs: { 'data-role': 'boost' } }));
      children.push(h('p', { class: 'info-meta', attrs: { 'data-role': 'dealt' } }));
    }
    children.push(
      h('div', { class: 'info-actions' }, [spec.levels.length > 1 ? upgrade : h('span'), sell]),
    );
    panel.replaceChildren(...children);
    this.updateInfo();
  }

  /** Refreshes the numbers and button states of the selected tower without rebuilding the panel. */
  private updateInfo(): void {
    const game = this.game;
    if (!game || this.info?.type !== 'tower') return;
    const tower = game.towerById(this.info.id);
    if (!tower) return;
    const panel = $('info');
    const upgrade = panel.querySelector<HTMLButtonElement>('[data-role="upgrade"]');
    const cost = game.upgradeCost(tower);
    const over = game.phase === 'won' || game.phase === 'lost';
    if (upgrade) {
      upgrade.textContent = cost === null ? this.t.maxed : `${this.t.upgrade} · ${cost}`;
      upgrade.disabled = cost === null || cost > game.credits || over;
    }
    const sell = panel.querySelector<HTMLButtonElement>('[data-role="sell"]');
    if (sell) {
      const value = game.sellValue(tower);
      sell.textContent = `${tower.lockedCredits === 0 ? this.t.undo : this.t.sell} · +${value}`;
      const blocked = game.canSell(tower);
      sell.disabled = blocked !== null;
      sell.title = blocked === 'wave' ? this.t.placeErrors.wave : '';
    }
    const boost = panel.querySelector<HTMLElement>('[data-role="boost"]');
    if (boost) {
      const b = Math.round(game.boost(tower) * 100);
      boost.textContent = b > 0 ? this.t.boosted(b) : '';
      boost.hidden = b === 0;
    }
    const dealt = panel.querySelector<HTMLElement>('[data-role="dealt"]');
    if (dealt)
      dealt.textContent = `${this.t.dealt}: ${Math.round(tower.damageDealt)} · ${this.t.kills}: ${tower.kills}`;
    // A control that just became disabled cannot keep focus: hand it to the board.
    const active = document.activeElement;
    if (active instanceof HTMLButtonElement && active.disabled && panel.contains(active)) {
      this.canvas.focus({ preventScroll: true });
    }
  }

  private traitsEl(kind: EnemyKind): HTMLElement {
    const spec = ENEMIES[kind];
    const tr = this.t.traits;
    const list: string[] = [];
    if (kind === 'colossus') list.push(tr.boss);
    if (spec.armour) list.push(tr.armour(spec.armour));
    if (spec.cloaked) list.push(tr.cloaked);
    if (spec.splitInto) list.push(tr.splits);
    if (spec.heal) list.push(tr.heals);
    if (spec.speed >= 2) list.push(tr.fast);
    return h(
      'span',
      { class: 'traits' },
      list.map((x) => h('span', { class: 'trait', text: x })),
    );
  }

  private renderWaves(): void {
    const active = document.activeElement;
    const foe = active instanceof HTMLElement ? active.dataset.foe : undefined;
    this.buildWaves();
    if (foe) {
      const again = $('wave-next').querySelector<HTMLElement>(`[data-foe="${foe}"]`);
      (again ?? this.canvas).focus({ preventScroll: true });
    }
  }

  private buildWaves(): void {
    const game = this.game;
    if (!game) return;
    const t = this.t;
    const running = game.phase === 'wave';
    const done = game.phase === 'won' || game.wave >= game.waveCount;
    const idx = Math.min(game.wave, game.waveCount - 1);
    $('wave-title').textContent = done
      ? t.noMoreWaves
      : `${running ? t.waveRunning : idx === game.waveCount - 1 ? t.lastWave : t.nextWave} · ${idx + 1}/${game.waveCount}`;
    const start = $('start-wave') as HTMLButtonElement;
    start.textContent = t.startWave;
    start.disabled = game.phase !== 'build';
    start.hidden = done || game.phase === 'lost';
    $('wave-progress').hidden = !running;

    const groupsOf = (i: number) => {
      const counts = new Map<EnemyKind, number>();
      for (const g of game.level.waves[i]?.groups ?? []) {
        counts.set(g.enemy, (counts.get(g.enemy) ?? 0) + g.count);
      }
      return [...counts.entries()];
    };
    $('wave-next').replaceChildren(
      ...(done
        ? []
        : groupsOf(idx).map(([kind, count]) => {
            const b = h('button', { class: 'foe', attrs: { type: 'button', 'data-foe': kind } }, [
              this.enemyIcon(kind, 30),
              h('span', { class: 'foe-name', text: t.enemies[kind].name }),
              h('span', { class: 'foe-count', text: `× ${count}` }),
              this.traitsEl(kind),
            ]);
            b.addEventListener('click', () => {
              this.selectedKind = null;
              this.selectedTower = null;
              this.info = { type: 'enemy', kind };
              this.updatePalette();
              this.renderInfo();
            });
            return h('li', {}, [b]);
          })),
    );
    const later: HTMLElement[] = [];
    for (let i = idx + 1; i < game.waveCount; i++) {
      later.push(
        h('li', {}, [
          h('span', { class: 'later-num', text: String(i + 1) }),
          ...groupsOf(i).map(([kind, count]) =>
            h('span', { class: 'later-foe', attrs: { title: t.enemies[kind].name } }, [
              this.enemyIcon(kind, 18),
              h('span', { text: `${count}` }),
            ]),
          ),
        ]),
      );
    }
    $('wave-later').replaceChildren(...later);
    $('later-title').hidden = later.length === 0;
  }

  private renderControls(): void {
    const speed = $('speed');
    speed.replaceChildren(
      h('span', { class: 'btn-label', text: `${this.t.speed} ` }),
      `${this.speed()}×`,
    );
    speed.setAttribute('aria-label', `${this.t.speed} ${this.speed()}×`);
    $('pause').textContent = this.paused ? this.t.resume : this.t.pause;
    $('pause').setAttribute('aria-pressed', String(this.paused));
    const badge = $('paused-badge');
    badge.textContent = this.t.paused;
    badge.hidden = !this.paused;
  }

  private refreshHud(): void {
    const game = this.game;
    if (!game) return;
    const wave = this.t.waveOf(Math.min(game.wave + 1, game.waveCount), game.waveCount);
    if (game.lives !== this.hud.lives) {
      ($('stat-lives').querySelector('.stat-value') as HTMLElement).textContent =
        `${game.lives}/${game.maxLives}`;
      $('stat-lives').classList.toggle('is-low', game.lives * 2 < game.maxLives);
      if (this.hud.lives > game.lives) {
        $('stat-lives').classList.remove('is-hit');
        void $('stat-lives').offsetWidth;
        $('stat-lives').classList.add('is-hit');
      }
    }
    if (game.credits !== this.hud.credits) {
      ($('stat-credits').querySelector('.stat-value') as HTMLElement).textContent = String(
        game.credits,
      );
      this.updatePalette();
      this.updateInfo();
    }
    if (wave !== this.hud.wave)
      ($('stat-wave').querySelector('.stat-value') as HTMLElement).textContent = wave;
    this.hud = { lives: game.lives, credits: game.credits, wave };
    if (game.phase === 'wave') {
      const left = game.enemies.length + game.toSpawn();
      const bar = $('wave-progress').firstElementChild as HTMLElement;
      const total = Math.max(
        1,
        game.level.waves[game.wave]?.groups.reduce((n, g) => n + g.count, 0) ?? 1,
      );
      $('wave-progress').title = this.t.remaining(left);
      bar.style.width = `${Math.max(0, Math.min(100, (left / total) * 100))}%`;
    }
  }

  // ---- Commands --------------------------------------------------------------------------

  private startWave(): void {
    const game = this.game;
    if (!game || game.phase !== 'build' || this.dialogKind) return;
    game.startWave();
    this.paused = false;
    this.renderControls();
    this.flush();
  }

  private togglePause(): void {
    if (!this.game || this.game.phase !== 'wave') return;
    this.paused = !this.paused;
    this.renderControls();
  }

  private speed(): number {
    return SPEEDS[this.speedIndex] ?? 1;
  }

  private cycleSpeed(): void {
    this.speedIndex = (this.speedIndex + 1) % SPEEDS.length;
    this.renderControls();
  }

  private cancel(): void {
    if (this.selectedKind) this.pickKind(null);
    else if (this.selectedTower !== null || this.info) this.selectTower(null);
  }

  private actOn(cell: Cell): void {
    const game = this.game;
    if (!game || this.dialogKind) return;
    const tower = game.towerAt(cell.x, cell.y);
    // An agent on the tile is selected, whatever kind is picked for building.
    if (tower) {
      this.selectTower(tower.id);
      return;
    }
    if (this.selectedKind) {
      const error = game.canPlace(this.selectedKind, cell.x, cell.y);
      if (error) {
        this.toast(this.t.placeErrors[error]);
        return;
      }
      game.place(this.selectedKind, cell.x, cell.y);
      this.ghostCache = null;
      this.flush();
      return;
    }
    this.selectTower(null);
  }

  private upgradeSelected(): void {
    const game = this.game;
    if (!game || this.selectedTower === null) return;
    if (game.upgrade(this.selectedTower)) {
      this.flush();
      this.renderInfo();
    }
  }

  private sellSelected(): void {
    const game = this.game;
    if (!game || this.selectedTower === null) return;
    const tower = game.towerById(this.selectedTower);
    const blocked = tower ? game.canSell(tower) : null;
    if (blocked) {
      this.toast(this.t.placeErrors[blocked]);
      return;
    }
    if (game.sell(this.selectedTower)) {
      this.ghostCache = null;
      this.flush();
      this.selectTower(null);
      this.canvas.focus({ preventScroll: true });
    }
  }

  /** Hands the pending events to the renderer and the UI. */
  private flush(): void {
    const game = this.game;
    if (!game) return;
    const events = game.drainEvents();
    if (events.length) this.onEvents(events);
  }

  private onEvents(events: GameEvent[]): void {
    const game = this.game;
    if (!game) return;
    this.renderer.handle(events);
    let waves = false;
    for (const e of events) {
      switch (e.type) {
        case 'waveStart':
          this.announce(this.t.announce.waveStart(e.wave + 1));
          waves = true;
          break;
        case 'waveClear':
          if (e.bonus > 0) this.announce(this.t.announce.waveClear(e.wave + 1, e.bonus));
          waves = true;
          this.paused = false;
          this.renderControls();
          break;
        case 'leak':
          this.announce(this.t.announce.leak(game.lives));
          break;
        case 'build':
          this.announce(this.t.announce.built(this.t.towers[e.kind].name));
          break;
        case 'upgrade': {
          const t = game.towerById(e.towerId);
          if (t) this.announce(this.t.announce.upgraded(this.t.towers[t.kind].name, e.level + 1));
          break;
        }
        case 'sell':
          this.announce(this.t.announce.sold(e.refund));
          break;
        case 'won':
        case 'lost':
          waves = true;
          this.finish(game);
          break;
        default:
          break;
      }
    }
    if (waves) {
      this.renderWaves();
      this.updateInfo();
    }
    this.refreshHud();
  }

  private finish(game: Game): void {
    if (game.phase === 'won')
      this.progress = recordResult(
        this.progress,
        game.level.id,
        starsFor(game.lives, game.maxLives),
      );
    window.clearTimeout(this.resultTimer);
    this.resultTimer = window.setTimeout(() => {
      if (this.game === game) this.openResult();
    }, 1100);
  }

  private toast(text: string): void {
    const el = $('toast');
    el.textContent = text;
    el.hidden = false;
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => (el.hidden = true), 2400);
  }

  private announce(text: string): void {
    const el = $('announcer');
    el.textContent = '';
    window.setTimeout(() => (el.textContent = text), 30);
  }

  // ---- Input -----------------------------------------------------------------------------

  private setHover(cell: Cell | null): void {
    if (cell?.x === this.hover?.x && cell?.y === this.hover?.y) return;
    this.hover = cell;
    this.ghostCache = null;
  }

  private ghost(): { valid: boolean; routes: Cell[][] | null; error: PlaceError | null } | null {
    const game = this.game;
    const cell = this.hover;
    const kind = this.selectedKind;
    if (!game || !cell || !kind) return null;
    const key = `${kind}:${cell.x},${cell.y}:${game.towers.length}:${game.credits}:${game.phase === 'wave' ? game.tick >> 2 : 0}`;
    if (this.ghostCache?.key === key) return this.ghostCache;
    const error = game.canPlace(kind, cell.x, cell.y);
    const routes = error ? null : game.routesWith(cell.x, cell.y);
    this.ghostCache = { key, valid: !error, routes, error };
    return this.ghostCache;
  }

  private boardKey(e: KeyboardEvent): void {
    const game = this.game;
    if (!game || this.dialogKind) return;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const move = moves[e.key];
    if (move) {
      e.preventDefault();
      const base =
        this.keyboardCursor && this.cursor
          ? this.cursor
          : (this.hover ?? this.cursor ?? game.grid.core);
      const next = {
        x: Math.max(0, Math.min(game.grid.width - 1, base.x + move[0])),
        y: Math.max(0, Math.min(game.grid.height - 1, base.y + move[1])),
      };
      this.cursor = next;
      this.keyboardCursor = true;
      this.setHover(next);
      const tower = game.towerAt(next.x, next.y);
      const what = tower
        ? this.t.towers[tower.kind].name
        : (this.t.tiles[tileAt(game.grid, next.x, next.y)] ?? '');
      this.announce(this.t.announce.cursor(next.x, next.y, what));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const cell = this.keyboardCursor ? this.cursor : this.hover;
      if (cell) this.actOn(cell);
    }
  }

  private globalKey(e: KeyboardEvent): void {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (this.dialogKind) {
      if (e.key === 'Escape' && this.dialogKind !== 'result') {
        e.preventDefault();
        this.closeDialog();
      }
      if (e.key === 'Tab') this.trapFocus(e);
      return;
    }
    const game = this.game;
    if (!game || e.repeat) return;
    const target = e.target as HTMLElement | null;
    const onButton = target?.tagName === 'BUTTON' || target?.tagName === 'A';
    const key = e.key.toLowerCase();
    if (/^[1-9]$/.test(e.key)) {
      const kind = game.level.towers[Number(e.key) - 1];
      if (kind) this.pickKind(kind);
      return;
    }
    switch (key) {
      case 'escape':
        this.cancel();
        break;
      case ' ':
        if (onButton) return;
        e.preventDefault();
        if (game.phase === 'build') this.startWave();
        else this.togglePause();
        break;
      case 'p':
        this.togglePause();
        break;
      case 'f':
        this.cycleSpeed();
        break;
      case 'u':
        this.upgradeSelected();
        break;
      case 's':
        this.sellSelected();
        break;
      case 't': {
        const tower = this.selectedTower !== null ? game.towerById(this.selectedTower) : undefined;
        if (tower && !TOWERS[tower.kind].passive) {
          const i = TARGET_MODES.indexOf(tower.mode);
          game.setMode(tower.id, TARGET_MODES[(i + 1) % TARGET_MODES.length] ?? 'first');
          this.renderInfo();
        }
        break;
      }
      default:
        break;
    }
  }

  private trapFocus(e: KeyboardEvent): void {
    const items = [...$('dialog').querySelectorAll<HTMLElement>('button, a[href]')];
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) return;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  // ---- Loop ------------------------------------------------------------------------------

  private frame(ts: number): void {
    const dt = this.last ? Math.min(0.1, (ts - this.last) / 1000) : 0;
    this.last = ts;
    const game = this.game;
    if (game) {
      const running =
        game.phase === 'wave' &&
        !this.paused &&
        this.dialogKind !== 'brief' &&
        this.dialogKind !== 'help';
      if (running) {
        this.acc += dt * this.speed();
        let steps = 0;
        while (this.acc >= DT && steps++ < 12) {
          this.renderer.snapshot();
          game.step();
          this.acc -= DT;
          const events = game.drainEvents();
          if (events.length) this.onEvents(events);
          if (game.phase !== 'wave') break;
        }
        if (game.phase !== 'wave') this.acc = 0;
        this.renderer.advance(dt * this.speed());
        if (ts - this.infoRefresh > 250) {
          this.infoRefresh = ts;
          this.updateInfo();
          this.refreshHud();
        }
      } else if (!this.paused) {
        this.renderer.advance(dt);
      }
      const ghost = this.ghost();
      const view: BoardView = {
        hover: this.hover,
        ghost:
          ghost && this.selectedKind
            ? { kind: this.selectedKind, valid: ghost.valid, routes: ghost.routes }
            : null,
        selected: this.selectedTower,
        cursor: this.keyboardCursor,
      };
      this.renderer.draw(running ? this.acc / DT : 1, ts / 1000, view);
    }
    requestAnimationFrame((t) => this.frame(t));
  }
}

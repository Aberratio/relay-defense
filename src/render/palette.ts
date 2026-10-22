// Colours of the board, read from the brand tokens (src/styles/tokens.css) so the canvas never
// hardcodes the palette. The fallbacks are the same values, for tests and for a missing sheet.

export interface Palette {
  bg: string;
  bgDeep: string;
  surface: string;
  raised: string;
  line: string;
  lineStrong: string;
  text: string;
  muted: string;
  subtle: string;
  /** Signal (amber): the player's agents and their fire. */
  signal: string;
  signalSoft: string;
  /** Ion (blue): support fields, routes, the core. */
  ion: string;
  danger: string;
  warning: string;
  success: string;
}

const FALLBACK: Palette = {
  bg: '#0b0d12',
  bgDeep: '#07080b',
  surface: '#11141b',
  raised: '#181c25',
  line: '#2a303c',
  lineStrong: '#3d4452',
  text: '#eceef3',
  muted: '#a3a9b7',
  subtle: '#7f8697',
  signal: '#ffb547',
  signalSoft: '#ffc66e',
  ion: '#8fb3ff',
  danger: '#ff7a7a',
  warning: '#ffd166',
  success: '#4fd1a1',
};

const TOKENS: Record<keyof Palette, string> = {
  bg: '--color-bg',
  bgDeep: '--color-bg-deep',
  surface: '--color-surface',
  raised: '--color-surface-raised',
  line: '--color-line',
  lineStrong: '--color-line-strong',
  text: '--color-text',
  muted: '--color-text-muted',
  subtle: '--color-text-subtle',
  signal: '--color-accent',
  signalSoft: '--color-accent-hover',
  ion: '--color-accent-2',
  danger: '--color-danger',
  warning: '--color-warning',
  success: '--color-success',
};

export function readPalette(
  el: Element | null = typeof document === 'undefined' ? null : document.documentElement,
): Palette {
  if (!el || typeof getComputedStyle === 'undefined') return { ...FALLBACK };
  const style = getComputedStyle(el);
  const out = { ...FALLBACK };
  for (const key of Object.keys(TOKENS) as (keyof Palette)[]) {
    const value = style.getPropertyValue(TOKENS[key]).trim();
    if (/^#[0-9a-f]{6}$/i.test(value)) out[key] = value;
  }
  return out;
}

/** `#rrggbb` with an alpha, as an rgba() string. */
export function alpha(hex: string, a: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

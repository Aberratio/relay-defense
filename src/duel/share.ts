import type { Lang } from '../ui/i18n';
import { duelHash, type Duel } from './link';

/**
 * The link to send: the game's own page in the reader's language, with the duel in the hash.
 * Embedded on kokot.it the game runs in a frame, and the frame's own address is the one that opens
 * the game full-page, so the embed flag is dropped and nothing else of the query is kept.
 */
export function duelUrl(
  page: { origin: string; pathname: string },
  lang: Lang,
  duel: Duel,
): string {
  return `${page.origin}${page.pathname}?lang=${lang}${duelHash(duel)}`;
}

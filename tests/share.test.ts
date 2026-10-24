import { describe, expect, it } from 'vitest';
import { duelFromHash } from '../src/duel/link';
import { duelUrl } from '../src/duel/share';

const duel = {
  map: 'two-fronts' as const,
  challenger: { level: 'duel-two-fronts', waves: [[], [], [], []] },
};

describe('the link a player sends', () => {
  it('opens the game page full-size, in the sender’s language, with the duel in the hash', () => {
    const url = duelUrl(
      { origin: 'https://kokot.it', pathname: '/tools/relay-defense/' },
      'pl',
      duel,
    );
    expect(url).toBe('https://kokot.it/tools/relay-defense/?lang=pl#duel=1~1~t~...');
    const parsed = new URL(url);
    expect(parsed.searchParams.has('embed')).toBe(false);
    expect(duelFromHash(parsed.hash)).toEqual({ ok: true, duel });
  });
});

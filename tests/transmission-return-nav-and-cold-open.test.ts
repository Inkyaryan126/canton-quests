/**
 * Canton Quests — Transmission smart-return navigation + Cold Open
 * homepage placement correction.
 *
 * Two related fixes:
 *
 * 1. The transmission detail page (app/events/[slug]/transmissions/[id]/page.tsx)
 *    used to show a static, always-wrong pair of buttons ("RETURN TO
 *    ARCHIVE" / "RETURN TO MISSION") regardless of where the player
 *    actually opened the transmission from. It's replaced with ONE smart
 *    BACK control driven by a validated `returnTo` query param
 *    (lib/safe-internal-path.ts) — never an open redirect, since only a
 *    same-app relative path is ever accepted; anything else falls back to
 *    the archive.
 *
 * 2. The Founder's Cipher Cold Open video (#1) used to be permanently
 *    embedded on the Mission homepage (components/FounderCipherShell.tsx,
 *    the "Featured Transmission Teaser" block, driven by
 *    getFeaturedTransmission() which always resolves to video #1). It's
 *    removed from the homepage; Cold Open already auto-fires once on
 *    Mission entry (app/events/[slug]/page.tsx) and remains replayable from
 *    the archive afterward — that mechanism is untouched here.
 */

import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { isSafeInternalPath, sanitizeInternalPath, getReturnLabelForPath } from '../lib/safe-internal-path';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('lib/safe-internal-path — never an open redirect', () => {
  it('accepts a plain same-app relative path', () => {
    expect(isSafeInternalPath('/events/canton-weekend-1/rules')).toBe(true);
    expect(isSafeInternalPath('/leaderboard?operation=canton-weekend-1')).toBe(true);
  });

  it('rejects an absolute external URL', () => {
    expect(isSafeInternalPath('https://evil.example.com')).toBe(false);
    expect(isSafeInternalPath('http://evil.example.com/phish')).toBe(false);
  });

  it('rejects a protocol-relative URL (the classic open-redirect bypass)', () => {
    expect(isSafeInternalPath('//evil.example.com')).toBe(false);
  });

  it('rejects empty, null, undefined, and non-string values', () => {
    expect(isSafeInternalPath('')).toBe(false);
    expect(isSafeInternalPath(null)).toBe(false);
    expect(isSafeInternalPath(undefined)).toBe(false);
    expect(isSafeInternalPath('   ')).toBe(false);
  });

  it('rejects a path containing a backslash or null byte (origin-confusion tricks)', () => {
    expect(isSafeInternalPath('/\\evil.example.com')).toBe(false);
    expect(isSafeInternalPath('/foo\0bar')).toBe(false);
  });

  it('sanitizeInternalPath falls back to the given fallback for any unsafe value', () => {
    expect(sanitizeInternalPath('https://evil.example.com', '/events/x/transmissions')).toBe('/events/x/transmissions');
    expect(sanitizeInternalPath(null, '/events/x/transmissions')).toBe('/events/x/transmissions');
    expect(sanitizeInternalPath('/events/x/rules', '/events/x/transmissions')).toBe('/events/x/rules');
  });

  it('getReturnLabelForPath returns a truthful, specific label per known context', () => {
    expect(getReturnLabelForPath('/events/canton-weekend-1/rules')).toBe('BACK TO RULES');
    expect(getReturnLabelForPath('/leaderboard?operation=canton-weekend-1')).toBe('BACK TO LEADERBOARD');
    expect(getReturnLabelForPath('/events/canton-weekend-1/drawing')).toBe('BACK TO DRAWING');
    expect(getReturnLabelForPath('/events/canton-weekend-1/quests/some-quest')).toBe('BACK TO QUEST');
    expect(getReturnLabelForPath('/events/canton-weekend-1/quests')).toBe('BACK TO QUESTS');
    expect(getReturnLabelForPath('/events/canton-weekend-1/transmissions')).toBe('BACK TO TRANSMISSIONS');
    expect(getReturnLabelForPath('/register')).toBe('BACK TO REGISTRATION');
    expect(getReturnLabelForPath('/events/canton-weekend-1')).toBe('BACK TO MISSION OVERVIEW');
  });

  it('getReturnLabelForPath falls back to a plain BACK for an unrecognized shape, never a guess', () => {
    expect(getReturnLabelForPath('/some/unknown/path')).toBe('BACK');
  });

  it('a transmission detail path itself is not mistaken for the archive path', () => {
    expect(getReturnLabelForPath('/events/canton-weekend-1/transmissions/3')).not.toBe('BACK TO TRANSMISSIONS');
  });
});

describe('Transmission detail page — one smart BACK control, no competing generic pair', () => {
  const source = readSource('app/events/[slug]/transmissions/[id]/page.tsx');

  it('no longer contains the old static "RETURN TO ARCHIVE" / "RETURN TO MISSION" pair', () => {
    expect(source).not.toContain('RETURN TO ARCHIVE');
    expect(source).not.toContain('RETURN TO MISSION');
  });

  it('reads returnTo from the URL and validates it through sanitizeInternalPath', () => {
    expect(source).toContain("useSearchParams()");
    expect(source).toMatch(/sanitizeInternalPath\(searchParams\.get\('returnTo'\), archivePath\)/);
  });

  it('falls back to the transmission archive when returnTo is missing or invalid', () => {
    expect(source).toMatch(/archivePath = `\/events\/\$\{params\.slug\}\/transmissions`/);
  });

  it('is wrapped in a Suspense boundary (required by useSearchParams in this app)', () => {
    expect(source).toContain('<Suspense fallback={null}>');
    expect(source).toMatch(/function TransmissionPlayerPageContent/);
    expect(source).toMatch(/export default function TransmissionPlayerPage/);
  });

  it('propagates returnTo through the prev/next inter-transmission links', () => {
    expect(source).toMatch(/\$\{prevId\}\$\{returnQuery\}/);
    expect(source).toMatch(/\$\{nextId\}\$\{returnQuery\}/);
  });
});

describe('Transmission archive — links to the detail page carry returnTo=self', () => {
  it('the archive thumbnail link tells the detail page to come back to the archive', () => {
    const source = readSource('app/events/[slug]/transmissions/page.tsx');
    expect(source).toMatch(/transmissions\/\$\{t\.id\}\?returnTo=\$\{encodeURIComponent/);
  });
});

describe('Cold Open (#1) — removed from the Mission homepage embed, still auto-fires on entry and stays in the archive', () => {
  it('FounderCipherShell.tsx no longer imports or calls getFeaturedTransmission', () => {
    const source = readSource('components/FounderCipherShell.tsx');
    expect(source).not.toContain('getFeaturedTransmission');
    expect(source).not.toContain('featuredTransmission');
  });

  it('FounderCipherShell.tsx no longer renders a "Featured Transmission" teaser card', () => {
    const source = readSource('components/FounderCipherShell.tsx');
    expect(source).not.toContain('Featured Transmission');
  });

  it('the unrelated Official Mission Briefing promo video block is untouched', () => {
    const source = readSource('components/FounderCipherShell.tsx');
    expect(source).toContain('Official Mission Briefing');
    expect(source).toContain('cqImages.promoVideo');
  });

  it('getFeaturedTransmission itself is left intact in lib/commander-transmissions.ts (asset/mapping not removed)', () => {
    const source = readSource('lib/commander-transmissions.ts');
    expect(source).toContain('export function getFeaturedTransmission');
  });

  it('Cold Open (video 1) still auto-fires once on Mission entry, independent of the homepage', () => {
    const source = readSource('app/events/[slug]/page.tsx');
    expect(source).toMatch(/shouldAutoShowTransmission\('cipher_cold_open', 'video-1'/);
    expect(source).toMatch(/markTransmissionViewed\('cipher_cold_open', 'video-1'/);
  });
});

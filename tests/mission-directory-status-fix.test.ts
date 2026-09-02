/**
 * Canton Quests — Mission Directory status/prize/preview fixes (2026-09-02).
 *
 * 1. getOperationStatus no longer trusts status: 'active' as an unconditional
 *    LIVE signal — a Mission is only LIVE once its own startTime has
 *    actually arrived. This was the real bug: Founder's Cipher (status:
 *    'active', starts Sept 11) was showing as LIVE NOW on Sept 2, while the
 *    genuinely-next Fair QR Hunt (status: 'upcoming', starts Sept 4) showed
 *    as merely UPCOMING — backwards.
 * 2. The Fair QR Hunt's Mission Directory card shows $300, not the retired
 *    $100 figure.
 * 3. The public Mission Preview only ever shows a small, spoiler-safe
 *    subset of destinationCards — never the Secret Sector, never a
 *    "Staged" card, and never destinationCards itself is mutated (the real
 *    in-Mission board, components/FounderCipherShell.tsx, still uses the
 *    full array unchanged).
 */
import fs from 'fs';
import path from 'path';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { getOperationStatus, destinationCards, missionPreviewCards } from '../lib/marketing-assets';
import { SEED_EVENT, SEED_FAIR_EVENT, SEED_MISSING_SIGNAL_EVENT, SEED_MIDNIGHT_LEDGER_EVENT } from '../lib/seed-data';
import OperationCard from '../components/OperationCard';
import type { QuestEvent } from '../lib/types';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('getOperationStatus — no longer falsely LIVE from status alone', () => {
  it('an "active" Mission with a future startTime is UPCOMING, not LIVE (the actual production bug)', () => {
    const event: QuestEvent = {
      id: 'evt-x',
      cityId: 'city-x',
      title: 'Future Mission',
      slug: 'future-mission',
      description: 'x',
      status: 'active',
      currentPhase: 'day_1',
      isPaused: false,
      startTime: '2026-12-25T00:00:00Z',
      createdAt: '2026-01-01T00:00:00Z',
      requiresPath: false,
    };
    expect(getOperationStatus(event, new Date('2026-09-02T00:00:00Z'))).toBe('UPCOMING');
  });

  it('the real Founder\'s Cipher and Fair QR Hunt events, evaluated on Sept 2, are BOTH upcoming — Cipher is not falsely LIVE', () => {
    const sept2 = new Date('2026-09-02T12:00:00Z');
    expect(getOperationStatus(SEED_EVENT, sept2)).toBe('UPCOMING');
    expect(getOperationStatus(SEED_FAIR_EVENT, sept2)).toBe('UPCOMING');
  });

  it('the Fair QR Hunt becomes LIVE once its own start time actually arrives, while Founder\'s Cipher stays upcoming', () => {
    const duringFair = new Date('2026-09-04T12:00:00Z');
    expect(getOperationStatus(SEED_FAIR_EVENT, duringFair)).toBe('LIVE');
    expect(getOperationStatus(SEED_EVENT, duringFair)).toBe('UPCOMING');
  });

  it('after the Fair ends, Founder\'s Cipher becomes LIVE once ITS start time arrives, and Fair reads ENDED', () => {
    const duringCipher = new Date('2026-09-12T00:00:00Z');
    expect(getOperationStatus(SEED_FAIR_EVENT, duringCipher)).toBe('ENDED');
    expect(getOperationStatus(SEED_EVENT, duringCipher)).toBe('LIVE');
  });

  it('a paused Mission never shows LIVE even after its start time', () => {
    const event: QuestEvent = { ...SEED_FAIR_EVENT, isPaused: true, status: 'upcoming' };
    expect(getOperationStatus(event, new Date('2026-09-04T12:00:00Z'))).toBe('UPCOMING');
  });
});

describe('Mission Directory — Fair prize copy', () => {
  it('OperationCard shows $300 Mystery Money for the Fair QR Hunt, never the retired $100 figure', () => {
    const html = ReactDOMServer.renderToString(React.createElement(OperationCard, { event: SEED_FAIR_EVENT, status: 'INCOMING' as any }));
    expect(html).toContain('$300');
    expect(html.toLowerCase()).toContain('mystery money');
    expect(html).not.toContain('$100');
  });
});

describe('Mission Directory — spoiler-safe Mission Preview', () => {
  it('shows only 3-4 curated cards, not the full quest board', () => {
    expect(missionPreviewCards.length).toBeGreaterThanOrEqual(3);
    expect(missionPreviewCards.length).toBeLessThanOrEqual(4);
    expect(missionPreviewCards.length).toBeLessThan(destinationCards.length);
  });

  it('never includes a Secret Sector card or a "Staged" (not-yet-placed) card', () => {
    for (const card of missionPreviewCards) {
      expect(card.label.toLowerCase()).not.toContain('secret');
      expect(card.label.toLowerCase()).not.toContain('staged');
    }
  });

  it('never includes the card that explicitly reveals a cipher answer/solution method', () => {
    const titles = missionPreviewCards.map((c) => c.title);
    expect(titles).not.toContain('The Stone Stair Cipher');
    for (const card of missionPreviewCards) {
      expect(card.copy.toLowerCase()).not.toContain('answer');
      expect(card.copy.toLowerCase()).not.toContain('solution');
    }
  });

  it('the full destinationCards source of truth is completely untouched (still all 13 cards)', () => {
    expect(destinationCards.length).toBe(13);
    expect(destinationCards.map((c) => c.title)).toContain('The Stone Stair Cipher');
  });

  it('the real in-Mission board (FounderCipherShell) still renders the FULL destinationCards array, unaffected by the public preview', () => {
    const source = readSource('components/FounderCipherShell.tsx');
    expect(source).toContain('destinationCards.map');
    expect(source).not.toContain('missionPreviewCards');
  });

  it('the Mission Directory page carries a visible preview label', () => {
    const source = readSource('app/events/page.tsx');
    expect(source).toContain('MISSION PREVIEW');
  });
});

describe('Mission Directory — Next Mission / Coming Soon ordering', () => {
  it('the page sorts the upcoming bucket by startTime, not raw event array order', () => {
    const source = readSource('app/events/page.tsx');
    expect(source).toMatch(/upcomingMissions[\s\S]*?\.sort\(/);
    const nextIdx = source.indexOf('NEXT MISSION');
    const comingSoonIdx = source.indexOf('COMING SOON');
    expect(nextIdx).toBeGreaterThan(-1);
    expect(comingSoonIdx).toBeGreaterThan(-1);
    expect(nextIdx).toBeLessThan(comingSoonIdx);
  });

  it('SEED_FAIR_EVENT (Sept 4) sorts before SEED_EVENT (Sept 11) among upcoming Missions on Sept 2', () => {
    const sept2 = new Date('2026-09-02T12:00:00Z');
    const upcoming = [SEED_EVENT, SEED_FAIR_EVENT].filter((e) => getOperationStatus(e, sept2) === 'UPCOMING');
    const sorted = [...upcoming].sort((a, b) => new Date(a.startTime!).getTime() - new Date(b.startTime!).getTime());
    expect(sorted.map((e) => e.slug)).toEqual(['fair-qr-hunt', 'canton-weekend-1']);
  });
});

describe('Mission Directory — archived Mission badge reads MISSION COMPLETE, not ACTIVE/LIVE/UPCOMING', () => {
  it('The Missing Signal card shows MISSION COMPLETE and no ACTIVE/LIVE/UPCOMING label', () => {
    const html = ReactDOMServer.renderToString(React.createElement(OperationCard, { event: SEED_MISSING_SIGNAL_EVENT, status: 'ENDED' }));
    expect(html).toContain('MISSION COMPLETE');
    expect(html).not.toContain('ACTIVE MISSION');
    expect(html).not.toContain('LIVE NOW');
    expect(html).not.toContain('UPCOMING MISSION');
    expect(html).toContain('VIEW ARCHIVE');
  });

  it('The Midnight Ledger card shows MISSION COMPLETE and no ACTIVE/LIVE/UPCOMING label', () => {
    const html = ReactDOMServer.renderToString(React.createElement(OperationCard, { event: SEED_MIDNIGHT_LEDGER_EVENT, status: 'ENDED' }));
    expect(html).toContain('MISSION COMPLETE');
    expect(html).not.toContain('ACTIVE MISSION');
    expect(html).not.toContain('LIVE NOW');
    expect(html).not.toContain('UPCOMING MISSION');
    expect(html).toContain('VIEW ARCHIVE');
  });

  it('a real (non-archive) ended Mission still shows the generic MISSION ENDED label, unaffected', () => {
    const realEndedEvent = { ...SEED_EVENT, status: 'ended' as const };
    const html = ReactDOMServer.renderToString(React.createElement(OperationCard, { event: realEndedEvent, status: 'ENDED' }));
    expect(html).toContain('MISSION ENDED');
    expect(html).not.toContain('MISSION COMPLETE');
  });
});

/**
 * Canton Quests — two archived/completed past Missions
 * ("The Missing Signal", June 19-21 2026; "The Midnight Ledger", Aug 1-3
 * 2026) seeded for Mission Directory continuity/worldbuilding only.
 *
 * These tests deliberately do NOT assert any player count, winner, claim
 * record, or prize payout for either Mission — none exists, by design, and
 * none should ever be added to either event row or its static archive copy.
 */
import fs from 'fs';
import path from 'path';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { getEvents, resetGameEngineStore, initializeGameEngine } from '../lib/game-engine';
import { SEED_EVENT, SEED_FAIR_EVENT, SEED_MISSING_SIGNAL_EVENT, SEED_MIDNIGHT_LEDGER_EVENT } from '../lib/seed-data';
import { getOperationStatus, isWorldbuildingArchiveMission, ARCHIVED_MISSION_DEBRIEF } from '../lib/marketing-assets';
import OperationCard from '../components/OperationCard';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Archived past Missions — event data', () => {
  it('both archived Missions exist with the exact required slug, title, and status', () => {
    expect(SEED_MISSING_SIGNAL_EVENT.slug).toBe('the-missing-signal');
    expect(SEED_MISSING_SIGNAL_EVENT.title).toBe('The Missing Signal');
    expect(SEED_MISSING_SIGNAL_EVENT.status).toBe('ended');

    expect(SEED_MIDNIGHT_LEDGER_EVENT.slug).toBe('the-midnight-ledger');
    expect(SEED_MIDNIGHT_LEDGER_EVENT.title).toBe('The Midnight Ledger');
    expect(SEED_MIDNIGHT_LEDGER_EVENT.status).toBe('ended');
  });

  it('both Missions are dated entirely in the past relative to the September 2026 Missions, June before August', () => {
    const missingSignalEnd = new Date(SEED_MISSING_SIGNAL_EVENT.endTime!).getTime();
    const midnightLedgerStart = new Date(SEED_MIDNIGHT_LEDGER_EVENT.startTime!).getTime();
    const midnightLedgerEnd = new Date(SEED_MIDNIGHT_LEDGER_EVENT.endTime!).getTime();
    const fairStart = new Date(SEED_FAIR_EVENT.startTime!).getTime();
    const founderStart = new Date(SEED_EVENT.startTime!).getTime();

    expect(missingSignalEnd).toBeLessThan(midnightLedgerStart);
    expect(midnightLedgerEnd).toBeLessThan(fairStart);
    expect(midnightLedgerEnd).toBeLessThan(founderStart);
  });

  it('getOperationStatus classifies both archived Missions as ENDED', () => {
    expect(getOperationStatus(SEED_MISSING_SIGNAL_EVENT)).toBe('ENDED');
    expect(getOperationStatus(SEED_MIDNIGHT_LEDGER_EVENT)).toBe('ENDED');
  });

  it('the local/offline engine seeds both archived Missions, and June sorts before August in the ended bucket', () => {
    resetGameEngineStore();
    initializeGameEngine();
    const events = getEvents();
    const ended = events.filter((e) => getOperationStatus(e) === 'ENDED');
    expect(ended.map((e) => e.slug)).toEqual(['the-missing-signal', 'the-midnight-ledger']);
  });

  it('current Founder\'s Cipher and Fair QR Hunt Missions are completely unchanged', () => {
    expect(SEED_EVENT.slug).toBe('canton-weekend-1');
    expect(SEED_EVENT.status).toBe('active');
    expect(SEED_EVENT.startTime).toBe('2026-09-11T18:00:00Z');

    expect(SEED_FAIR_EVENT.slug).toBe('fair-qr-hunt');
    expect(SEED_FAIR_EVENT.startTime).toBe('2026-09-04T04:00:00Z');
  });

  it('neither archived Mission requires a starting path', () => {
    expect(SEED_MISSING_SIGNAL_EVENT.requiresPath).toBe(false);
    expect(SEED_MIDNIGHT_LEDGER_EVENT.requiresPath).toBe(false);
  });
});

describe('Archived past Missions — no fabricated activity', () => {
  const forbidden = ['winner', 'testimonial', 'players found', 'players completed', '$', 'cash', 'prize pool'];

  it('neither Mission\'s description or archive copy claims any player count, winner, or prize', () => {
    const haystacks = [
      SEED_MISSING_SIGNAL_EVENT.description,
      SEED_MIDNIGHT_LEDGER_EVENT.description,
      ...ARCHIVED_MISSION_DEBRIEF['the-missing-signal'].lines,
      ...ARCHIVED_MISSION_DEBRIEF['the-midnight-ledger'].lines,
    ].join(' ').toLowerCase();
    for (const word of forbidden) {
      expect(haystacks).not.toContain(word);
    }
  });

  it('the migration file fabricates no player/winner/prize data — additive event rows only', () => {
    const sql = readSource('supabase/migrations/20260902140000_seed_archived_past_missions.sql');
    // Only real DML is the two events INSERTs — no participation/reward
    // table is ever written to for these archived Missions.
    const dmlStatements = sql.match(/^(INSERT|UPDATE|DELETE)\s+.*$/gim) || [];
    expect(dmlStatements.every((line) => /INSERT INTO public\.events/i.test(line))).toBe(true);
  });
});

describe('Archived past Missions — Mission Directory presentation', () => {
  it('isWorldbuildingArchiveMission is true only for the two archived slugs', () => {
    expect(isWorldbuildingArchiveMission('the-missing-signal')).toBe(true);
    expect(isWorldbuildingArchiveMission('the-midnight-ledger')).toBe(true);
    expect(isWorldbuildingArchiveMission('canton-weekend-1')).toBe(false);
    expect(isWorldbuildingArchiveMission('fair-qr-hunt')).toBe(false);
  });

  it('both Missions carry a visible MISSION COMPLETE stamp in their archive copy', () => {
    expect(ARCHIVED_MISSION_DEBRIEF['the-missing-signal'].stamp).toBe('MISSION COMPLETE');
    expect(ARCHIVED_MISSION_DEBRIEF['the-midnight-ledger'].stamp).toBe('MISSION COMPLETE');
  });

  it('OperationCard renders an archived Mission as prestigious/complete, not disabled, with no fabricated prize amount', () => {
    const html = ReactDOMServer.renderToString(React.createElement(OperationCard, { event: SEED_MISSING_SIGNAL_EVENT, status: 'ENDED' }));
    expect(html).toContain('MISSION ENDED');
    expect(html).toContain('VIEW ARCHIVE');
    expect(html).toContain('href="/events/archive/the-missing-signal"');
    expect(html).not.toContain('disabled');
    expect(html).not.toContain('RANKINGS');
    expect(html).not.toContain('Prizes TBD');
    expect(html).not.toMatch(/\$\d/);
  });

  it('OperationCard for a real current Mission is unaffected — still links to the full dashboard with RANKINGS', () => {
    const html = ReactDOMServer.renderToString(React.createElement(OperationCard, { event: SEED_FAIR_EVENT, status: 'LIVE' }));
    expect(html).toContain('href="/events/fair-qr-hunt"');
    expect(html).toContain('RANKINGS');
    expect(html).toContain('ENTER MISSION');
  });

  it('the events directory page renders the archive/past-missions section before the live/upcoming sections', () => {
    const source = readSource('app/events/page.tsx');
    const pastIdx = source.indexOf('PAST MISSIONS');
    const liveIdx = source.indexOf('LIVE NOW');
    const upcomingIdx = source.indexOf('COMING UP');
    expect(pastIdx).toBeGreaterThan(-1);
    expect(pastIdx).toBeLessThan(liveIdx);
    expect(pastIdx).toBeLessThan(upcomingIdx);
  });
});

describe('Archived past Missions — no gameplay routes enabled', () => {
  it('the archive detail page never imports quest, leaderboard, path-selector, or QR-claim components', () => {
    const source = readSource('app/events/archive/[slug]/page.tsx');
    for (const forbiddenImport of ['QuestCard', 'Leaderboard', 'ThreePathSelector', 'CantonMap', 'SectorMap', "'/qr/", 'targetCode']) {
      expect(source).not.toContain(forbiddenImport);
    }
    expect(source).not.toContain('/api/qr/claim');
    expect(source).not.toContain('/api/game/submit');
  });

  it('the archive detail page only reads the event itself from the existing events-by-slug endpoint, nothing else', () => {
    const source = readSource('app/events/archive/[slug]/page.tsx');
    expect(source).toContain("fetch(`/api/game/events/${params.slug}`)");
    expect(source).not.toContain('data.quests');
    expect(source).not.toContain('data.leaderboard');
  });
});

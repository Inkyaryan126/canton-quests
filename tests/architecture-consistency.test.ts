/**
 * Canton Quests — Player-Facing Architecture Consistency
 *
 * Guards the canonical conceptual model established on the homepage:
 *   Canton Quests = permanent platform
 *   Player Identity = permanent account
 *   Mission = a playable event/operation
 *   Quest = an objective/challenge inside a Mission
 *   Path = an optional, Mission-specific identity/entry choice
 *
 * Regression coverage for:
 *   1. /events is a real Mission Directory, not the old hardcoded
 *      "0 XP available / 0 missions / Loading" single-event hub.
 *   2. No public copy implies a permanent Player Identity requires a
 *      starting path.
 *   3. No public copy implies one universal, cross-Mission leaderboard —
 *      leaderboards are Mission-scoped; lifetime XP lives on the profile.
 *   4. The permanent Player Roster no longer filters by a deprecated
 *      account-level starting path.
 *   5. getOperationStatus correctly classifies LIVE / UPCOMING / ENDED
 *      from real event data, matching getActiveEvent's own precedent of
 *      trusting the event's status field first.
 */

import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { getOperationStatus } from '../lib/marketing-assets';
import type { QuestEvent } from '../lib/types';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function baseEvent(overrides: Partial<QuestEvent> = {}): QuestEvent {
  return {
    id: 'evt-test',
    cityId: 'city-test',
    title: 'Test Mission',
    slug: 'test-mission',
    description: 'A test mission.',
    status: 'upcoming',
    currentPhase: 'pre_launch' as any,
    isPaused: false,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('1. /events is a real Mission Directory', () => {
  const source = readSource('app/events/page.tsx');

  it('never hardcodes the old "0 XP / 0 missions / Loading" placeholder stats', () => {
    expect(source).not.toContain('0 XP');
    expect(source).not.toContain('available score');
    expect(source).not.toMatch(/<strong>0<\/strong>\s*<span>missions/);
    expect(source).not.toContain("formatEventWindow(activeEvent) : 'Loading'");
  });

  it('renders every published Mission as a card via the shared OperationCard component', () => {
    expect(source).toContain('OperationCard');
    expect(source).toContain('getOperationStatus');
  });

  it('groups Missions into Live, Upcoming, and Ended sections', () => {
    expect(source).toMatch(/liveMissions/);
    expect(source).toMatch(/upcomingMissions/);
    expect(source).toMatch(/endedMissions/);
  });
});

describe('2. No public copy implies a permanent Player Identity requires a starting path', () => {
  const scannedFiles = ['app/events/[slug]/rules/page.tsx', 'app/how-it-works/layout.tsx'];

  it('never lists "starting path" as a required signup field alongside callsign/email', () => {
    for (const file of scannedFiles) {
      const source = readSource(file);
      expect(source).not.toMatch(/callsign[^.]{0,60}email[^.]{0,30},?\s+and an?\s+starting path/i);
      expect(source).not.toMatch(/pick a starting path/i);
    }
  });

  it('the rules page explicitly states no starting path is required to create an account', () => {
    const source = readSource('app/events/[slug]/rules/page.tsx');
    expect(source).toMatch(/no starting path is required to create an account/i);
  });
});

describe('3. No public copy implies one universal, cross-Mission leaderboard', () => {
  it('the rules page scopes the leaderboard to this specific Mission, not "total XP" platform-wide', () => {
    const source = readSource('app/events/[slug]/rules/page.tsx');
    expect(source).not.toMatch(/one individual, citywide leaderboard ranked by total XP/i);
    expect(source).toMatch(/This Mission has its own individual leaderboard/i);
    expect(source).toMatch(/lifetime total XP across every\s*\n?\s*Mission/i);
  });

  it('how-it-works ties leaderboard climbing to "that Mission", not a platform-wide citywide leaderboard', () => {
    const source = readSource('app/how-it-works/page.tsx');
    expect(source).not.toMatch(/higher you climb on the citywide leaderboard/i);
    expect(source).toContain('climb that Mission');
    expect(source).toContain('Each Mission also runs its own leaderboard');
  });

  it('the how-it-works meta description no longer claims a single citywide leaderboard or a required starting path', () => {
    const source = readSource('app/how-it-works/layout.tsx');
    expect(source).not.toMatch(/citywide leaderboard/i);
    expect(source).not.toMatch(/pick a starting path/i);
  });
});

describe('4. Individual quests are not mislabeled "missions" (hierarchy ambiguity)', () => {
  it('the how-it-works step list consistently calls a single objective a "quest"', () => {
    const source = readSource('app/how-it-works/page.tsx');
    expect(source).toContain("text: 'Choose a quest from the board.'");
    expect(source).not.toMatch(/Choose a mission from the quest board/i);
  });

  it('the Mission detail page quest-board controls say "quest", not "mission", for individual objectives', () => {
    const source = readSource('app/events/[slug]/page.tsx');
    expect(source).not.toMatch(/Choose a [Mm]ission/);
    expect(source).not.toMatch(/missions completed/i);
    expect(source).not.toMatch(/Browse All Missions/);
    expect(source).not.toMatch(/Recommended next mission/i);
    expect(source).not.toMatch(/Start This Mission/);
    expect(source).not.toMatch(/Missions Solved/i);
  });
});

describe('5. Permanent Player Roster no longer filters by a deprecated account-level starting path', () => {
  const source = readSource('app/roster/page.tsx');

  it('has no ALL PATHS / FAMILY / CHALLENGE / SECRET filter UI', () => {
    expect(source).not.toContain('PATH_FILTERS');
    expect(source).not.toContain('ALL PATHS');
  });

  it('does not read or display the deprecated selectedStartingPath field', () => {
    expect(source).not.toContain('selectedStartingPath');
    expect(source).not.toContain('STARTING_DISTRICTS');
  });
});

describe('6. getOperationStatus classifies Missions correctly from real event data', () => {
  it('trusts an authoritative status: "active" as LIVE, matching getActiveEvent\'s own precedent', () => {
    expect(getOperationStatus(baseEvent({ status: 'active', startTime: undefined }))).toBe('LIVE');
  });

  it('trusts an authoritative status: "ended" as ENDED even if endTime is somehow still in the future', () => {
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();
    expect(getOperationStatus(baseEvent({ status: 'ended', endTime: future }))).toBe('ENDED');
  });

  it('classifies a future-dated, non-active/ended event as UPCOMING', () => {
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();
    expect(getOperationStatus(baseEvent({ status: 'upcoming', startTime: future }))).toBe('UPCOMING');
  });

  it('falls back to endTime comparison for a stale status value on an event whose window has passed', () => {
    const past = new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString();
    expect(getOperationStatus(baseEvent({ status: 'upcoming', startTime: past, endTime: past }))).toBe('ENDED');
  });
});

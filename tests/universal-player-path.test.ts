/**
 * Canton Quests — FAMILY / CHALLENGE / SECRET as a universal, platform-wide
 * player identity (communication style/tone), not a Mission-specific
 * branch.
 *
 * Canonical source: players.selected_starting_path (lib/types.ts Player,
 * lib/player-command-center.ts hasValidStartingPath). event_players.path
 * is a legacy/back-compat field only — see lib/supabase-db.ts's
 * getOrCreateEventParticipationDB comment block — never read as the
 * authoritative "does this player have a path" signal anywhere in the app.
 *
 * See also tests/command-center-operations-reorg.test.ts (the enter-route
 * behavioral suite this file's fixtures build on) and
 * tests/how-it-works-mission-cleanup.test.ts (the /how-it-works copy
 * checks specific to that page).
 */

import fs from 'fs';
import path from 'path';
import { describe, expect, it, beforeEach } from 'vitest';
import {
  initializeGameEngine,
  resetGameEngineStore,
  registerPlayer,
  getPlayerById,
  updatePlayerProfile,
  getOrCreateEventParticipation,
  getEventParticipation,
} from '../lib/game-engine';
import { SEED_EVENT, SEED_FAIR_EVENT } from '../lib/seed-data';
import { POST as enterOperationRoute } from '../app/api/game/operations/[slug]/enter/route';
import { PATH_TONES, getPathTone } from '../lib/path-tone';
import { LeaderboardEntry } from '../lib/types';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function authedRequest(url: string, userId: string, init: RequestInit = {}): Request {
  return new Request(url, {
    ...init,
    headers: {
      ...(init.headers as Record<string, string> | undefined),
      Authorization: `Bearer mock-jwt-${userId}`,
    },
  });
}

describe('1. Player universal path persists independently of Mission participation', () => {
  beforeEach(() => {
    resetGameEngineStore();
    initializeGameEngine();
  });

  it('setting a path via profile update is visible on the player record with zero Mission participation at all', () => {
    const player = registerPlayer({ displayName: 'NoMissionYet', email: 'nomission@example.com', userId: 'usr-no-mission' });
    expect(player.selectedStartingPath).toBeUndefined();

    updatePlayerProfile(player.id, { selectedStartingPath: 'secret' });

    expect(getPlayerById(player.id)?.selectedStartingPath).toBe('secret');
    expect(getEventParticipation(SEED_EVENT.id, player.id)).toBeUndefined();
    expect(getEventParticipation(SEED_FAIR_EVENT.id, player.id)).toBeUndefined();
  });

  it('the same universal path is visible whether read before, during, or after joining a Mission', async () => {
    registerPlayer({ displayName: 'ConsistentPathAgent', email: 'consistent@example.com', userId: 'usr-consistent' });

    const entered = await enterOperationRoute(
      authedRequest('http://localhost:3000/api/game/operations/canton-weekend-1/enter', 'usr-consistent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: 'challenge' }),
      }),
      { params: { slug: 'canton-weekend-1' } }
    );
    const enteredData = await entered.json();
    const playerId = enteredData.player.id;

    expect(enteredData.player.selectedStartingPath).toBe('challenge');
    expect(getPlayerById(playerId)?.selectedStartingPath).toBe('challenge');
  });
});

describe('2. Joining a Mission does not require selecting a new path if the player already has one', () => {
  beforeEach(() => {
    resetGameEngineStore();
    initializeGameEngine();
  });

  it('a player who chose their path during onboarding (never having entered ANY Mission) is never asked again on first entry', async () => {
    const player = registerPlayer({ displayName: 'PreChosenAgent', email: 'prechosen@example.com', userId: 'usr-prechosen' });
    updatePlayerProfile(player.id, { selectedStartingPath: 'family' });
    expect(getEventParticipation(SEED_EVENT.id, player.id)).toBeUndefined(); // confirms: never entered this Mission before

    const res = await enterOperationRoute(
      authedRequest('http://localhost:3000/api/game/operations/canton-weekend-1/enter', 'usr-prechosen', { method: 'POST' }),
      { params: { slug: 'canton-weekend-1' } }
    );
    const data = await res.json();
    expect(data.needsPath).toBe(false);
  });

  it('a path chosen while entering ONE Mission is not re-asked when entering a SECOND path-requiring Mission', async () => {
    registerPlayer({ displayName: 'TwoMissionAgent', email: 'twomission@example.com', userId: 'usr-two-mission' });

    // No second real path-requiring Operation exists in seed data today, so
    // this proves the same thing the direct way: re-entering the SAME
    // Operation's /enter endpoint a second time, from scratch (no path in
    // the body), never re-asks once the universal path is on file —
    // independent of event_players' own per-Operation row.
    await enterOperationRoute(
      authedRequest('http://localhost:3000/api/game/operations/canton-weekend-1/enter', 'usr-two-mission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: 'secret' }),
      }),
      { params: { slug: 'canton-weekend-1' } }
    );

    const secondEntry = await enterOperationRoute(
      authedRequest('http://localhost:3000/api/game/operations/canton-weekend-1/enter', 'usr-two-mission', { method: 'POST' }),
      { params: { slug: 'canton-weekend-1' } }
    );
    expect((await secondEntry.json()).needsPath).toBe(false);
  });

  it('GATE 3 in the Mission hub page checks the universal player path, not event_players.path', () => {
    const source = readSource('app/events/[slug]/page.tsx');
    expect(source).toMatch(/if \(event\.requiresPath && participation && !authenticatedPlayer\?\.selectedStartingPath\)/);
    expect(source).not.toMatch(/if \(event\.requiresPath && participation && !participation\.path\)/);
  });
});

describe('3. Fair does not require a path-selection step', () => {
  beforeEach(() => {
    resetGameEngineStore();
    initializeGameEngine();
  });

  it('the Fair QR Hunt event never requires a path', () => {
    expect(SEED_FAIR_EVENT.requiresPath).toBe(false);
  });

  it('entering the Fair QR Hunt with no path never reports needsPath, even for a player with no universal path at all', async () => {
    registerPlayer({ displayName: 'FairNoPathAgent', email: 'fairnopath@example.com', userId: 'usr-fair-no-path' });
    const res = await enterOperationRoute(
      authedRequest('http://localhost:3000/api/game/operations/fair-qr-hunt/enter', 'usr-fair-no-path', { method: 'POST' }),
      { params: { slug: 'fair-qr-hunt' } }
    );
    const data = await res.json();
    expect(data.needsPath).toBe(false);
  });

  it('the Fair QR Hunt landing page never renders the path selector', () => {
    const source = readSource('app/events/fair-qr-hunt/page.tsx');
    expect(source).not.toContain('ThreePathSelector');
  });
});

describe('4. /how-it-works describes paths as a communication/player-style choice', () => {
  const source = readSource('app/how-it-works/page.tsx');

  it('names the three paths and frames them as part of Player Identity, not a Mission', () => {
    expect(source).toMatch(/FAMILY, CHALLENGE, OR SECRET/i);
    expect(source).toMatch(/part of your Player Identity, not a Mission/i);
  });

  it('explicitly states all three paths can play the same Quests', () => {
    expect(source).toMatch(/All three paths can play the same Quests/i);
  });
});

describe('5. Generic homepage copy does not claim paths restrict Quest access', () => {
  it('app/page.tsx never claims a starting path is required to enter a Mission', () => {
    const source = readSource('app/page.tsx');
    expect(source).toMatch(/no starting path required/i);
  });

  it('app/page.tsx does not render the door/path selector as a gate on the platform homepage', () => {
    const source = readSource('app/page.tsx');
    expect(source).not.toContain('ThreePathSelector');
  });
});

describe('6. Player Card displays CHOSEN PATH from the universal player identity', () => {
  const source = readSource('app/profile/page.tsx');

  it('renders a CHOSEN PATH section', () => {
    expect(source).toMatch(/<h2 id="path-heading">CHOSEN PATH<\/h2>/);
  });

  it('reads the path from data.player.selectedStartingPath (the universal source), not from any Mission participation record', () => {
    expect(source).toMatch(/getPathTone\(data\.player\.selectedStartingPath\)/);
    expect(source).not.toMatch(/getPathTone\(.*participation/);
  });

  it('never shows a Mission-specific district name in that section', () => {
    const pathSectionStart = source.indexOf('id="path-heading"');
    const pathSectionEnd = source.indexOf('id="settings-heading"');
    const pathSection = source.slice(pathSectionStart, pathSectionEnd);
    expect(pathSection).not.toMatch(/Arts District|Mother Goose|Monument Park/i);
  });
});

describe('7. Leaderboard/scoring remains path-neutral', () => {
  it('LeaderboardEntry has no path field at all', () => {
    const entry: LeaderboardEntry = {
      rank: 1,
      playerId: 'plr-x',
      displayName: 'Someone',
      totalPoints: 100,
      questsCompletedCount: 3,
    };
    expect((entry as any).path).toBeUndefined();
    expect((entry as any).selectedStartingPath).toBeUndefined();
  });

  it('the leaderboard DB query never filters or branches on path', () => {
    const source = readSource('lib/supabase-db.ts');
    const fnStart = source.indexOf('export async function getLeaderboardDB');
    const fnEnd = source.indexOf('\n}', fnStart);
    const fnBody = source.slice(fnStart, fnEnd);
    expect(fnBody).not.toMatch(/selected_starting_path|\.path\b/);
  });
});

describe('8. Mission participation remains event-scoped', () => {
  beforeEach(() => {
    resetGameEngineStore();
    initializeGameEngine();
  });

  it('entering one Operation never creates participation in another', () => {
    const player = registerPlayer({ displayName: 'ScopedAgent', email: 'scoped@example.com', userId: 'usr-scoped' });
    getOrCreateEventParticipation(SEED_FAIR_EVENT.id, player.id);
    expect(getEventParticipation(SEED_EVENT.id, player.id)).toBeUndefined();
    expect(getEventParticipation(SEED_FAIR_EVENT.id, player.id)).toBeDefined();
  });

  it('event_players.path is still written for backward compatibility, but the universal path is what the player actually carries', async () => {
    registerPlayer({ displayName: 'LegacyFieldAgent', email: 'legacyfield@example.com', userId: 'usr-legacy-field' });
    const res = await enterOperationRoute(
      authedRequest('http://localhost:3000/api/game/operations/canton-weekend-1/enter', 'usr-legacy-field', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: 'family' }),
      }),
      { params: { slug: 'canton-weekend-1' } }
    );
    const data = await res.json();
    // Both are populated after a real choice (back-compat mirror + canonical source) —
    // but only the player-level field is what every other reader now trusts.
    expect(data.participation.path).toBe('family');
    expect(data.player.selectedStartingPath).toBe('family');
  });
});

describe("9. Founder's Cipher geography is not treated as a platform-wide path rule", () => {
  it('lib/path-tone.ts (the universal path source) contains no district/geography names', () => {
    for (const tone of Object.values(PATH_TONES)) {
      expect(tone.label).not.toMatch(/District|Mother Goose|Monument Park|Arts/i);
      expect(tone.styleTag).not.toMatch(/District|Mother Goose|Monument Park|Arts/i);
      expect(tone.description).not.toMatch(/District|Mother Goose|Monument Park|Arts/i);
    }
  });

  it('getPathTone returns null for no path, never fabricates a district-based default', () => {
    expect(getPathTone(null)).toBeNull();
    expect(getPathTone(undefined)).toBeNull();
  });

  it("Founder's Cipher district geography (CipherDistrictKey) is a fully separate type from StartingPath", () => {
    const founderCipherSource = readSource('lib/founders-cipher.ts');
    expect(founderCipherSource).not.toContain('StartingPath');
    expect(founderCipherSource).not.toContain('selectedStartingPath');
  });

  it("ThreePathSelector's confirmation no longer headlines a Mission district as the path identity — district is a secondary, explicitly-labeled suggestion", () => {
    const source = readSource('components/ThreePathSelector.tsx');
    expect(source).not.toMatch(/STARTING PATH CONFIRMED: \{activeOption\.title\} \(\{activeOption\.district\}\)/);
    expect(source).toMatch(/PATH CONFIRMED: \{activeOption\.title\}/);
    expect(source).toMatch(/Suggested Founder.{1,6}s Cipher starting point/);
  });

  it("the door hotspot pill shows the universal style tag, not the raw district, as its primary sub-label", () => {
    const source = readSource('components/ThreePathSelector.tsx');
    expect(source).toMatch(/getPathTone\(door\.id\)\?\.styleTag \|\| door\.district/);
  });
});

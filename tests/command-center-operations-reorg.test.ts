// Canton Quests — Command Center / Operations Reorganization
//
// Regression coverage for the player-flow reorganization: one permanent
// account, event_players as the canonical Operation-participation record
// (path on that record is legacy/back-compat only — see
// tests/universal-player-path.test.ts for the canonical, universal
// players.selected_starting_path coverage), the Fair QR Hunt as a real
// second Operation, and the relaxed (avatar-only) Player Identity
// completion reward.

import fs from 'fs';
import path from 'path';
import { describe, expect, it, beforeEach } from 'vitest';
import {
  initializeGameEngine,
  resetGameEngineStore,
  registerPlayer,
  getPlayerById,
  getEvents,
  getEventBySlug,
  getEventParticipation,
  getOrCreateEventParticipation,
  evaluateAndGrantProfileCompletionReward,
  updatePlayerProfile,
} from '../lib/game-engine';
import { isProfileIdentityComplete } from '../lib/player-command-center';
import { SEED_EVENT, SEED_FAIR_EVENT } from '../lib/seed-data';
import { POST as enterOperationRoute } from '../app/api/game/operations/[slug]/enter/route';
import { GET as rosterRoute } from '../app/api/game/roster/route';

function readFile(relPath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relPath), 'utf8');
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

describe('Command Center / Operations reorganization', () => {
  beforeEach(() => {
    resetGameEngineStore();
    initializeGameEngine();
  });

  describe('1. Seed data — two real Operations', () => {
    it('the Sept 11 Main Operation requires a path; the Fair QR Hunt does not', () => {
      expect(SEED_EVENT.requiresPath).toBe(true);
      expect(SEED_FAIR_EVENT.requiresPath).toBe(false);
    });

    it('both Operations are present in getEvents()', () => {
      const events = getEvents();
      expect(events.find((e) => e.slug === 'canton-weekend-1')).toBeTruthy();
      expect(events.find((e) => e.slug === 'fair-qr-hunt')).toBeTruthy();
    });

    it('getEventBySlug resolves the Fair QR Hunt by its own stable slug', () => {
      const fair = getEventBySlug('fair-qr-hunt');
      expect(fair?.id).toBe(SEED_FAIR_EVENT.id);
      expect(fair?.requiresPath).toBe(false);
    });
  });

  describe('2. Player Identity completion no longer requires a path', () => {
    it('isProfileIdentityComplete is satisfied by avatar alone', () => {
      expect(isProfileIdentityComplete({ avatarPresetKey: '3', profileImagePath: null })).toBe(true);
    });

    it('a player with a valid avatar but no path earns the one-time reward', () => {
      const player = registerPlayer({ displayName: 'PathlessAgent', email: 'pathless@example.com', userId: 'usr-pathless' });
      expect(player.selectedStartingPath).toBeUndefined();
      updatePlayerProfile(player.id, { avatarPresetKey: '2' });

      const result = evaluateAndGrantProfileCompletionReward(player.id);
      expect(result.newlyGranted).toBe(true);
      expect(result.xpAwarded).toBe(100);
      expect(getPlayerById(player.id)?.totalXp).toBe(100);
    });

    it('avatar alone still cannot double-grant the reward', () => {
      const player = registerPlayer({ displayName: 'PathlessAgent2', email: 'pathless2@example.com', userId: 'usr-pathless-2' });
      updatePlayerProfile(player.id, { avatarPresetKey: '4' });
      expect(evaluateAndGrantProfileCompletionReward(player.id).newlyGranted).toBe(true);
      expect(evaluateAndGrantProfileCompletionReward(player.id).newlyGranted).toBe(false);
      expect(getPlayerById(player.id)?.totalXp).toBe(100);
    });
  });

  describe('3. event_players participation — local engine', () => {
    it('getOrCreateEventParticipation creates exactly one record per player+event', () => {
      const player = registerPlayer({ displayName: 'ParticipantOne', email: 'p1@example.com', userId: 'usr-p1' });
      const first = getOrCreateEventParticipation(SEED_FAIR_EVENT.id, player.id);
      const second = getOrCreateEventParticipation(SEED_FAIR_EVENT.id, player.id);
      expect(second.id).toBe(first.id);
    });

    it('a supplied path fills in a previously-empty one, never overwrites an existing choice', () => {
      const player = registerPlayer({ displayName: 'PathChooser', email: 'pc@example.com', userId: 'usr-pc' });
      const created = getOrCreateEventParticipation(SEED_EVENT.id, player.id);
      expect(created.path).toBeNull();

      const withPath = getOrCreateEventParticipation(SEED_EVENT.id, player.id, 'challenge');
      expect(withPath.path).toBe('challenge');

      const unchanged = getOrCreateEventParticipation(SEED_EVENT.id, player.id, 'secret');
      expect(unchanged.path).toBe('challenge');
    });

    it('participation for one Operation is independent of participation for another', () => {
      const player = registerPlayer({ displayName: 'DualOperationAgent', email: 'dual@example.com', userId: 'usr-dual' });
      getOrCreateEventParticipation(SEED_FAIR_EVENT.id, player.id);
      expect(getEventParticipation(SEED_EVENT.id, player.id)).toBeUndefined();
      expect(getEventParticipation(SEED_FAIR_EVENT.id, player.id)).toBeDefined();
    });
  });

  describe('4. POST /api/game/operations/[slug]/enter', () => {
    it('rejects an unauthenticated request', async () => {
      const req = new Request('http://localhost:3000/api/game/operations/fair-qr-hunt/enter', { method: 'POST' });
      const res = await enterOperationRoute(req, { params: { slug: 'fair-qr-hunt' } });
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.success).toBe(false);
    });

    it('an authenticated player entering the Fair QR Hunt never needs a path', async () => {
      registerPlayer({ displayName: 'FairEnterer', email: 'fair@example.com', userId: 'usr-fair-enter' });
      const req = authedRequest('http://localhost:3000/api/game/operations/fair-qr-hunt/enter', 'usr-fair-enter', {
        method: 'POST',
      });
      const res = await enterOperationRoute(req, { params: { slug: 'fair-qr-hunt' } });
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.needsPath).toBe(false);
    });

    it('a first-time participant entering the Sept 11 Main Operation needs to choose a path', async () => {
      registerPlayer({ displayName: 'MainFirstTimer', email: 'mainfirst@example.com', userId: 'usr-main-first' });
      const req = authedRequest('http://localhost:3000/api/game/operations/canton-weekend-1/enter', 'usr-main-first', {
        method: 'POST',
      });
      const res = await enterOperationRoute(req, { params: { slug: 'canton-weekend-1' } });
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.needsPath).toBe(true);
    });

    it('choosing a path on the Main Operation persists it, and a returning participant is never asked again', async () => {
      registerPlayer({ displayName: 'MainReturner', email: 'mainreturn@example.com', userId: 'usr-main-return' });

      const firstEnter = await enterOperationRoute(
        authedRequest('http://localhost:3000/api/game/operations/canton-weekend-1/enter', 'usr-main-return', { method: 'POST' }),
        { params: { slug: 'canton-weekend-1' } }
      );
      expect((await firstEnter.json()).needsPath).toBe(true);

      const choosePath = await enterOperationRoute(
        authedRequest('http://localhost:3000/api/game/operations/canton-weekend-1/enter', 'usr-main-return', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: 'family' }),
        }),
        { params: { slug: 'canton-weekend-1' } }
      );
      const choosePathData = await choosePath.json();
      expect(choosePathData.needsPath).toBe(false);
      expect(choosePathData.participation.path).toBe('family');

      const returning = await enterOperationRoute(
        authedRequest('http://localhost:3000/api/game/operations/canton-weekend-1/enter', 'usr-main-return', { method: 'POST' }),
        { params: { slug: 'canton-weekend-1' } }
      );
      const returningData = await returning.json();
      expect(returningData.needsPath).toBe(false);
      expect(returningData.participation.path).toBe('family');
    });

    it('choosing a path persists it to the universal players.selected_starting_path, not just the Operation-scoped event_players.path', async () => {
      registerPlayer({ displayName: 'UniversalPathAgent', email: 'universalpath@example.com', userId: 'usr-universal-path' });

      const choosePath = await enterOperationRoute(
        authedRequest('http://localhost:3000/api/game/operations/canton-weekend-1/enter', 'usr-universal-path', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: 'secret' }),
        }),
        { params: { slug: 'canton-weekend-1' } }
      );
      const data = await choosePath.json();
      expect(data.player.selectedStartingPath).toBe('secret');
      expect(getPlayerById(data.player.id)?.selectedStartingPath).toBe('secret');
    });

    it('a path supplied for the path-free Fair QR Hunt is ignored, never stored', async () => {
      registerPlayer({ displayName: 'FairPathAttempt', email: 'fairpath@example.com', userId: 'usr-fair-path' });
      const req = authedRequest('http://localhost:3000/api/game/operations/fair-qr-hunt/enter', 'usr-fair-path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: 'secret' }),
      });
      const res = await enterOperationRoute(req, { params: { slug: 'fair-qr-hunt' } });
      const data = await res.json();
      expect(data.participation.path).toBeFalsy();
    });

    it('entering the same Operation twice never creates a duplicate participation record', async () => {
      registerPlayer({ displayName: 'NoDupeAgent', email: 'nodupe@example.com', userId: 'usr-no-dupe' });
      const call = () =>
        enterOperationRoute(
          authedRequest('http://localhost:3000/api/game/operations/fair-qr-hunt/enter', 'usr-no-dupe', { method: 'POST' }),
          { params: { slug: 'fair-qr-hunt' } }
        );
      const first = await (await call()).json();
      const second = await (await call()).json();
      expect(second.participation.id).toBe(first.participation.id);
    });

    it('404s for an unknown Operation slug', async () => {
      registerPlayer({ displayName: 'GhostOpAgent', email: 'ghost@example.com', userId: 'usr-ghost-op' });
      const req = authedRequest('http://localhost:3000/api/game/operations/does-not-exist/enter', 'usr-ghost-op', {
        method: 'POST',
      });
      const res = await enterOperationRoute(req, { params: { slug: 'does-not-exist' } });
      expect(res.status).toBe(404);
    });
  });

  describe('5. Player Roster', () => {
    it('includes a player who has never scored any points', async () => {
      registerPlayer({ displayName: 'ZeroScoreRosterAgent', email: 'zeroscore@example.com', userId: 'usr-zero-score' });
      const res = await rosterRoute(new Request('http://localhost:3000/api/game/roster'));
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.roster.some((entry: any) => entry.displayName === 'ZeroScoreRosterAgent')).toBe(true);
    });

    it('never includes email or userId', async () => {
      registerPlayer({ displayName: 'PrivacyCheckAgent', email: 'privacy@example.com', userId: 'usr-privacy' });
      const res = await rosterRoute(new Request('http://localhost:3000/api/game/roster'));
      const data = await res.json();
      const entry = data.roster.find((e: any) => e.displayName === 'PrivacyCheckAgent');
      expect(entry).toBeDefined();
      expect(entry.email).toBeUndefined();
      expect(entry.userId).toBeUndefined();
      expect(JSON.stringify(entry)).not.toContain('privacy@example.com');
    });

    it('search filters by callsign', async () => {
      registerPlayer({ displayName: 'SearchableUniqueName', email: 'searchable@example.com', userId: 'usr-searchable' });
      registerPlayer({ displayName: 'SomeoneElse', email: 'someoneelse@example.com', userId: 'usr-someone-else' });
      const res = await rosterRoute(new Request('http://localhost:3000/api/game/roster?search=SearchableUnique'));
      const data = await res.json();
      expect(data.roster.some((e: any) => e.displayName === 'SearchableUniqueName')).toBe(true);
      expect(data.roster.some((e: any) => e.displayName === 'SomeoneElse')).toBe(false);
    });
  });

  describe('6. Account creation still requires no path (unchanged, re-verified)', () => {
    it('registering with no starting path succeeds', () => {
      const player = registerPlayer({ displayName: 'NoPathSignup', email: 'nopath@example.com', userId: 'usr-no-path-signup' });
      expect(player.id).toBeTruthy();
      expect(player.selectedStartingPath).toBeUndefined();
    });
  });

  describe('7. Terminology and architecture guardrails', () => {
    it('the Command Center (homepage) no longer forces the three-path selector', () => {
      const source = readFile('app/page.tsx');
      expect(source).not.toContain('ThreePathSelector');
    });

    it('the Sept 11 Main Operation flow (event page) owns the path-selection gate', () => {
      const source = readFile('app/events/[slug]/page.tsx');
      expect(source).toContain('ThreePathSelector');
      expect(source).toContain('requiresPath');
    });

    it('the nav uses Player File / Player Roster terminology, not a duplicate Command Center label', () => {
      const source = readFile('components/CinematicNav.tsx');
      expect(source).toContain('PLAYER FILE');
      expect(source).toContain('PLAYER ROSTER');
    });

    it('players.selected_starting_path is preserved, not dropped, by the migration', () => {
      const migration = readFile('supabase/migrations/20260826072300_operation_scoped_path_and_fair_hunt.sql');
      expect(migration).not.toMatch(/DROP COLUMN\s+selected_starting_path/i);
      expect(migration).toContain('event_players');
      expect(migration).toContain('requires_path');
    });
  });
});

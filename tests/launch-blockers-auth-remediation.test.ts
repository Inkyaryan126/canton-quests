// Canton Quests — Launch Blocker Remediation: Quest Submission & Admin Auth
//
// Regression coverage for the two remaining launch blockers from the prior
// audit pass:
//   1. app/api/game/submit/route.ts accepted playerId from the client body
//      with no proof the authenticated session actually owned it — a
//      forged playerId could impersonate another player for XP / drawing
//      entries / race placement.
//   2. app/api/admin/day1-bonus/route.ts had no Game Master authorization
//      guard at all, unlike every sibling admin route.

import fs from 'fs';
import path from 'path';
import { describe, expect, it, beforeEach } from 'vitest';
import {
  initializeGameEngine,
  resetGameEngineStore,
  registerPlayer,
  getPlayerById,
  getSubmissionsForPlayer,
  getDrawingEntriesForPlayer,
} from '../lib/game-engine';
import { SEED_EVENT, SEED_QUESTS } from '../lib/seed-data';
import { POST as submitProofRoute } from '../app/api/game/submit/route';
import { POST as day1BonusRoute } from '../app/api/admin/day1-bonus/route';

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

const CHECKIN_QUEST = SEED_QUESTS.find((q) => q.verificationType === 'checkin')!;

describe('Blocker 1 — quest submission cannot be forged to another player', () => {
  beforeEach(() => {
    resetGameEngineStore();
    initializeGameEngine();
  });

  it('unauthenticated submission is rejected with 401 and does not process', async () => {
    const req = new Request('http://localhost:3000/api/game/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerId: 'plr-attacker-forged',
        questId: CHECKIN_QUEST.id,
        eventId: SEED_EVENT.id,
        proofType: 'checkin',
      }),
    });

    const res = await submitProofRoute(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.awardedPoints).toBe(0);
  });

  it('authenticated player cannot submit for another player\'s UUID — rejected 403, no mutation', async () => {
    const victim = registerPlayer({ displayName: 'VictimAgent', email: 'victim@example.com', userId: 'usr-victim-1' });
    const attacker = registerPlayer({ displayName: 'AttackerAgent', email: 'attacker@example.com', userId: 'usr-attacker-1' });

    const req = authedRequest('http://localhost:3000/api/game/submit', 'usr-attacker-1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerId: victim.id, // Forged claimant — attacker tries to submit as the victim
        questId: CHECKIN_QUEST.id,
        eventId: SEED_EVENT.id,
        proofType: 'checkin',
      }),
    });

    const res = await submitProofRoute(req);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.success).toBe(false);
    expect(data.awardedPoints).toBe(0);

    // Victim's XP, drawing entries, and submission history are completely untouched.
    expect(getPlayerById(victim.id)?.totalXp).toBe(0);
    expect(getSubmissionsForPlayer(victim.id, SEED_EVENT.id)).toHaveLength(0);
    expect(getDrawingEntriesForPlayer(victim.id, SEED_EVENT.id)).toHaveLength(0);

    // The attacker's own account was not credited either — the request was
    // rejected outright, not silently resubmitted under the attacker's identity.
    expect(getPlayerById(attacker.id)?.totalXp).toBe(0);
    expect(getSubmissionsForPlayer(attacker.id, SEED_EVENT.id)).toHaveLength(0);
  });

  it('a spoofed playerId in the body cannot affect the real authenticated player\'s outcome even when it matches nobody real', async () => {
    const player = registerPlayer({ displayName: 'RealAgent', email: 'realagent@example.com', userId: 'usr-real-agent' });

    const req = authedRequest('http://localhost:3000/api/game/submit', 'usr-real-agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerId: 'plr-does-not-exist-spoofed',
        questId: CHECKIN_QUEST.id,
        eventId: SEED_EVENT.id,
        proofType: 'checkin',
      }),
    });

    const res = await submitProofRoute(req);
    const data = await res.json();

    // Mismatch against the authenticated identity is rejected regardless of
    // whether the spoofed id happens to belong to a real player.
    expect(res.status).toBe(403);
    expect(data.success).toBe(false);
    expect(getSubmissionsForPlayer(player.id, SEED_EVENT.id)).toHaveLength(0);
  });

  it('an authenticated player can submit for themselves — omitting playerId works', async () => {
    const player = registerPlayer({
      displayName: 'SelfSubmitAgent',
      email: 'selfsubmit@example.com',
      userId: 'usr-self-submit',
      selectedStartingPath: 'family',
    });

    const req = authedRequest('http://localhost:3000/api/game/submit', 'usr-self-submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        questId: CHECKIN_QUEST.id,
        eventId: SEED_EVENT.id,
        proofType: 'checkin',
      }),
    });

    const res = await submitProofRoute(req);
    const data = await res.json();

    // The request reached real submission processing (not blocked by the
    // auth guard) — a legitimate authenticated self-submission is never a
    // 401/403, whatever the underlying quest verification outcome is.
    expect(res.status).toBe(200);
    expect(data.submission?.playerId ?? player.id).toBe(player.id);
  });

  it('an authenticated player can submit for themselves — explicitly matching playerId also works', async () => {
    const player = registerPlayer({
      displayName: 'SelfSubmitAgent2',
      email: 'selfsubmit2@example.com',
      userId: 'usr-self-submit-2',
      selectedStartingPath: 'family',
    });

    const req = authedRequest('http://localhost:3000/api/game/submit', 'usr-self-submit-2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerId: player.id,
        questId: CHECKIN_QUEST.id,
        eventId: SEED_EVENT.id,
        proofType: 'checkin',
      }),
    });

    const res = await submitProofRoute(req);
    expect(res.status).toBe(200);
  });

  it('the route derives the acting player from the authenticated session, not the request body', () => {
    const source = readFile('app/api/game/submit/route.ts');
    expect(source).toContain('resolveAuthenticatedPlayer(request)');
    expect(source).toContain('playerId: authenticatedPlayer.id');
    expect(source).toMatch(/if\s*\(\s*!authenticatedPlayer\s*\)/);
    expect(source).toMatch(/playerId\s*&&\s*playerId\s*!==\s*authenticatedPlayer\.id/);
  });

  it('unexpected internal errors return a generic message, not raw error.message', () => {
    const source = readFile('app/api/game/submit/route.ts');
    expect(source).toContain("{ error: 'Submission processing failed' }");
    expect(source).not.toMatch(/catch[^}]*error\.message/s);
  });
});

describe('Blocker 2 — admin Day 1 bonus route requires Game Master authorization', () => {
  beforeEach(() => {
    resetGameEngineStore();
    initializeGameEngine();
    delete process.env.ADMIN_SECRET_KEY;
  });

  it('unauthenticated request is rejected with 401', async () => {
    const req = new Request('http://localhost:3000/api/admin/day1-bonus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId: SEED_EVENT.id, isRehearsal: true }),
    });

    const res = await day1BonusRoute(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toMatch(/unauthorized/i);
  });

  it('an invalid admin credential is rejected', async () => {
    const req = new Request('http://localhost:3000/api/admin/day1-bonus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': 'totally-wrong-passphrase' },
      body: JSON.stringify({ eventId: SEED_EVENT.id, isRehearsal: true }),
    });

    const res = await day1BonusRoute(req);
    expect(res.status).toBe(401);
  });

  it('a valid Game Master credential is authorized and the bonus route executes', async () => {
    const req = new Request('http://localhost:3000/api/admin/day1-bonus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': 'canton-gm-2026' },
      body: JSON.stringify({ eventId: SEED_EVENT.id, isRehearsal: true }),
    });

    const res = await day1BonusRoute(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.error).toBeUndefined();
  });

  it('reuses the canonical admin-auth helper rather than a second auth system', () => {
    const source = readFile('app/api/admin/day1-bonus/route.ts');
    expect(source).toContain("from '@/lib/admin-auth'");
    expect(source).toContain('resolveAdminSessionFromRequest');
    expect(source).not.toMatch(/ADMIN_SECRET_KEY/); // no route-local secret comparison
  });

  it('unexpected internal errors return a generic message, not raw error.message', () => {
    const source = readFile('app/api/admin/day1-bonus/route.ts');
    expect(source).toContain("'Failed to process Day 1 leader bonus.'");
    expect(source).not.toMatch(/catch[^}]*error\.message/s);
  });
});

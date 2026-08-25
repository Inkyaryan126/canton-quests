/**
 * Canton Quests — Command Center / Player Card XP Consistency
 *
 * Regression coverage for a mismatch where the homepage correctly showed a
 * player's authoritative lifetime XP (players.total_xp, surfaced via
 * /api/auth/me) while the Command Center / Player Card
 * (/api/player/command-center -> app/profile/page.tsx -> PlayerCard) showed
 * a stale/zero total.
 *
 * Root cause: the Command Center endpoint sourced its `stats.totalXp` from
 * `progress.totalPoints` — a value re-derived per-event from *verified quest
 * submissions* (lib/game-engine.ts getPlayerProgress /
 * lib/supabase-db.ts getPlayerProgressDB) — instead of the authoritative
 * `player.totalXp` (players.total_xp) already present on the same session
 * object. Non-quest rewards like the profile-completion +100 XP (recorded
 * via score_ledger/reward_grants with no associated quest_submission row)
 * were counted toward player.totalXp but silently excluded from
 * progress.totalPoints, so the two surfaces diverged.
 *
 * These tests pin: a single authoritative XP source (player.totalXp) reused
 * by every surface, no client-side/route-handler XP arithmetic, and level
 * staying derived from that same authoritative value everywhere.
 */

import fs from 'fs';
import path from 'path';
import { describe, expect, it, beforeEach } from 'vitest';
import { initializeGameEngine, resetGameEngineStore, registerPlayer } from '../lib/game-engine';
import { mapPlayerFromDB } from '../lib/supabase-db';
import { GET as meRoute } from '../app/api/auth/me/route';
import { POST as profilePostRoute } from '../app/api/player/profile/route';
import { GET as commandCenterRoute } from '../app/api/player/command-center/route';

function authedRequest(url: string, userId: string, init: RequestInit = {}): Request {
  return new Request(url, {
    ...init,
    headers: {
      ...(init.headers as Record<string, string> | undefined),
      Authorization: `Bearer mock-jwt-${userId}`,
    },
  });
}

async function grantProfileCompletion(userId: string, path1: 'family' | 'challenge' | 'secret', presetKey: string) {
  const req = authedRequest('http://localhost:3000/api/player/profile', userId, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ selectedStartingPath: path1, avatarPresetKey: presetKey }),
  });
  const res = await profilePostRoute(req);
  return res.json();
}

describe('Command Center / Player Card XP consistency', () => {
  beforeEach(() => {
    resetGameEngineStore();
    initializeGameEngine();
  });

  it('1. DB/player row with total_xp 100 maps to Player.totalXp 100 through the canonical mapper', () => {
    const mapped = mapPlayerFromDB({
      id: 'plr-db-row',
      display_name: 'RowAgent',
      role: 'player',
      total_xp: 100,
      level: 1,
      created_at: '2026-08-20T00:00:00Z',
    });
    expect(mapped.totalXp).toBe(100);
  });

  it('2. homepage (/api/auth/me) and Command Center (/api/player/command-center) report the same mapped total after a profile-completion grant', async () => {
    registerPlayer({ displayName: 'XPParitySeeker', email: 'xpparity@example.com', userId: 'usr-xp-parity' });

    const savePayload = await grantProfileCompletion('usr-xp-parity', 'family', '1');
    expect(savePayload.profileCompletionReward).toBe(true);
    expect(savePayload.player.totalXp).toBe(100);

    const meRes = await meRoute(authedRequest('http://localhost:3000/api/auth/me', 'usr-xp-parity'));
    const mePayload = await meRes.json();
    expect(mePayload.player.totalXp).toBe(100);

    const ccRes = await commandCenterRoute(authedRequest('http://localhost:3000/api/player/command-center', 'usr-xp-parity'));
    const ccPayload = await ccRes.json();
    expect(ccPayload.stats.totalXp).toBe(100);

    // Same authoritative number on both surfaces — not independently computed.
    expect(ccPayload.stats.totalXp).toBe(mePayload.player.totalXp);
  });

  it('3. profile-completion reward followed by a fresh Command Center refetch produces 100, not the pre-fix 0', async () => {
    registerPlayer({ displayName: 'RefetchAgent', email: 'refetchagent@example.com', userId: 'usr-refetch-agent' });

    const before = await commandCenterRoute(authedRequest('http://localhost:3000/api/player/command-center', 'usr-refetch-agent'));
    expect((await before.json()).stats.totalXp).toBe(0);

    await grantProfileCompletion('usr-refetch-agent', 'challenge', '2');

    const after = await commandCenterRoute(authedRequest('http://localhost:3000/api/player/command-center', 'usr-refetch-agent'));
    const afterPayload = await after.json();
    expect(afterPayload.stats.totalXp).toBe(100);
    // The old bug: progress.totalPoints (submission-only) stayed 0 because
    // the profile-completion reward has no associated quest_submission.
    expect(afterPayload.progress.completedQuestIds).toHaveLength(0);
  });

  it('4. refreshing (repeated Command Center refetch) preserves 100 — no drift back to the derived progress field', async () => {
    registerPlayer({ displayName: 'RefreshAgent', email: 'refreshagent@example.com', userId: 'usr-refresh-agent' });
    await grantProfileCompletion('usr-refresh-agent', 'secret', '3');

    for (let i = 0; i < 3; i += 1) {
      const res = await commandCenterRoute(authedRequest('http://localhost:3000/api/player/command-center', 'usr-refresh-agent'));
      const payload = await res.json();
      expect(payload.stats.totalXp).toBe(100);
    }
  });

  it('5. logout/login (re-resolving the same authenticated player from scratch) preserves 100', async () => {
    registerPlayer({ displayName: 'ReloginAgent', email: 'reloginagent@example.com', userId: 'usr-relogin-agent' });
    await grantProfileCompletion('usr-relogin-agent', 'family', '4');

    // A brand-new request object per call simulates a fresh session resolve
    // (logout clears client state; login re-derives the player from the DB).
    const firstSession = await commandCenterRoute(authedRequest('http://localhost:3000/api/player/command-center', 'usr-relogin-agent'));
    const secondSession = await commandCenterRoute(authedRequest('http://localhost:3000/api/player/command-center', 'usr-relogin-agent'));

    expect((await firstSession.json()).stats.totalXp).toBe(100);
    expect((await secondSession.json()).stats.totalXp).toBe(100);
  });

  it('6. no client-only +100 arithmetic computes the profile-completion response player — the persisted row is re-read instead', () => {
    const profileRouteSource = fs.readFileSync(path.join(process.cwd(), 'app/api/player/profile/route.ts'), 'utf8');
    const profileImageRouteSource = fs.readFileSync(path.join(process.cwd(), 'app/api/player/profile-image/route.ts'), 'utf8');

    for (const source of [profileRouteSource, profileImageRouteSource]) {
      expect(source).not.toMatch(/totalXp:\s*updated\.totalXp\s*\+/);
      expect(source).not.toMatch(/level:\s*Math\.floor\(\(updated\.totalXp/);
      expect(source).toContain('getPlayerByIdDB');
    }
  });

  it('7. level stays consistent with the authoritative floor(totalXp/250)+1 formula everywhere, including the Command Center response', async () => {
    registerPlayer({ displayName: 'LevelAgent', email: 'levelagent@example.com', userId: 'usr-level-agent' });
    await grantProfileCompletion('usr-level-agent', 'secret', '5');

    const ccRes = await commandCenterRoute(authedRequest('http://localhost:3000/api/player/command-center', 'usr-level-agent'));
    const ccPayload = await ccRes.json();

    expect(ccPayload.player.totalXp).toBe(100);
    expect(ccPayload.player.level).toBe(Math.floor(100 / 250) + 1);

    // The profile page must display that authoritative level, not
    // recompute it locally with a different (previously mismatched) divisor.
    const profilePageSource = fs.readFileSync(path.join(process.cwd(), 'app/profile/page.tsx'), 'utf8');
    expect(profilePageSource).not.toMatch(/totalXp[^)]*\)\s*\/\s*500/);
    expect(profilePageSource).toContain('data.player.level');
  });

  it('8. Command Center stats.totalXp is sourced from the authoritative player.totalXp field, not the derived progress.totalPoints', () => {
    const routeSource = fs.readFileSync(path.join(process.cwd(), 'app/api/player/command-center/route.ts'), 'utf8');
    expect(routeSource).toMatch(/totalXp:\s*player\.totalXp/);
    expect(routeSource).not.toMatch(/stats:\s*\{\s*totalXp:\s*progress\.totalPoints/);
  });
});

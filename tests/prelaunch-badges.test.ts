/**
 * Canton Quests — Pre-launch badges.
 *
 * "First to Arrive" (enter a Mission), "Path Chosen" (pick a starting
 * path), and "Field Ready" (complete a real avatar) are all earnable
 * before a Mission officially opens — none of them require a verified
 * quest submission. Field Ready's own grant is covered end-to-end in
 * tests/profile-completion-reward.test.ts (it piggybacks on the existing
 * PROFILE_COMPLETION reward); this file covers the other two, plus the
 * catalog and pre-launch-timing guarantees shared by all three.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import {
  initializeGameEngine,
  resetGameEngineStore,
  registerPlayer,
  getAchievementsForPlayer,
} from '../lib/game-engine';
import { SEED_ACHIEVEMENTS, SEED_EVENT } from '../lib/seed-data';
import { isPreLaunchEvent } from '../lib/launch-status';
import { POST as enterOperationRoute } from '../app/api/game/operations/[slug]/enter/route';

function authedRequest(url: string, userId: string, init: RequestInit = {}): Request {
  return new Request(url, {
    ...init,
    headers: {
      ...(init.headers as Record<string, string> | undefined),
      'Content-Type': 'application/json',
      Authorization: `Bearer mock-jwt-${userId}`,
    },
  });
}

function enterRequest(userId: string, path?: string): Request {
  return authedRequest(`http://localhost:3000/api/game/operations/${SEED_EVENT.slug}/enter`, userId, {
    method: 'POST',
    body: JSON.stringify(path ? { path } : {}),
  });
}

describe('Pre-launch badge catalog', () => {
  it('defines all three pre-launch badges with real, non-empty copy', () => {
    for (const slug of ['first-to-arrive', 'path-chosen', 'field-ready']) {
      const badge = SEED_ACHIEVEMENTS.find((a) => a.slug === slug);
      expect(badge, `missing catalog entry for ${slug}`).toBeDefined();
      expect(badge!.name.length).toBeGreaterThan(0);
      expect(badge!.description.length).toBeGreaterThan(10);
      expect(badge!.badgeSymbol.length).toBeGreaterThan(0);
    }
  });

  it('canton-weekend-1 is genuinely pre-launch today, so these badges are only meaningful if earnable before the Mission opens', () => {
    // Not a stale assumption — this exercises the real gate function a
    // player-facing "earn this before launch" claim depends on.
    expect(isPreLaunchEvent(SEED_EVENT, SEED_EVENT.slug)).toBe(true);
  });
});

describe('"First to Arrive" — granted on Mission entry, before launch', () => {
  beforeEach(() => {
    resetGameEngineStore();
    initializeGameEngine();
  });

  it('is granted the first time an authenticated player enters a known Canton Quests Mission', async () => {
    registerPlayer({ displayName: 'EarlyBird', userId: 'usr-early-bird' });
    const res = await enterOperationRoute(enterRequest('usr-early-bird'), { params: { slug: SEED_EVENT.slug } });
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(Array.isArray(data.newAchievements)).toBe(true);
    const slugs = data.newAchievements.map((pa: any) => pa.achievementSlug);
    expect(slugs).toContain('first-to-arrive');
  });

  it('is never granted twice — a second entry returns no new achievements', async () => {
    registerPlayer({ displayName: 'ReturnVisitor', userId: 'usr-return-visitor' });
    await enterOperationRoute(enterRequest('usr-return-visitor'), { params: { slug: SEED_EVENT.slug } });

    const second = await enterOperationRoute(enterRequest('usr-return-visitor'), { params: { slug: SEED_EVENT.slug } });
    const data = await second.json();
    expect(data.success).toBe(true);
    expect(data.newAchievements).toEqual([]);
  });

  it('persists — the player genuinely owns the badge afterward, not just in the one-shot response', async () => {
    const player = registerPlayer({ displayName: 'Persisted', userId: 'usr-persisted' });
    await enterOperationRoute(enterRequest('usr-persisted'), { params: { slug: SEED_EVENT.slug } });

    const earned = getAchievementsForPlayer(player.id);
    expect(earned.some((pa) => pa.achievementSlug === 'first-to-arrive')).toBe(true);
  });
});

describe('"Path Chosen" — granted on first universal path selection', () => {
  beforeEach(() => {
    resetGameEngineStore();
    initializeGameEngine();
  });

  it('is NOT granted on a plain entry with no path submitted', async () => {
    registerPlayer({ displayName: 'NoPathYet', userId: 'usr-no-path-yet' });
    const res = await enterOperationRoute(enterRequest('usr-no-path-yet'), { params: { slug: SEED_EVENT.slug } });
    const data = await res.json();
    const slugs = data.newAchievements.map((pa: any) => pa.achievementSlug);
    expect(slugs).not.toContain('path-chosen');
  });

  it('is granted the moment a path is submitted', async () => {
    registerPlayer({ displayName: 'PathPicker', userId: 'usr-path-picker' });
    const res = await enterOperationRoute(enterRequest('usr-path-picker', 'secret'), { params: { slug: SEED_EVENT.slug } });
    const data = await res.json();
    expect(data.success).toBe(true);
    const slugs = data.newAchievements.map((pa: any) => pa.achievementSlug);
    expect(slugs).toContain('path-chosen');
    expect(slugs).toContain('first-to-arrive'); // both fire together on a first-ever entry-with-path
  });

  it('is never granted twice — re-submitting a path (or any later entry) grants nothing new', async () => {
    registerPlayer({ displayName: 'PathPickerTwice', userId: 'usr-path-picker-2' });
    await enterOperationRoute(enterRequest('usr-path-picker-2', 'family'), { params: { slug: SEED_EVENT.slug } });

    const second = await enterOperationRoute(enterRequest('usr-path-picker-2'), { params: { slug: SEED_EVENT.slug } });
    const data = await second.json();
    expect(data.newAchievements).toEqual([]);
  });
});

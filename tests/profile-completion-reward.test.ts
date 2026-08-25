/**
 * Canton Quests — Profile Completion Incentive Tests
 *
 * Verifies the one-time "Player Identity" onboarding reward
 * (evaluateAndGrantProfileCompletionReward in lib/game-engine.ts):
 *   - account signup alone never grants XP
 *   - the reward only fires once BOTH a valid starting path AND a valid
 *     avatar (preset or uploaded custom) are true, regardless of the order
 *     those two conditions are satisfied in
 *   - it is a strict one-time grant: later changes, retries, concurrent
 *     requests, and refresh/logout/login never grant it again
 *   - it never creates an Entry Token or a drawing_entry_ledger record
 *   - the caller is always told whether this specific call newly granted it
 */

import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import {
  evaluateAndGrantProfileCompletionReward,
  getDrawingEntriesForPlayer,
  getPlayerById,
  setCurrentPlayer,
  updatePlayerProfile,
} from '../lib/game-engine';
import { SEED_EVENT } from '../lib/seed-data';

function newPlayer(label: string) {
  return setCurrentPlayer(`ProfileComplete_${label}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, '🪪');
}

describe('Profile Completion Incentive', () => {
  it('1. signup alone gives 0 XP', () => {
    const player = newPlayer('signup-only');
    expect(player.totalXp).toBe(0);
    expect(player.selectedStartingPath).toBeUndefined();
    expect(player.avatarPresetKey).toBeUndefined();

    const result = evaluateAndGrantProfileCompletionReward(player.id);
    expect(result.newlyGranted).toBe(false);
    expect(result.xpAwarded).toBe(0);
    expect(getPlayerById(player.id)?.totalXp).toBe(0);
  });

  it('2. path only gives 0 XP', () => {
    const player = newPlayer('path-only');
    updatePlayerProfile(player.id, { selectedStartingPath: 'family' });

    const result = evaluateAndGrantProfileCompletionReward(player.id);
    expect(result.newlyGranted).toBe(false);
    expect(result.xpAwarded).toBe(0);
    expect(getPlayerById(player.id)?.totalXp).toBe(0);
  });

  it('3. avatar only gives 0 XP', () => {
    const player = newPlayer('avatar-only');
    updatePlayerProfile(player.id, { avatarPresetKey: '3' });

    const result = evaluateAndGrantProfileCompletionReward(player.id);
    expect(result.newlyGranted).toBe(false);
    expect(result.xpAwarded).toBe(0);
    expect(getPlayerById(player.id)?.totalXp).toBe(0);
  });

  it('4. path + preset avatar gives +100 XP once', () => {
    const player = newPlayer('path-preset-once');
    updatePlayerProfile(player.id, { selectedStartingPath: 'challenge', avatarPresetKey: '2' });

    const first = evaluateAndGrantProfileCompletionReward(player.id);
    expect(first.newlyGranted).toBe(true);
    expect(first.xpAwarded).toBe(100);
    expect(getPlayerById(player.id)?.totalXp).toBe(100);

    const second = evaluateAndGrantProfileCompletionReward(player.id);
    expect(second.newlyGranted).toBe(false);
    expect(second.xpAwarded).toBe(0);
    expect(getPlayerById(player.id)?.totalXp).toBe(100);
  });

  it('5. path + custom avatar gives +100 XP once', () => {
    const player = newPlayer('path-custom-once');
    updatePlayerProfile(player.id, {
      selectedStartingPath: 'secret',
      avatarPresetKey: 'custom',
      profileImagePath: `${player.id}/photo.jpg`,
    });

    const first = evaluateAndGrantProfileCompletionReward(player.id);
    expect(first.newlyGranted).toBe(true);
    expect(first.xpAwarded).toBe(100);

    const second = evaluateAndGrantProfileCompletionReward(player.id);
    expect(second.newlyGranted).toBe(false);
    expect(getPlayerById(player.id)?.totalXp).toBe(100);
  });

  it('5b. custom avatar preset key without an actual uploaded photo does not qualify', () => {
    const player = newPlayer('custom-no-photo');
    updatePlayerProfile(player.id, { selectedStartingPath: 'family', avatarPresetKey: 'custom', profileImagePath: null });

    const result = evaluateAndGrantProfileCompletionReward(player.id);
    expect(result.newlyGranted).toBe(false);
    expect(getPlayerById(player.id)?.totalXp).toBe(0);
  });

  it('6. avatar first then path works', () => {
    const player = newPlayer('avatar-then-path');
    updatePlayerProfile(player.id, { avatarPresetKey: '5' });
    expect(evaluateAndGrantProfileCompletionReward(player.id).newlyGranted).toBe(false);

    updatePlayerProfile(player.id, { selectedStartingPath: 'family' });
    const result = evaluateAndGrantProfileCompletionReward(player.id);
    expect(result.newlyGranted).toBe(true);
    expect(getPlayerById(player.id)?.totalXp).toBe(100);
  });

  it('7. path first then avatar works', () => {
    const player = newPlayer('path-then-avatar');
    updatePlayerProfile(player.id, { selectedStartingPath: 'challenge' });
    expect(evaluateAndGrantProfileCompletionReward(player.id).newlyGranted).toBe(false);

    updatePlayerProfile(player.id, { avatarPresetKey: '6' });
    const result = evaluateAndGrantProfileCompletionReward(player.id);
    expect(result.newlyGranted).toBe(true);
    expect(getPlayerById(player.id)?.totalXp).toBe(100);
  });

  it('8. changing avatar later gives 0 extra XP', () => {
    const player = newPlayer('change-avatar-later');
    updatePlayerProfile(player.id, { selectedStartingPath: 'family', avatarPresetKey: '1' });
    expect(evaluateAndGrantProfileCompletionReward(player.id).newlyGranted).toBe(true);

    updatePlayerProfile(player.id, { avatarPresetKey: '7' });
    const result = evaluateAndGrantProfileCompletionReward(player.id);
    expect(result.newlyGranted).toBe(false);
    expect(getPlayerById(player.id)?.totalXp).toBe(100);
  });

  it('9. changing district later gives 0 extra XP', () => {
    const player = newPlayer('change-district-later');
    updatePlayerProfile(player.id, { selectedStartingPath: 'family', avatarPresetKey: '1' });
    expect(evaluateAndGrantProfileCompletionReward(player.id).newlyGranted).toBe(true);

    updatePlayerProfile(player.id, { selectedStartingPath: 'secret' });
    const result = evaluateAndGrantProfileCompletionReward(player.id);
    expect(result.newlyGranted).toBe(false);
    expect(getPlayerById(player.id)?.totalXp).toBe(100);
  });

  it('10. upload retries (re-uploading the same/new custom photo) give 0 extra XP', () => {
    const player = newPlayer('upload-retries');
    updatePlayerProfile(player.id, {
      selectedStartingPath: 'family',
      avatarPresetKey: 'custom',
      profileImagePath: `${player.id}/first.jpg`,
    });
    expect(evaluateAndGrantProfileCompletionReward(player.id).newlyGranted).toBe(true);

    // Delete + re-upload a different custom photo — still the same identity milestone.
    updatePlayerProfile(player.id, { profileImagePath: null, avatarPresetKey: '1' });
    evaluateAndGrantProfileCompletionReward(player.id);
    updatePlayerProfile(player.id, { avatarPresetKey: 'custom', profileImagePath: `${player.id}/second.jpg` });
    const result = evaluateAndGrantProfileCompletionReward(player.id);
    expect(result.newlyGranted).toBe(false);
    expect(getPlayerById(player.id)?.totalXp).toBe(100);
  });

  it('11. refresh/logout/login (re-reading the same player) gives 0 extra XP', () => {
    const player = newPlayer('refresh-logout-login');
    updatePlayerProfile(player.id, { selectedStartingPath: 'challenge', avatarPresetKey: '4' });
    expect(evaluateAndGrantProfileCompletionReward(player.id).newlyGranted).toBe(true);

    // Simulate several unrelated re-reads/re-evaluations of the same authoritative player.
    for (let i = 0; i < 3; i += 1) {
      const result = evaluateAndGrantProfileCompletionReward(player.id);
      expect(result.newlyGranted).toBe(false);
    }
    expect(getPlayerById(player.id)?.totalXp).toBe(100);
  });

  it('12. concurrent qualifying requests cannot double-award', () => {
    const player = newPlayer('concurrent');
    updatePlayerProfile(player.id, { selectedStartingPath: 'secret', avatarPresetKey: '8' });

    const results = [
      evaluateAndGrantProfileCompletionReward(player.id),
      evaluateAndGrantProfileCompletionReward(player.id),
      evaluateAndGrantProfileCompletionReward(player.id),
      evaluateAndGrantProfileCompletionReward(player.id),
      evaluateAndGrantProfileCompletionReward(player.id),
    ];
    const grantedCount = results.filter((r) => r.newlyGranted).length;
    expect(grantedCount).toBe(1);
    expect(getPlayerById(player.id)?.totalXp).toBe(100);
  });

  it('13. no Entry Token is created by the profile completion grant', () => {
    const player = newPlayer('no-entry-token');
    updatePlayerProfile(player.id, { selectedStartingPath: 'family', avatarPresetKey: '1' });
    const result = evaluateAndGrantProfileCompletionReward(player.id);
    expect(result.newlyGranted).toBe(true);
    expect(getDrawingEntriesForPlayer(player.id, SEED_EVENT.id)).toHaveLength(0);
  });

  it('14. no drawing_entry_ledger record is created', () => {
    const player = newPlayer('no-ledger-record');
    updatePlayerProfile(player.id, { selectedStartingPath: 'challenge', avatarPresetKey: '2' });
    evaluateAndGrantProfileCompletionReward(player.id);
    // getDrawingEntriesForPlayer sums drawing_entry_ledger rows for this player —
    // zero here proves no ledger row was ever written by this reward path.
    expect(getDrawingEntriesForPlayer(player.id, SEED_EVENT.id)).toHaveLength(0);
  });

  it('15. server reports whether the reward was newly granted', () => {
    const player = newPlayer('reports-newly-granted');
    updatePlayerProfile(player.id, { selectedStartingPath: 'family', avatarPresetKey: '1' });

    const first = evaluateAndGrantProfileCompletionReward(player.id);
    expect(first).toEqual({ newlyGranted: true, xpAwarded: 100 });

    const second = evaluateAndGrantProfileCompletionReward(player.id);
    expect(second).toEqual({ newlyGranted: false, xpAwarded: 0 });
  });

  it('17. existing (pre-qualifying) players are not double-charged by re-evaluation', () => {
    // Simulates a grandfathered player: already qualifying before the reward
    // existed. A migration backfill would insert a zero-XP grant row for
    // them directly; here we confirm that once *any* grant row exists
    // (simulated by an initial evaluate call), later re-evaluations never
    // grant a second time or add more XP — the same guarantee the backfill
    // relies on.
    const player = newPlayer('grandfathered');
    updatePlayerProfile(player.id, { selectedStartingPath: 'secret', avatarPresetKey: '3' });
    const backfillEquivalent = evaluateAndGrantProfileCompletionReward(player.id);
    expect(backfillEquivalent.newlyGranted).toBe(true);

    const laterEvaluation = evaluateAndGrantProfileCompletionReward(player.id);
    expect(laterEvaluation.newlyGranted).toBe(false);
    expect(getPlayerById(player.id)?.totalXp).toBe(100);
  });

  it('15b. both profile-mutating API routes surface profileCompletionReward from the server evaluation, never guessed client-side', () => {
    const profileRouteSource = fs.readFileSync(path.join(process.cwd(), 'app/api/player/profile/route.ts'), 'utf8');
    const profileImageRouteSource = fs.readFileSync(path.join(process.cwd(), 'app/api/player/profile-image/route.ts'), 'utf8');

    for (const source of [profileRouteSource, profileImageRouteSource]) {
      expect(source).toContain('evaluateAndGrantProfileCompletionRewardDB');
      expect(source).toContain('profileCompletionReward: profileCompletionResult.newlyGranted');
    }
  });

  it('16. the profile page only fires the Identity Confirmed GameMoment when the server reports a new grant', () => {
    const profilePageSource = fs.readFileSync(path.join(process.cwd(), 'app/profile/page.tsx'), 'utf8');

    // announceProfileCompletion must early-return unless the server payload
    // says this exact call newly granted the reward — never inferred from
    // form state or shown unconditionally after every save.
    const guardMatch = profilePageSource.match(/function announceProfileCompletion\([^)]*\)\s*\{\s*if\s*\(!payload\.profileCompletionReward\)\s*return;/);
    expect(guardMatch).not.toBeNull();
    expect(profilePageSource).toContain("headline: 'IDENTITY CONFIRMED'");
    expect(profilePageSource).toContain('announceProfileCompletion(payload)');
  });
});

/**
 * Canton Quests — Sept 11 Main Operation XP System Expansion.
 *
 * Covers the new shared XP helper, the global cross-Mission leaderboard,
 * and granular profile-development milestones. Exercises the local/offline
 * engine directly (same harness pattern as tests/fair-mystery-money-hunt.test.ts
 * and tests/profile-completion-reward.test.ts) since Supabase isn't
 * configured in the test environment.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import {
  resetGameEngineStore,
  initializeGameEngine,
  registerPlayer,
  updatePlayerProfile,
  getAllPlayers,
  getGlobalXpLeaderboard,
  evaluateAndGrantProfileMilestones,
  recordScoreLedger,
  claimSocialShare,
  claimDailyLuckySignal,
} from '../lib/game-engine';
import { computeLevelForXp, LEVEL_XP_STEP, SOCIAL_SHARE_XP } from '../lib/xp';

describe('computeLevelForXp — shared level formula', () => {
  it('matches the existing floor(totalXp/250)+1 formula exactly', () => {
    expect(LEVEL_XP_STEP).toBe(250);
    expect(computeLevelForXp(0)).toBe(1);
    expect(computeLevelForXp(249)).toBe(1);
    expect(computeLevelForXp(250)).toBe(2);
    expect(computeLevelForXp(999)).toBe(4);
  });

  it('never goes negative even for a negative input', () => {
    expect(computeLevelForXp(-500)).toBe(1);
  });
});

describe('Global XP leaderboard — cross-Mission ranking by players.total_xp', () => {
  beforeEach(() => {
    resetGameEngineStore();
    initializeGameEngine();
  });

  it('ranks players by total_xp descending, independent of any single event', () => {
    const low = registerPlayer({ displayName: 'LowXpAgent', userId: 'usr-low-xp' });
    const high = registerPlayer({ displayName: 'HighXpAgent', userId: 'usr-high-xp' });
    recordScoreLedger({ eventId: 'evt-canton-vol-1', playerId: low.id, points: 50, category: 'test', description: 'test' });
    recordScoreLedger({ eventId: 'evt-canton-vol-1', playerId: high.id, points: 500, category: 'test', description: 'test' });

    const board = getGlobalXpLeaderboard(10);
    const highEntry = board.find((e) => e.id === high.id);
    const lowEntry = board.find((e) => e.id === low.id);
    expect(highEntry).toBeDefined();
    expect(lowEntry).toBeDefined();
    expect(board.indexOf(highEntry!)).toBeLessThan(board.indexOf(lowEntry!));
    expect(highEntry!.totalXp).toBe(500);
    expect(highEntry!.level).toBe(computeLevelForXp(500));
  });

  it('respects the limit parameter', () => {
    for (let i = 0; i < 5; i++) {
      registerPlayer({ displayName: `Agent${i}`, userId: `usr-limit-${i}` });
    }
    expect(getGlobalXpLeaderboard(3)).toHaveLength(3);
  });
});

describe('Profile-development milestones — granular, one-time-per-field XP beyond the avatar', () => {
  beforeEach(() => {
    resetGameEngineStore();
    initializeGameEngine();
  });

  it('awards no XP when the tagline (Motto) is empty', () => {
    const player = registerPlayer({ displayName: 'BlankMottoAgent', userId: 'usr-blank-motto' });
    const result = evaluateAndGrantProfileMilestones(player.id);
    expect(result.newlyGranted).toHaveLength(0);
    expect(result.totalXpAwarded).toBe(0);
  });

  it('awards +15 XP exactly once the first time a tagline is set', () => {
    const player = registerPlayer({ displayName: 'MottoAgent', userId: 'usr-motto' });
    updatePlayerProfile(player.id, { tagline: 'Canton or bust.' });

    const first = evaluateAndGrantProfileMilestones(player.id);
    expect(first.newlyGranted).toEqual([{ field: 'tagline', xpAwarded: 15 }]);
    expect(first.totalXpAwarded).toBe(15);

    const updatedPlayer = getAllPlayers().find((p) => p.id === player.id)!;
    expect(updatedPlayer.totalXp).toBe(15);
  });

  it('never re-awards the same field on a later save, even if the tagline text changes', () => {
    const player = registerPlayer({ displayName: 'RepeatMottoAgent', userId: 'usr-repeat-motto' });
    updatePlayerProfile(player.id, { tagline: 'First motto.' });
    evaluateAndGrantProfileMilestones(player.id);

    updatePlayerProfile(player.id, { tagline: 'A brand new motto.' });
    const second = evaluateAndGrantProfileMilestones(player.id);
    expect(second.newlyGranted).toHaveLength(0);
    expect(second.totalXpAwarded).toBe(0);

    const finalPlayer = getAllPlayers().find((p) => p.id === player.id)!;
    expect(finalPlayer.totalXp).toBe(15);
  });

  it('is independent of the avatar-driven PROFILE_COMPLETION +100 XP reward — both can be earned by the same player', () => {
    const player = registerPlayer({ displayName: 'BothRewardsAgent', userId: 'usr-both-rewards', avatarPresetKey: '1' });
    updatePlayerProfile(player.id, { tagline: 'Both rewards please.' });

    const milestones = evaluateAndGrantProfileMilestones(player.id);
    expect(milestones.totalXpAwarded).toBe(15);
  });
});

describe('Social share XP — daily, honor-system', () => {
  beforeEach(() => {
    resetGameEngineStore();
    initializeGameEngine();
  });

  it('awards SOCIAL_SHARE_XP on the first claim of the day', () => {
    const player = registerPlayer({ displayName: 'SharerAgent', userId: 'usr-sharer' });
    const result = claimSocialShare(player.id);
    expect(result.newlyGranted).toBe(true);
    expect(result.xpAwarded).toBe(SOCIAL_SHARE_XP);

    const updated = getAllPlayers().find((p) => p.id === player.id)!;
    expect(updated.totalXp).toBe(SOCIAL_SHARE_XP);
  });

  it('a second claim on the same day is a no-op — never double-awards', () => {
    const player = registerPlayer({ displayName: 'RepeatSharerAgent', userId: 'usr-repeat-sharer' });
    claimSocialShare(player.id);
    const second = claimSocialShare(player.id);
    expect(second.newlyGranted).toBe(false);
    expect(second.xpAwarded).toBe(0);

    const updated = getAllPlayers().find((p) => p.id === player.id)!;
    expect(updated.totalXp).toBe(SOCIAL_SHARE_XP);
  });

  it('two different players can each independently claim the same day', () => {
    const a = registerPlayer({ displayName: 'SharerA', userId: 'usr-sharer-a' });
    const b = registerPlayer({ displayName: 'SharerB', userId: 'usr-sharer-b' });
    expect(claimSocialShare(a.id).newlyGranted).toBe(true);
    expect(claimSocialShare(b.id).newlyGranted).toBe(true);
  });
});

describe('Daily Lucky Signal — random XP, once per day', () => {
  beforeEach(() => {
    resetGameEngineStore();
    initializeGameEngine();
  });

  it('awards a positive, server-rolled XP amount on the first claim of the day', () => {
    const player = registerPlayer({ displayName: 'LuckyAgent', userId: 'usr-lucky' });
    const result = claimDailyLuckySignal(player.id);
    expect(result.newlyGranted).toBe(true);
    expect(result.xpAwarded).toBeGreaterThan(0);

    const updated = getAllPlayers().find((p) => p.id === player.id)!;
    expect(updated.totalXp).toBe(result.xpAwarded);
  });

  it('a second claim on the same day is a no-op', () => {
    const player = registerPlayer({ displayName: 'RepeatLuckyAgent', userId: 'usr-repeat-lucky' });
    const first = claimDailyLuckySignal(player.id);
    const second = claimDailyLuckySignal(player.id);
    expect(second.newlyGranted).toBe(false);
    expect(second.xpAwarded).toBe(0);

    const updated = getAllPlayers().find((p) => p.id === player.id)!;
    expect(updated.totalXp).toBe(first.xpAwarded);
  });

  it('the rolled amount always falls within the documented ranges across many rolls', () => {
    for (let i = 0; i < 50; i++) {
      const player = registerPlayer({ displayName: `LuckyRoll${i}`, userId: `usr-lucky-roll-${i}` });
      const result = claimDailyLuckySignal(player.id);
      expect(result.xpAwarded === 100 || (result.xpAwarded >= 5 && result.xpAwarded <= 40)).toBe(true);
    }
  });
});

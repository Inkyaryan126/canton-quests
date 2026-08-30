/**
 * Canton Quests — Player Card MOTTO + PLAYER LEVEL participation coverage.
 *
 * MOTTO reuses the existing `players.tagline` field (already persisted via
 * updatePlayerProfile / app/api/player/profile/route.ts, already rendered
 * elsewhere as a quote in PlayerIdentityBar) — no new column.
 *
 * PLAYER LEVEL counts distinct quests a player has ever submitted for
 * (lib/game-engine.ts getParticipatedQuestCount / lib/supabase-db.ts
 * getParticipatedQuestCountDB), lifetime and cross-Mission, on the theory
 * that any submission row (verified, pending, or rejected) is credible
 * evidence of actual engagement — unlike a merely-available quest, which
 * never produces a submission row at all.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import {
  getParticipatedQuestCount,
  getPlayerById,
  initializeGameEngine,
  setCurrentPlayer,
  submitQuestProof,
  updatePlayerProfile,
} from '../lib/game-engine';
import { SEED_EVENT } from '../lib/seed-data';

describe('MOTTO — reuses players.tagline, no duplicate field', () => {
  beforeEach(() => {
    initializeGameEngine();
  });

  it('is empty/undefined by default and is never fabricated', () => {
    const player = setCurrentPlayer('MottoAgent_Fresh', '🪪');
    expect(player.tagline).toBeUndefined();
  });

  it('saves and reads back a Motto through the same profile-update path as other fields', () => {
    const player = setCurrentPlayer('MottoAgent_Save', '🪪');
    updatePlayerProfile(player.id, { tagline: 'Adventure is out there.' });
    expect(getPlayerById(player.id)?.tagline).toBe('Adventure is out there.');
  });

  it('is optional — a player with no Motto is unaffected by unrelated profile updates', () => {
    const player = setCurrentPlayer('MottoAgent_Optional', '🪪');
    updatePlayerProfile(player.id, { avatarPresetKey: '4' });
    expect(getPlayerById(player.id)?.tagline).toBeUndefined();
  });

  it('can be cleared back to empty', () => {
    const player = setCurrentPlayer('MottoAgent_Clear', '🪪');
    updatePlayerProfile(player.id, { tagline: 'Temporary line.' });
    expect(getPlayerById(player.id)?.tagline).toBe('Temporary line.');
    updatePlayerProfile(player.id, { tagline: '' });
    expect(getPlayerById(player.id)?.tagline).toBeFalsy();
  });
});

describe('PLAYER LEVEL — distinct-quest participation, lifetime scope', () => {
  beforeEach(() => {
    initializeGameEngine();
  });

  it('0 submissions → 0 participated quests', () => {
    const player = setCurrentPlayer('LevelAgent_Zero', '🎯');
    expect(getParticipatedQuestCount(player.id)).toBe(0);
  });

  it('1 successful submission → 1 participated quest', () => {
    const player = setCurrentPlayer('LevelAgent_One', '🎯');
    const result = submitQuestProof({
      playerId: player.id,
      questId: 'qst-centennial-discovery',
      eventId: SEED_EVENT.id,
      proofType: 'checkin',
      submittedContent: 'GPS Checkin Confirmed',
      userLat: 40.7989,
      userLon: -81.3748,
    });
    expect(result.success).toBe(true);
    expect(getParticipatedQuestCount(player.id)).toBe(1);
  });

  it('a rejected submission still counts as participation (credible evidence of engagement, even if unsuccessful)', () => {
    const player = setCurrentPlayer('LevelAgent_Rejected', '🎯');
    const result = submitQuestProof({
      playerId: player.id,
      questId: 'qst-palace-theatre-year',
      eventId: SEED_EVENT.id,
      proofType: 'passphrase',
      submittedContent: 'definitely-wrong-answer',
    });
    expect(result.success).toBe(false);
    expect(result.submission.status).toBe('rejected');
    expect(getParticipatedQuestCount(player.id)).toBe(1);
  });

  it('a pending (Game-Master-review) submission counts as participation', () => {
    const player = setCurrentPlayer('LevelAgent_Pending', '🎯');
    submitQuestProof({
      playerId: player.id,
      questId: 'qst-4th-st-mural-photo',
      eventId: SEED_EVENT.id,
      proofType: 'photo',
      proofUrl: 'https://example.com/proof.jpg',
    });
    expect(getParticipatedQuestCount(player.id)).toBe(1);
  });

  it('multiple distinct quests → count matches the number of distinct quests, regardless of individual outcomes', () => {
    const player = setCurrentPlayer('LevelAgent_Multi', '🎯');
    submitQuestProof({
      playerId: player.id,
      questId: 'qst-centennial-discovery',
      eventId: SEED_EVENT.id,
      proofType: 'checkin',
      submittedContent: 'GPS Checkin Confirmed',
      userLat: 40.7989,
      userLon: -81.3748,
    });
    submitQuestProof({
      playerId: player.id,
      questId: 'qst-palace-theatre-year',
      eventId: SEED_EVENT.id,
      proofType: 'passphrase',
      submittedContent: 'wrong-answer',
    });
    submitQuestProof({
      playerId: player.id,
      questId: 'qst-4th-st-mural-photo',
      eventId: SEED_EVENT.id,
      proofType: 'photo',
      proofUrl: 'https://example.com/proof.jpg',
    });
    expect(getParticipatedQuestCount(player.id)).toBe(3);
  });

  it('does not double-count repeat submissions/attempts for the same quest', () => {
    const player = setCurrentPlayer('LevelAgent_Repeat', '🎯');
    submitQuestProof({
      playerId: player.id,
      questId: 'qst-palace-theatre-year',
      eventId: SEED_EVENT.id,
      proofType: 'passphrase',
      submittedContent: 'wrong-once',
    });
    submitQuestProof({
      playerId: player.id,
      questId: 'qst-palace-theatre-year',
      eventId: SEED_EVENT.id,
      proofType: 'passphrase',
      submittedContent: 'wrong-twice',
    });
    expect(getParticipatedQuestCount(player.id)).toBe(1);
  });

  it('is lifetime/cross-event scoped — participation from any Mission counts, not just the default event', () => {
    const player = setCurrentPlayer('LevelAgent_CrossEvent', '🎯');
    submitQuestProof({
      playerId: player.id,
      questId: 'qst-centennial-discovery',
      eventId: SEED_EVENT.id,
      proofType: 'checkin',
      submittedContent: 'GPS Checkin Confirmed',
      userLat: 40.7989,
      userLon: -81.3748,
    });
    // getParticipatedQuestCount takes no eventId — confirms it is not
    // scoped to a single Mission the way getPlayerProgress is.
    expect(getParticipatedQuestCount.length).toBe(1);
    expect(getParticipatedQuestCount(player.id)).toBe(1);
  });

  it('does not count a quest merely being available/seeded — only players with real submissions are counted', () => {
    const player = setCurrentPlayer('LevelAgent_Unengaged', '🎯');
    // No submitQuestProof call at all for this player.
    expect(getParticipatedQuestCount(player.id)).toBe(0);
  });
});

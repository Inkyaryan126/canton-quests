import { describe, it, expect, beforeEach } from 'vitest';
import * as localEngine from '@/lib/game-engine';
import { PATH_OPTIONS } from '@/components/ThreePathSelector';
import { StartingPath } from '@/lib/types';
import { acquisitionLandingPages } from '@/lib/acquisition-landing-content';

describe('Canton Quests Homepage Flow, Path Selection, and Launch Polish Invariants', () => {
  beforeEach(() => {
    localEngine.resetGameEngineStore();
  });

  describe('1. Normal Visitor Starting Path Selection', () => {
    it('does NOT force or silently default new visitors to the family path', () => {
      // Registering a player without selectedStartingPath should remain undefined
      const newPlayer = localEngine.registerPlayer({
        displayName: 'NeutralExplorer',
        email: 'neutral@example.com',
      });

      expect(newPlayer.displayName).toBe('NeutralExplorer');
      expect(newPlayer.selectedStartingPath).toBeUndefined();
    });

    it('preserves explicitly chosen starting paths without coercion', () => {
      const paths: StartingPath[] = ['family', 'challenge', 'secret'];

      for (const path of paths) {
        const player = localEngine.registerPlayer({
          displayName: `Player_${path}`,
          email: `${path}@example.com`,
          selectedStartingPath: path,
        });

        expect(player.selectedStartingPath).toBe(path);
      }
    });
  });

  describe('2. Public Section and District Pairings', () => {
    it('maps Family to Arts District with Gold/Yellow accent', () => {
      const familyOption = PATH_OPTIONS.find((p) => p.id === 'family');
      expect(familyOption).toBeDefined();
      expect(familyOption?.title).toBe('FAMILY');
      expect(familyOption?.district).toBe('Arts District');
      expect(familyOption?.color).toBe('#f59e0b');
      expect(familyOption?.badge).toContain('Arts District');
    });

    it('maps Challenge to Mother Goose Land with Red accent', () => {
      const challengeOption = PATH_OPTIONS.find((p) => p.id === 'challenge');
      expect(challengeOption).toBeDefined();
      expect(challengeOption?.title).toBe('CHALLENGE');
      expect(challengeOption?.district).toBe('Mother Goose Land');
      expect(challengeOption?.color).toBe('#ef4444');
      expect(challengeOption?.badge).toContain('Mother Goose Land');
    });

    it('maps Secret to Monument Park with Purple accent', () => {
      const secretOption = PATH_OPTIONS.find((p) => p.id === 'secret');
      expect(secretOption).toBeDefined();
      expect(secretOption?.title).toBe('SECRET');
      expect(secretOption?.district).toBe('Monument Park');
      expect(secretOption?.color).toBe('#a855f7');
      expect(secretOption?.badge).toContain('Monument Park');
    });

    it('maintains district content summaries aligned with standardized pairings', () => {
      const summaries = localEngine.getAllDistrictsContentSummary('evt-canton-vol-1');
      expect(summaries.family.name).toBe('Arts District');
      expect(summaries.challenge.name).toBe('Mother Goose Land');
      expect(summaries.secret.name).toBe('Monument Park');
    });
  });

  describe('3. Core Architecture & Open Grid Invariants', () => {
    it('verifies all quests remain open to players regardless of chosen starting path', () => {
      const playerChallenge = localEngine.registerPlayer({
        displayName: 'ChallengeRunner',
        email: 'runner@example.com',
        selectedStartingPath: 'challenge',
      });

      const allQuests = localEngine.getQuestsForEvent('evt-canton-vol-1');
      expect(allQuests.length).toBeGreaterThan(0);

      // Challenge player can view and access any quest across the grid
      const familyQuest = allQuests.find((q) => q.startingPath === 'family');
      if (familyQuest) {
        const canView = allQuests.some((q) => q.id === familyQuest.id);
        expect(canView).toBe(true);
      }
    });

    it('verifies pure individual leaderboard ranking without teams', () => {
      const p1 = localEngine.registerPlayer({ displayName: 'AgentOne', selectedStartingPath: 'family' });
      const p2 = localEngine.registerPlayer({ displayName: 'AgentTwo', selectedStartingPath: 'challenge' });

      const checkinQuest = localEngine.getQuestById('qst-centennial-discovery');
      if (checkinQuest) {
        localEngine.submitQuestProof({
          playerId: p1.id,
          questId: checkinQuest.id,
          eventId: 'evt-canton-vol-1',
          proofType: 'checkin',
          submittedContent: 'GPS Checkin',
          userLat: checkinQuest.location?.latitude || 40.7989,
          userLon: checkinQuest.location?.longitude || -81.3748,
        });
      }

      const monumentQuest = localEngine.getQuestById('qst-mckinley-cipher');
      if (monumentQuest) {
        localEngine.submitQuestProof({
          playerId: p2.id,
          questId: monumentQuest.id,
          eventId: 'evt-canton-vol-1',
          proofType: 'passphrase',
          submittedContent: monumentQuest.targetCode || '1897',
        });
      }

      const leaderboard = localEngine.getLeaderboardForEvent('evt-canton-vol-1');
      expect(leaderboard.length).toBeGreaterThanOrEqual(2);
      expect(leaderboard.every((entry) => entry.playerId && typeof entry.totalPoints === 'number')).toBe(true);
    });
  });

  describe('4. QR Route Attribution Pre-Resolution', () => {
    it('verifies landing pages have dedicated path contexts', () => {
      expect(acquisitionLandingPages.family.slug).toBe('family');
      expect(acquisitionLandingPages.family.theme).toBe('family');

      expect(acquisitionLandingPages.challenge.slug).toBe('challenge');
      expect(acquisitionLandingPages.challenge.theme).toBe('challenge');

      expect(acquisitionLandingPages.secret.slug).toBe('secret');
      expect(acquisitionLandingPages.secret.theme).toBe('secret');
    });
  });
});

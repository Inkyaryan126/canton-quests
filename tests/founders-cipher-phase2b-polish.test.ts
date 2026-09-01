import { describe, expect, it } from 'vitest';
import { SEED_QUESTS } from '../lib/seed-data';
import { getPublicQuestView, submitQuestProof, setCurrentPlayer } from '../lib/game-engine';

describe("Founder's Cipher Phase 2B: Launch Polish & Field-Dependent Content", () => {
  const canonicalSlugs = [
    'bell-cipher',
    'canton-sign-capture',
    'draft-lineup',
    'kraken-wall',
    'palace-stars',
    '9th-street-opening',
    'challenge-open-ground',
    'challenge-the-tower',
    'goose-land-cipher',
    'willie-the-whale',
    'mckinley-monument-year',
    'eternal-flame',
    'golden-mark-cipher',
    'spring-water-shelter',
  ];

  const canonicalQuests = SEED_QUESTS.filter((q) => canonicalSlugs.includes(q.slug));

  it('verifies all 14 canonical quests are present in seed data', () => {
    expect(canonicalQuests).toHaveLength(14);
  });

  it('no canonical quest contains developer placeholder wording "Puzzle pending"', () => {
    for (const q of canonicalQuests) {
      const combined = `${q.title} ${q.description} ${q.instructions} ${q.proofRequirement || ''}`;
      expect(combined.toLowerCase()).not.toContain('puzzle pending');
    }
  });

  it('no canonical quest contains developer placeholder wording "no answer is configured"', () => {
    for (const q of canonicalQuests) {
      const combined = `${q.title} ${q.description} ${q.instructions} ${q.proofRequirement || ''}`;
      expect(combined.toLowerCase()).not.toContain('no answer is configured');
    }
  });

  it('The Tower does NOT expose the year 1957 in player-facing copy', () => {
    const tower = canonicalQuests.find((q) => q.slug === 'challenge-the-tower')!;
    expect(tower).toBeDefined();
    const publicView = getPublicQuestView(tower);
    const text = `${publicView.title} ${publicView.description} ${publicView.instructions} ${publicView.proofRequirement || ''}`;
    expect(text).not.toContain('1957');
    expect(publicView.instructions).toContain('Search the structure and the history around it');
  });

  it('The Golden Mark does NOT expose the year 1805 in player-facing copy', () => {
    const goldenMark = canonicalQuests.find((q) => q.slug === 'golden-mark-cipher')!;
    expect(goldenMark).toBeDefined();
    const publicView = getPublicQuestView(goldenMark);
    const text = `${publicView.title} ${publicView.description} ${publicView.instructions} ${publicView.proofRequirement || ''}`;
    expect(text).not.toContain('1805');
    expect(publicView.instructions).toContain('Gold catches the eye, but the date is the real mark');
  });

  it('Spring Water Shelter has clean instructions without "Puzzle pending" or developer text', () => {
    const spring = canonicalQuests.find((q) => q.slug === 'spring-water-shelter')!;
    expect(spring).toBeDefined();
    const publicView = getPublicQuestView(spring);
    const text = `${publicView.title} ${publicView.description} ${publicView.instructions} ${publicView.proofRequirement || ''}`;
    expect(text.toLowerCase()).not.toContain('puzzle pending');
    expect(text.toLowerCase()).not.toContain('no answer is configured');
    expect(publicView.instructions).toContain('Find the historic stone shelter');
  });

  it('preserves quest existence, fragment rewards, and Founder Lock reward wiring', () => {
    const tower = canonicalQuests.find((q) => q.slug === 'challenge-the-tower')!;
    expect(tower.rewardConfig?.threeLocksFragment?.lock).toBe('code');

    const goldenMark = canonicalQuests.find((q) => q.slug === 'golden-mark-cipher')!;
    expect(goldenMark.rewardConfig?.threeLocksFragment?.lock).toBe('mark');

    const spring = canonicalQuests.find((q) => q.slug === 'spring-water-shelter')!;
    expect(spring.rewardConfig?.cipherFragmentKeys).toEqual(['secret-silent-court']);
  });

  it('verifies photo submissions start as pending and do not prematurely grant rewards', () => {
    const player = setCurrentPlayer(`test_poller_${Date.now()}`, '📸');
    const photoQuest = canonicalQuests.find((q) => q.verificationType === 'photo')!;
    expect(photoQuest).toBeDefined();

    const result = submitQuestProof({
      playerId: player.id,
      questId: photoQuest.id,
      eventId: photoQuest.eventId,
      proofType: 'photo',
      proofUrl: 'https://example.com/test-photo.jpg',
    });

    expect(result.success).toBe(true);
    expect(result.submission.status).toBe('pending');
    expect(result.awardedPoints).toBe(0);
    expect(result.drawingEntriesAwarded).toBe(0);
    expect(result.isQuestFullyCompleted).toBe(false);
  });
});

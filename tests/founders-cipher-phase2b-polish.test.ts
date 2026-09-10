import { describe, expect, it } from 'vitest';
import { SEED_QUESTS } from '../lib/seed-data';
import { authorizeQuestEvidenceUpload, getPublicQuestView, submitQuestProof, setCurrentPlayer } from '../lib/game-engine';

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

  it('The Tower does NOT expose the year 1954 in player-facing copy', () => {
    const tower = canonicalQuests.find((q) => q.slug === 'challenge-the-tower')!;
    expect(tower).toBeDefined();
    const publicView = getPublicQuestView(tower);
    const text = `${publicView.title} ${publicView.description} ${publicView.instructions} ${publicView.proofRequirement || ''}`;
    expect(text).not.toContain('1954');
    expect(publicView.instructions).toContain('Find The Tower at Mother Goose Land');
  });

  it('The Golden Mark does NOT expose the year 1805 in player-facing copy', () => {
    const goldenMark = canonicalQuests.find((q) => q.slug === 'golden-mark-cipher')!;
    expect(goldenMark).toBeDefined();
    const publicView = getPublicQuestView(goldenMark);
    const text = `${publicView.title} ${publicView.description} ${publicView.instructions} ${publicView.proofRequirement || ''}`;
    expect(text).not.toContain('1805');
    expect(publicView.instructions).toContain('Find the Golden Mark landmark on Canton Road');
  });

  it('Spring Water Shelter has clean instructions without "Puzzle pending" or developer text, and does not spell out its own answer', () => {
    const spring = canonicalQuests.find((q) => q.slug === 'spring-water-shelter')!;
    expect(spring).toBeDefined();
    const publicView = getPublicQuestView(spring);
    const text = `${publicView.title} ${publicView.description} ${publicView.instructions} ${publicView.proofRequirement || ''}`;
    expect(text.toLowerCase()).not.toContain('puzzle pending');
    expect(text.toLowerCase()).not.toContain('no answer is configured');
    expect(publicView.instructions).toContain('Find the Spring Water Shelter at Fort Hill Park');
  });

  it('preserves quest existence, fragment rewards, and Founder Lock reward wiring', () => {
    const tower = canonicalQuests.find((q) => q.slug === 'challenge-the-tower')!;
    expect(tower.rewardConfig?.threeLocksFragment?.lock).toBe('code');

    const goldenMark = canonicalQuests.find((q) => q.slug === 'golden-mark-cipher')!;
    expect(goldenMark.rewardConfig?.threeLocksFragment?.lock).toBe('mark');

    const spring = canonicalQuests.find((q) => q.slug === 'spring-water-shelter')!;
    expect(spring.rewardConfig?.cipherFragmentKeys).toEqual(['secret-silent-court']);
  });

  it('verifies photo submissions complete immediately and are locked as evidence, not queued for review (Master Launch Pivot)', () => {
    const player = setCurrentPlayer(`test_poller_${Date.now()}`, '📸');
    const photoQuest = canonicalQuests.find((q) => q.verificationType === 'photo')!;
    expect(photoQuest).toBeDefined();

    const { path: evidencePath } = authorizeQuestEvidenceUpload({ eventId: photoQuest.eventId, playerId: player.id, questId: photoQuest.id });
    const result = submitQuestProof({
      playerId: player.id,
      questId: photoQuest.id,
      eventId: photoQuest.eventId,
      proofType: 'photo',
      proofUrl: evidencePath,
    });

    expect(result.success).toBe(true);
    expect(result.submission.status).toBe('verified');
    expect(result.submission.auditStatus).toBe('not_needed');
    expect(result.awardedPoints).toBeGreaterThan(0);
    expect(result.drawingEntriesAwarded).toBeGreaterThan(0);
    expect(result.isQuestFullyCompleted).toBe(true);
  });
});

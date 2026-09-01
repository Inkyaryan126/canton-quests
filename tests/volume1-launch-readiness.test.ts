import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { getPublicQuestView, setCurrentPlayer, submitQuestProof } from '../lib/game-engine';
import { SEED_EVENT, SEED_QUESTS } from '../lib/seed-data';
import { ProofVerificationType } from '../lib/types';

const repoFile = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

describe('Volume 1 launch readiness seed data', () => {
  it('contains a real Volume 1 Canton event with a balanced launch quest set', () => {
    expect(SEED_EVENT.title).toBe("Canton Quests: Volume 1 - The Founder's Cipher");
    expect(SEED_EVENT.startTime).toBe('2026-09-11T18:00:00Z');
    expect(SEED_QUESTS.length).toBeGreaterThanOrEqual(14);

    const categories = new Set(SEED_QUESTS.map((quest) => quest.category));
    expect(Array.from(categories)).toEqual(
      expect.arrayContaining([
        'exploration',
        'puzzle',
        'observation',
        'creative',
        'business_partner',
        'photo_video',
        'flash',
        'secret',
        'finale',
      ])
    );

    const proofTypes = new Set(SEED_QUESTS.map((quest) => quest.verificationType));
    expect(Array.from(proofTypes)).toEqual(expect.arrayContaining(['checkin', 'qr', 'passphrase', 'photo', 'video', 'multi_step']));
    expect(SEED_QUESTS.some((quest) => quest.prerequisiteQuestId)).toBe(true);
    expect(SEED_QUESTS.some((quest) => (quest.category === 'secret' || quest.isSecret) && quest.difficulty === 'epic')).toBe(true);
  });

  it('keeps public quest serialization free of hidden verification and GM data', () => {
    const publicViews = SEED_QUESTS.map(getPublicQuestView);
    const serialized = JSON.stringify(publicViews);

    expect(serialized).not.toContain('targetCode');
    expect(serialized).not.toContain('gmNotes');
    expect(serialized).not.toContain('CYPHER-77');
    expect(serialized).not.toContain('CQ-AURA-FOUNDER');
    expect(serialized).not.toContain('CQ-FINAL-KEY');
    expect(serialized).not.toContain('FOUNDER-KEYSTONE');
    expect(serialized).not.toContain('MURAL-THREAD');
    expect(serialized).not.toContain('BRASS-DOOR');
  });

  it('rejects direct proof submission to locked prerequisite-chain quests', () => {
    const player = setCurrentPlayer('Volume1_Prereq_Guard', '🔒');
    const lockedQuest = SEED_QUESTS.find((item) => item.id === 'qst-watchers-silent-court');
    expect(lockedQuest?.prerequisiteQuestId).toBe('qst-watchers-first');

    const result = submitQuestProof({
      playerId: player.id,
      questId: lockedQuest!.id,
      eventId: SEED_EVENT.id,
      proofType: 'photo',
      submittedContent: 'https://example.com/test.jpg',
    });

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/prerequisite is locked/i);
    expect(result.awardedPoints).toBe(0);
    expect(result.drawingEntriesAwarded).toBe(0);
  });

  it('configures Frankenstein grave quest with explicit respectful safety and human verification boundaries', () => {
    const quest = SEED_QUESTS.find((item) => item.id === 'qst-frankenstein-west-lawn');
    expect(quest).toBeDefined();
    expect(quest?.title).toBe("Frankenstein's Quiet Signal");
    expect(quest?.verificationType).toBe('photo');
    expect(quest?.xpReward).toBeGreaterThan(0);
    expect(quest?.drawingEntryReward).toBeGreaterThan(0);
    expect(quest?.safetyNotes).toMatch(/Daylight only/i);
    expect(quest?.safetyNotes).toMatch(/No touching, climbing/i);
    expect(quest?.safetyNotes).toMatch(/nighttime access/i);
    expect(quest?.location?.openingHours).toMatch(/Posted visitor hours/i);
    expect(quest?.location?.openingHours).not.toMatch(/Human verification required/i);
    expect(quest?.gmNotes).toMatch(/surname spelling/i);
  });

  it('configures the higher-difficulty secret chain as ordered public steps without public answers', () => {
    const quest = SEED_QUESTS.find((item) => item.id === 'qst-secret-cipher-77');
    expect(quest?.verificationType).toBe('multi_step');
    expect(quest?.steps).toHaveLength(3);
    expect(quest?.steps?.map((step) => step.stepOrder)).toEqual([1, 2, 3]);

    const publicView = getPublicQuestView(quest!);
    expect(publicView.steps).toHaveLength(3);
    expect(JSON.stringify(publicView.steps)).not.toContain('targetCode');
  });

  it('has valid rewards and enough player-facing clarity for every launch quest', () => {
    for (const quest of SEED_QUESTS) {
      expect(quest.eventId).toBe(SEED_EVENT.id);
      expect(quest.title.trim().length).toBeGreaterThan(6);
      expect(quest.description.trim().length).toBeGreaterThan(24);
      expect(quest.instructions.trim().length).toBeGreaterThan(24);
      expect(quest.proofRequirement.trim().length).toBeGreaterThan(12);
      expect(quest.pointValue).toBeGreaterThan(0);
      expect(quest.xpReward ?? quest.pointValue).toBeGreaterThan(0);
      expect(quest.drawingEntryReward ?? 1).toBeGreaterThan(0);
      expect(quest.safetyNotes || quest.location?.accessNotes).toBeTruthy();
    }
  });

  it('quest detail page renders submission controls for all configured verification types', () => {
    const detailPage = repoFile('app/events/[slug]/quests/[questId]/page.tsx');
    const configuredTypes = new Set<ProofVerificationType>(SEED_QUESTS.map((quest) => quest.verificationType));

    for (const proofType of configuredTypes) {
      expect(detailPage).toContain(`quest.verificationType === '${proofType}'`);
    }
    expect(detailPage).toContain('Open Map Directions');
  });

  // Rewritten alongside the Fair QR Hunt build (see
  // supabase/migrations/20260826140000_fair_qr_hunt_core_and_bonus_quests.sql):
  // the QR gateway now resolves a scan purely by its server-side
  // target_code (GET /api/qr/claim's getQuestByTargetCodeDB), across any
  // event including Volume 1's existing QR quests, rather than client-side
  // guessing against a fetched quest list. It also gates on the canonical
  // auth session (unlike the prior localStorage-only player) and still
  // opportunistically forwards GPS for the small set of quests that
  // require it (Quest.requireQrAndLocation, e.g. hof-trail-emblem).
  it('QR gateway resolves scans server-side by target_code, gates on canonical auth, and still forwards GPS for location-required QR quests', () => {
    const qrPage = repoFile('app/qr/[code]/page.tsx');
    const claimRoute = repoFile('app/api/qr/claim/route.ts');

    expect(claimRoute).toContain('getQuestByTargetCodeDB');
    expect(claimRoute).toContain('resolveAuthenticatedPlayer');
    expect(claimRoute).toContain('userAccuracyMeters');
    expect(qrPage).toContain('/api/auth/me');
    expect(qrPage).toContain('navigator.geolocation');
  });
});

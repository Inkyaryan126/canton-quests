import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createEventWizard,
  createQuest,
  getLocalCipherFragmentGrants,
  getOrCreateEventParticipation,
  isLocalCipherDistrictTokenUnlocked,
  resetGameEngineStore,
  reviewSubmission,
  submitQuestProof,
} from '../lib/game-engine';
import { SEED_EVENT } from '../lib/seed-data';
import { Quest } from '../lib/types';

const EVENT_ID = SEED_EVENT.id;

let counter = 0;
function makeQuest(overrides: Partial<Quest> = {}): Quest {
  counter += 1;
  return createQuest({
    eventId: EVENT_ID,
    title: `Cipher District Fixture ${counter}`,
    slug: `cipher-district-fixture-${counter}`,
    description: 'Cipher district fixture.',
    instructions: 'Enter the fixture answer.',
    pointValue: 25,
    difficulty: 'easy',
    category: 'puzzle',
    verificationType: 'passphrase',
    targetCode: 'ANSWER',
    proofRequirement: 'Enter the fixture answer.',
    isFlash: false,
    status: 'active',
    sortOrder: 1000 + counter,
    startingPath: 'family',
    ...overrides,
  });
}

function submit(playerId: string, quest: Quest, answer = 'ANSWER') {
  return submitQuestProof({
    playerId,
    questId: quest.id,
    eventId: quest.eventId,
    proofType: quest.verificationType === 'photo' ? 'photo' : 'passphrase',
    submittedContent: quest.verificationType === 'photo' ? 'https://example.com/proof.jpg' : answer,
    proofUrl: quest.verificationType === 'photo' ? 'https://example.com/proof.jpg' : undefined,
  });
}

describe("Founder's Cipher district fragment system", () => {
  beforeEach(() => {
    resetGameEngineStore();
    counter = 0;
  });

  it('grants a configured fragment idempotently and blocks duplicate submissions from duplicating it', () => {
    const playerId = 'plr-cipher-idempotent';
    const quest = makeQuest({ rewardConfig: { cipherFragmentKeys: ['arts-founder-signal'] } });

    const first = submit(playerId, quest);
    const duplicate = submit(playerId, quest);

    expect(first.success).toBe(true);
    expect(first.cipherFragmentsAwarded).toEqual(['arts-founder-signal']);
    expect(duplicate.success).toBe(false);
    expect(getLocalCipherFragmentGrants(playerId, EVENT_ID).filter((grant) => grant.fragmentKey === 'arts-founder-signal')).toHaveLength(1);
  });

  it('scopes identical fragment keys by event', () => {
    const playerId = 'plr-cipher-event-scope';
    const otherEvent = createEventWizard({
      cityId: SEED_EVENT.cityId,
      title: 'Other Cipher Event',
      slug: `other-cipher-event-${Date.now()}`,
      description: 'Other event.',
      status: 'active',
      currentPhase: 'day_1',
      isPaused: false,
    });
    const mainQuest = makeQuest({ rewardConfig: { cipherFragmentKeys: ['arts-founder-signal'] } });
    const otherQuest = makeQuest({
      eventId: otherEvent.id,
      rewardConfig: { cipherFragmentKeys: ['arts-founder-signal'] },
    });

    submit(playerId, mainQuest);
    submit(playerId, otherQuest);

    expect(getLocalCipherFragmentGrants(playerId, EVENT_ID)).toHaveLength(1);
    expect(getLocalCipherFragmentGrants(playerId, otherEvent.id)).toHaveLength(1);
  });

  it('unlocks a district token when all required district fragments are collected', () => {
    const playerId = 'plr-cipher-arts-complete';
    const quests = [
      makeQuest({ rewardConfig: { cipherFragmentKeys: ['arts-founder-signal'] } }),
      makeQuest({ rewardConfig: { cipherFragmentKeys: ['arts-painted-witness'] } }),
      makeQuest({ rewardConfig: { cipherFragmentKeys: ['arts-palace-lantern'] } }),
    ];

    submit(playerId, quests[0]);
    expect(isLocalCipherDistrictTokenUnlocked(playerId, EVENT_ID, 'arts')).toBe(false);
    submit(playerId, quests[1]);
    expect(isLocalCipherDistrictTokenUnlocked(playerId, EVENT_ID, 'arts')).toBe(false);
    const final = submit(playerId, quests[2]);

    expect(final.cipherDistrictsUnlocked).toContain('arts');
    expect(isLocalCipherDistrictTokenUnlocked(playerId, EVENT_ID, 'arts')).toBe(true);
  });

  it('lets players start in any district without cross-district fragments', () => {
    const playerId = 'plr-cipher-any-start';
    getOrCreateEventParticipation(EVENT_ID, playerId, 'secret');
    const challengeQuest = makeQuest({
      startingPath: 'challenge',
      rewardConfig: { cipherFragmentKeys: ['challenge-brass-key'] },
    });

    const result = submit(playerId, challengeQuest);

    expect(result.success).toBe(true);
    expect(result.cipherFragmentsAwarded).toEqual(['challenge-brass-key']);
    expect(getLocalCipherFragmentGrants(playerId, EVENT_ID).map((grant) => grant.districtKey)).toEqual(['challenge']);
  });

  it('supports completing district fragments in different orders', () => {
    const playerId = 'plr-cipher-order-free';
    const secret = makeQuest({ startingPath: 'secret', rewardConfig: { cipherFragmentKeys: ['secret-stone-stair'] } });
    const arts = makeQuest({ startingPath: 'family', rewardConfig: { cipherFragmentKeys: ['arts-founder-signal'] } });
    const challenge = makeQuest({ startingPath: 'challenge', rewardConfig: { cipherFragmentKeys: ['challenge-brass-key'] } });

    submit(playerId, secret);
    submit(playerId, arts);
    submit(playerId, challenge);

    expect(getLocalCipherFragmentGrants(playerId, EVENT_ID).map((grant) => grant.fragmentKey)).toEqual([
      'secret-stone-stair',
      'arts-founder-signal',
      'challenge-brass-key',
    ]);
  });

  it('does not grant fragments for invalid answers', () => {
    const playerId = 'plr-cipher-invalid';
    const quest = makeQuest({ rewardConfig: { cipherFragmentKeys: ['arts-founder-signal'] } });

    const result = submit(playerId, quest, 'WRONG');

    expect(result.success).toBe(false);
    expect(result.cipherFragmentsAwarded).toBeUndefined();
    expect(getLocalCipherFragmentGrants(playerId, EVENT_ID)).toHaveLength(0);
  });

  it('waits for Game Master approval before granting photo-proof fragments', () => {
    const playerId = 'plr-cipher-photo';
    const quest = makeQuest({
      verificationType: 'photo',
      targetCode: undefined,
      rewardConfig: { cipherFragmentKeys: ['arts-painted-witness'] },
    });

    const pending = submit(playerId, quest);
    expect(pending.success).toBe(true);
    expect(pending.submission.status).toBe('pending');
    expect(getLocalCipherFragmentGrants(playerId, EVENT_ID)).toHaveLength(0);

    reviewSubmission(pending.submission.id, 'verified');
    expect(getLocalCipherFragmentGrants(playerId, EVENT_ID).map((grant) => grant.fragmentKey)).toEqual(['arts-painted-witness']);
  });

  it('keeps unauthorized fragment access out of the public event API projection', () => {
    const routeSource = fs.readFileSync(
      path.join(process.cwd(), 'app/api/game/events/[slug]/route.ts'),
      'utf8'
    );

    expect(routeSource).toContain('resolveAuthenticatedPlayer(request)');
    expect(routeSource).toContain('authenticatedPlayer?.id === playerId');
    expect(routeSource).toContain('cipherProgress');
  });

  it('defines private event-scoped cipher tables with own-player RLS and unique grants', () => {
    const migration = fs.readFileSync(
      path.join(process.cwd(), 'supabase/migrations/20260828120000_founders_cipher_district_fragments.sql'),
      'utf8'
    );

    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.cipher_fragments');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.player_cipher_fragments');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.player_district_cipher_progress');
    expect(migration).toContain('UNIQUE(event_id, player_id, fragment_id)');
    expect(migration).toContain('UNIQUE(event_id, player_id, district_key)');
    expect(migration).toContain('ALTER TABLE public.player_cipher_fragments ENABLE ROW LEVEL SECURITY');
    expect(migration).toContain('p.user_id = (SELECT auth.uid())');
    expect(migration).toContain("'arts'");
    expect(migration).toContain("'challenge'");
    expect(migration).toContain("'secret'");
  });
});

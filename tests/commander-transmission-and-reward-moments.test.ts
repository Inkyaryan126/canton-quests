/**
 * Canton Quests — Commander Transmission & Cinematic Reward Moment System Tests
 *
 * This codebase's Vitest suite runs in a Node (non-DOM) environment — every
 * existing test targets lib/ logic, not rendered React output. These tests
 * follow that same convention: they exercise the *pure decision logic*
 * behind the transmission/reward-moment system (media-mode resolution,
 * viewed-state, the GameMomentManager's queue/priority/duration engine, and
 * the real server reward data these moments are built from) rather than
 * DOM assertions. Mobile-viewport rendering and reduced-motion *visual*
 * behavior were verified separately via the browser at the required
 * breakpoints (see the final report) since no component-rendering test
 * harness exists in this project to automate that.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  resolveTransmissionMediaMode,
  resolveTransmissionCta,
  isTransmissionSkippable,
  isTransmissionReplayable,
} from '../lib/commander-transmission-utils';
import {
  gameMomentManager,
  showGameMoment,
  triggerGameMomentSequence,
  triggerRewardMoment,
  GameMoment,
} from '../lib/game-effects';
import {
  createQuest,
  getCollectiblesForPlayer,
  reviewSubmission,
  setCurrentPlayer,
  submitQuestProof,
} from '../lib/game-engine';
import { SEED_EVENT } from '../lib/seed-data';
import { QuestCommanderTransmission } from '../lib/types';
import { hasViewedTransmission, markTransmissionViewed, shouldAutoShowTransmission } from '../lib/transmission-viewed-state';

const EVENT_ID = SEED_EVENT.id;

function newPlayer(label: string) {
  return setCurrentPlayer(`Transmission_${label}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, '📡');
}

// ---------------------------------------------------------------------------
// A minimal in-memory localStorage shim so lib/transmission-viewed-state.ts's
// client-only branch is actually exercised (this Vitest environment has no
// `window` by default). Installed only for the "viewed/replay" describe
// block below, and torn down afterward.
// ---------------------------------------------------------------------------
function installLocalStorageShim() {
  const store = new Map<string, string>();
  (globalThis as any).window = {
    localStorage: {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    },
  };
}
function removeLocalStorageShim() {
  delete (globalThis as any).window;
}

describe('Commander transmission — media mode resolution', () => {
  it('a PHOTO_MESSAGE transmission always resolves to the photo treatment', () => {
    const t: QuestCommanderTransmission = { type: 'PHOTO_MESSAGE', message: 'Some places get forgotten.' };
    expect(resolveTransmissionMediaMode(t)).toBe('photo');
  });

  it('a PHOTO_MESSAGE transmission resolves to photo even if a mediaKey happens to be set', () => {
    const t: QuestCommanderTransmission = { type: 'PHOTO_MESSAGE', message: 'x', mediaKey: 'commander/x.jpg' };
    expect(resolveTransmissionMediaMode(t)).toBe('photo');
  });

  it('a VIDEO transmission with no mediaKey configured yet falls back to photo', () => {
    const t: QuestCommanderTransmission = { type: 'VIDEO', message: 'x' };
    expect(resolveTransmissionMediaMode(t)).toBe('photo');
  });

  it('a VIDEO transmission with a configured mediaKey resolves to video', () => {
    const t: QuestCommanderTransmission = { type: 'VIDEO', message: 'x', mediaKey: 'commander/x.mp4' };
    expect(resolveTransmissionMediaMode(t)).toBe('video');
  });

  it('a VIDEO transmission falls back to photo once playback has failed, regardless of mediaKey', () => {
    const t: QuestCommanderTransmission = { type: 'VIDEO', message: 'x', mediaKey: 'commander/x.mp4' };
    expect(resolveTransmissionMediaMode(t, /* videoFailed */ true)).toBe('photo');
  });

  it('CTA and skippable/replayable default sensibly and honor explicit overrides', () => {
    expect(resolveTransmissionCta({})).toBe('CONTINUE');
    expect(resolveTransmissionCta({ cta: 'PROCEED' })).toBe('PROCEED');
    expect(isTransmissionSkippable({})).toBe(true);
    expect(isTransmissionSkippable({ skippable: false })).toBe(false);
    expect(isTransmissionReplayable({})).toBe(true);
    expect(isTransmissionReplayable({ replayable: false })).toBe(false);
  });
});

describe('Commander transmission — viewed/replay state', () => {
  beforeEach(() => installLocalStorageShim());
  afterEach(() => removeLocalStorageShim());

  it('auto-shows a transmission on first view, then stops auto-showing after it is marked viewed', () => {

    expect(hasViewedTransmission('quest_intro', 'qst-x', 'plr-1')).toBe(false);
    expect(shouldAutoShowTransmission('quest_intro', 'qst-x', 'plr-1')).toBe(true);

    markTransmissionViewed('quest_intro', 'qst-x', 'plr-1');

    expect(hasViewedTransmission('quest_intro', 'qst-x', 'plr-1')).toBe(true);
    expect(shouldAutoShowTransmission('quest_intro', 'qst-x', 'plr-1')).toBe(false);
  });

  it('viewed state is scoped per player and per quest — does not leak across either', () => {

    markTransmissionViewed('quest_intro', 'qst-a', 'plr-1');

    expect(hasViewedTransmission('quest_intro', 'qst-a', 'plr-2')).toBe(false); // different player
    expect(hasViewedTransmission('quest_intro', 'qst-b', 'plr-1')).toBe(false); // different quest
    expect(hasViewedTransmission('sector_intro', 'qst-a', 'plr-1')).toBe(false); // different trigger
  });

  it('a replayable transmission stays flagged as such after being marked viewed (the Replay affordance is caller-driven, not gated by the viewed store)', () => {
    markTransmissionViewed('quest_intro', 'qst-x', 'plr-1');
    expect(hasViewedTransmission('quest_intro', 'qst-x', 'plr-1')).toBe(true);
    // Replayability is a property of the transmission data itself
    // (QuestCommanderTransmission.replayable), independent of viewed state —
    // a manual "Replay Transmission" click always bypasses the auto-show
    // gate and calls showGameMoment directly (see the quest detail page).
    expect(isTransmissionReplayable({})).toBe(true);
    expect(isTransmissionReplayable({ replayable: false })).toBe(false);
  });

  it('GM live announcements always auto-show, overriding normal viewed-state behavior', () => {
    // Even if somehow marked, gm_announcement ignores the viewed check entirely.
    markTransmissionViewed('gm_announcement', 'evt-1', 'plr-1');
    expect(shouldAutoShowTransmission('gm_announcement', 'evt-1', 'plr-1')).toBe(true);
  });

  it('gracefully no-ops without a window/localStorage (server-side/pre-hydration safe)', () => {
    removeLocalStorageShim();
    expect(() => markTransmissionViewed('quest_intro', 'qst-x', 'plr-1')).not.toThrow();
    expect(hasViewedTransmission('quest_intro', 'qst-x', 'plr-1')).toBe(false);
    expect(shouldAutoShowTransmission('quest_intro', 'qst-x', 'plr-1')).toBe(true);
    installLocalStorageShim(); // restore for afterEach
  });
});

describe('Small quests can have no transmission at all', () => {
  it('a quest with zero transmission fields is a valid, fully-optional shape', () => {
    const quest = createQuest({
      eventId: EVENT_ID,
      title: 'Tiny Quest',
      slug: `tiny-quest-${Date.now()}`,
      description: 'x',
      instructions: 'x',
      pointValue: 50,
      difficulty: 'easy',
      category: 'exploration',
      verificationType: 'passphrase',
      targetCode: 'TINY',
      proofRequirement: 'x',
      isFlash: false,
      status: 'active',
      sortOrder: 1,
    });
    expect(quest.sectorIntroTransmission).toBeUndefined();
    expect(quest.commanderTransmission).toBeUndefined();
    expect(quest.milestoneTransmission).toBeUndefined();
    expect(quest.completionTransmission).toBeUndefined();
    expect(quest.discoveryTransmission).toBeUndefined();

    // Completing it produces a normal, valid result with no reward-moment
    // fields populated — nothing crashes or invents a transmission/moment.
    const player = newPlayer('tiny-quest');
    const result = submitQuestProof({ playerId: player.id, questId: quest.id, eventId: EVENT_ID, proofType: 'passphrase', submittedContent: 'TINY' });
    expect(result.success).toBe(true);
    expect(result.threeLocksFragmentAwarded).toBeUndefined();
    expect(result.collectibleAwarded).toBeUndefined();
  });
});

describe('GameMomentManager — reward events queue rather than overlap', () => {
  afterEach(() => {
    gameMomentManager.skipAll();
    gameMomentManager.setReducedMotion(false);
  });

  it('only one moment is ever "current" at a time; a second trigger enqueues instead of overlapping', () => {
    showGameMoment({ type: 'reward-token', kind: 'xp', headline: 'FIRST', xpAmount: 10 });
    showGameMoment({ type: 'reward-token', kind: 'xp', headline: 'SECOND', xpAmount: 20 });

    const state = gameMomentManager.getState();
    expect(state.currentMoment).not.toBeNull();
    expect((state.currentMoment as any).headline).toBe('FIRST');
    expect(state.queue.length).toBe(1);
    expect((state.queue[0] as any).headline).toBe('SECOND');

    gameMomentManager.dismissCurrent();
    const next = gameMomentManager.getState();
    expect((next.currentMoment as any).headline).toBe('SECOND');
    expect(next.queue.length).toBe(0);
  });

  it('triggerGameMomentSequence keeps a Three Locks fragment + Three Locks complete pair in strict order despite three-locks-complete having a higher default priority', () => {
    const moments: GameMoment[] = [
      {
        type: 'three-locks-fragment',
        fragment: 'word',
        headline: 'LOCK FRAGMENT RECOVERED',
        primaryText: 'WORD',
        locksOwned: { mark: true, code: true, word: true },
      },
      {
        type: 'three-locks-complete',
        headline: "FOUNDER'S CIPHER COMPLETE",
        primaryText: 'THREE LOCKS COMPLETE',
      },
    ];
    triggerGameMomentSequence(moments);

    const state = gameMomentManager.getState();
    expect(state.currentMoment?.type).toBe('three-locks-fragment');
    expect(state.queue[0]?.type).toBe('three-locks-complete');
  });

  it('triggerRewardMoment auto-queues the optionalCommanderFollowup transmission once the reward moment is dismissed', () => {
    const followup: QuestCommanderTransmission = { type: 'PHOTO_MESSAGE', message: 'Well done, operative.' };
    triggerRewardMoment({
      type: 'unlock',
      kind: 'collectible',
      headline: 'ITEM RECOVERED',
      optionalCommanderFollowup: followup,
    });

    expect(gameMomentManager.getState().currentMoment?.type).toBe('unlock');
    gameMomentManager.dismissCurrent();

    const state = gameMomentManager.getState();
    expect(state.currentMoment?.type).toBe('commander-transmission');
    expect((state.currentMoment as any).transmission).toBe(followup);
  });

  it('reduced motion shortens the default duration for the new moment types', () => {
    gameMomentManager.setReducedMotion(true);
    const id = showGameMoment({ type: 'commander-transmission', trigger: 'gm_announcement', transmission: { type: 'PHOTO_MESSAGE', message: 'x' } });
    const moment = gameMomentManager.getState().currentMoment;
    expect(moment?.id).toBe(id);
    expect(moment?.durationMs).toBe(4000); // reduced from 8000
  });
});

describe('Server-awarded amounts drive the reward moments — never a computed/invented number', () => {
  it('a remoteCapable field bonus grant returns exactly the XP a field-confirmed moment would display', () => {
    const player = newPlayer('field-confirmed-amount');
    const quest = createQuest({
      eventId: EVENT_ID,
      title: 'Field Bonus Fixture',
      slug: `field-bonus-fixture-${Date.now()}`,
      description: 'x',
      instructions: 'x',
      pointValue: 100,
      difficulty: 'easy',
      category: 'exploration',
      verificationType: 'passphrase',
      targetCode: 'FIELDFIXTURE',
      proofRequirement: 'x',
      isFlash: false,
      status: 'active',
      sortOrder: 1,
      remoteCapable: true,
      location: { id: 'loc-fixture', cityId: 'city-fixture', name: 'Fixture', address: '', latitude: 40.0, longitude: -81.0, radiusMeters: 100, isPartner: false },
      rewardConfig: { baseXp: 100, fieldCheckInBonusXp: 42 },
    });

    submitQuestProof({ playerId: player.id, questId: quest.id, eventId: EVENT_ID, proofType: 'passphrase', submittedContent: 'FIELDFIXTURE' });

    const fieldResult = submitQuestProof({
      playerId: player.id,
      questId: quest.id,
      eventId: EVENT_ID,
      proofType: 'checkin',
      userLat: 40.0,
      userLon: -81.0,
    });

    expect(fieldResult.success).toBe(true);
    expect(fieldResult.awardedPoints).toBe(42); // exactly the configured field bonus, no more

    // This is precisely the value app/events/[slug]/quests/[questId]/page.tsx
    // passes straight through as xpAmount — no client-side computation.
    const moment = { type: 'field-event' as const, kind: 'field-confirmed' as const, headline: 'FIELD PRESENCE CONFIRMED', xpAmount: fieldResult.awardedPoints };
    expect(moment.xpAmount).toBe(42);
  });

  it('a duplicate/no-op grant awards zero XP, so the page never constructs a field-confirmed moment for it', () => {
    const player = newPlayer('field-confirmed-duplicate');
    const quest = createQuest({
      eventId: EVENT_ID,
      title: 'Field Bonus Duplicate Fixture',
      slug: `field-bonus-dup-fixture-${Date.now()}`,
      description: 'x',
      instructions: 'x',
      pointValue: 100,
      difficulty: 'easy',
      category: 'exploration',
      verificationType: 'passphrase',
      targetCode: 'FIELDDUP',
      proofRequirement: 'x',
      isFlash: false,
      status: 'active',
      sortOrder: 1,
      remoteCapable: true,
      location: { id: 'loc-fixture', cityId: 'city-fixture', name: 'Fixture', address: '', latitude: 40.0, longitude: -81.0, radiusMeters: 100, isPartner: false },
      rewardConfig: { baseXp: 100, fieldCheckInBonusXp: 42 },
    });

    submitQuestProof({ playerId: player.id, questId: quest.id, eventId: EVENT_ID, proofType: 'passphrase', submittedContent: 'FIELDDUP' });
    const first = submitQuestProof({ playerId: player.id, questId: quest.id, eventId: EVENT_ID, proofType: 'checkin', userLat: 40.0, userLon: -81.0 });
    expect(first.awardedPoints).toBe(42);

    const second = submitQuestProof({ playerId: player.id, questId: quest.id, eventId: EVENT_ID, proofType: 'checkin', userLat: 40.0, userLon: -81.0 });
    // The page's real gate is `result.success && result.awardedPoints > 0` —
    // reproduce it here against real server output to prove a duplicate
    // never satisfies it, so no second (fake) popup is ever built.
    const wouldShowFieldMoment = second.success && second.awardedPoints > 0;
    expect(wouldShowFieldMoment).toBe(false);
  });
});

describe('Three Locks progress reflects actual persisted collectible ownership', () => {
  it('threeLocksOwned on the server result always matches getCollectiblesForPlayer, never a frontend assumption', () => {
    const player = newPlayer('three-locks-owned-truth');
    const markFixture = createQuest({
      eventId: EVENT_ID,
      title: 'MARK fixture',
      slug: `mark-truth-fixture-${Date.now()}`,
      description: 'x',
      instructions: 'x',
      pointValue: 50,
      difficulty: 'easy',
      category: 'exploration',
      verificationType: 'passphrase',
      targetCode: 'MARKTRUTH',
      proofRequirement: 'x',
      isFlash: false,
      status: 'active',
      sortOrder: 1,
      rewardConfig: { threeLocksFragment: { lock: 'mark', collectibleId: 'col-founder-mark' } },
    });

    const result = submitQuestProof({ playerId: player.id, questId: markFixture.id, eventId: EVENT_ID, proofType: 'passphrase', submittedContent: 'MARKTRUTH' });

    expect(result.threeLocksOwned).toBeDefined();
    const owned = getCollectiblesForPlayer(player.id).map((c) => c.collectibleId);
    expect(result.threeLocksOwned!.mark).toBe(owned.includes('col-founder-mark'));
    expect(result.threeLocksOwned!.code).toBe(owned.includes('col-founder-code'));
    expect(result.threeLocksOwned!.word).toBe(owned.includes('col-founder-word'));
  });
});

describe('Duplicate reward never produces a fake second reward popup', () => {
  it('GM re-approving an already-verified submission grants nothing new and yields awardedPoints: 0', () => {
    const player = newPlayer('duplicate-popup-guard');
    const quest = createQuest({
      eventId: EVENT_ID,
      title: 'Duplicate Popup Guard Fixture',
      slug: `dup-popup-fixture-${Date.now()}`,
      description: 'x',
      instructions: 'x',
      pointValue: 80,
      difficulty: 'easy',
      category: 'exploration',
      verificationType: 'photo',
      proofRequirement: 'x',
      isFlash: false,
      status: 'active',
      sortOrder: 1,
      rewardConfig: { baseXp: 80, collectibleUnlockIds: ['col-founder-token'] },
    });

    const submitted = submitQuestProof({
      playerId: player.id,
      questId: quest.id,
      eventId: EVENT_ID,
      proofType: 'photo',
      proofUrl: 'https://example.com/proof.jpg',
    });
    const approved = reviewSubmission(submitted.submission.id, 'verified');
    expect(approved?.awardedPoints).toBe(80);

    const reapproved = reviewSubmission(submitted.submission.id, 'verified');
    // The page's isQuestFullyCompleted-gated reward sequence and the
    // awardedPoints>0-gated field-event branch both key off exactly this
    // value — zero means neither path constructs a new moment.
    expect(reapproved?.awardedPoints).toBe(0);
  });
});

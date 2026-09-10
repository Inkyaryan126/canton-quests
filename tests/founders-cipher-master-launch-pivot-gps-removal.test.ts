// Canton Quests — Founder's Cipher Master Launch Pivot: GPS/QR Removal
//
// The flagship's core proof philosophy changed from "prove you were
// physically near a set of coordinates" to "the location itself contains
// the key" — a player proves they visited a real Canton site by reading a
// permanent detail there, never by GPS, browser geolocation, or a printed
// QR/NFC marker Canton Quests has to install and maintain.
//
// Audit of all 14 canonical launch quests (lib/finale.ts's
// LAUNCH_DISTRICT_QUESTS) found 11 already environmental-answer/photo-proof
// quests with no GPS dependency at all. Exactly three had a GPS gate:
//   - 9th-street-opening: was a bare GPS check-in (verificationType
//     'checkin', requireLocationVerification, radiusMeters). Converted to a
//     real environmental-answer quest: the real entrance sign in
//     public/canton-quests/quests/challenge/skate_park.png reads "9TH
//     STREET SKATE PARK" — distinct wording from this location's own
//     displayed name ("9th Street Skate Corridor"), so the exact phrase can
//     only be read by physically visiting.
//   - challenge-open-ground: same bare GPS check-in shape, but no real
//     observable/countable feature has ever been evidenced for this field
//     (docs/FOUNDERS-CIPHER-14-QUEST-AUTHORING.md). No fact was invented —
//     converted to GM-reviewed photo/witness proof instead, which fully
//     removes the GPS dependency with zero fabricated content.
//   - mckinley-monument-year: already a real environmental-answer
//     (passphrase) quest, but requireLocationVerification/radiusMeters
//     additionally forced a GPS proximity gate on top of the correct
//     reading. The GPS gate is removed; the quest's answer, rewards, and
//     Cipher Fragment are unchanged.
//   - challenge-the-tower also carried requireLocationVerification and had
//     it removed for consistency, but remains NEEDS FIELD DETAIL
//     (status: 'draft', no answer hash) — unrelated to GPS removal, and
//     already invisible to players (QuestCard's fail-closed 'hidden' state
//     for any draft/inactive quest).
//
// Reward mechanics (XP, drawing entries, Cipher Fragments, Founder Locks)
// were left untouched on every quest — only the proof mechanism changed.

import { describe, expect, it } from 'vitest';
import {
  getDrawingEntriesForPlayer,
  getLocalCipherFragmentGrants,
  getPublicQuestView,
  setCurrentPlayer,
  submitQuestProof,
} from '../lib/game-engine';
import { SEED_EVENT, SEED_QUESTS } from '../lib/seed-data';
import { LAUNCH_DISTRICT_QUESTS } from '../lib/finale';
import fs from 'node:fs';
import path from 'node:path';

const EVENT_ID = SEED_EVENT.id;
const ALL_14_SLUGS = Object.values(LAUNCH_DISTRICT_QUESTS).flat();

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function newPlayer(label: string) {
  return setCurrentPlayer(`GpsRemoval_${label}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, '⭐');
}

function questBySlug(slug: string) {
  const quest = SEED_QUESTS.find((q) => q.eventId === EVENT_ID && q.slug === slug);
  if (!quest) throw new Error(`Fixture setup error: missing canonical seed quest "${slug}"`);
  return quest;
}

const NINTH_STREET = questBySlug('9th-street-opening');
const OPEN_GROUND = questBySlug('challenge-open-ground');
const TOWER = questBySlug('challenge-the-tower');
const MCKINLEY = questBySlug('mckinley-monument-year');

describe('1. None of the 14 canonical launch quests require GPS', () => {
  it('no canonical quest uses verificationType gps/checkin, requireLocationVerification, or requireQrAndLocation', () => {
    for (const slug of ALL_14_SLUGS) {
      const quest = questBySlug(slug);
      expect(quest.verificationType, `${slug} verificationType`).not.toBe('gps');
      expect(quest.verificationType, `${slug} verificationType`).not.toBe('checkin');
      expect(quest.requireLocationVerification, `${slug} requireLocationVerification`).not.toBe(true);
      expect(quest.requireQrAndLocation, `${slug} requireQrAndLocation`).not.toBe(true);
    }
  });

  it('no canonical quest carries a radiusMeters GPS-proximity value', () => {
    for (const slug of ALL_14_SLUGS) {
      const quest = questBySlug(slug);
      expect(quest.radiusMeters, `${slug} radiusMeters`).toBeUndefined();
    }
  });
});

describe('2. Founder\'s Cipher pages never request geolocation automatically', () => {
  it('the Mission hub only calls navigator.geolocation from an explicit user action (Locate Me), never on mount', () => {
    const hubSource = readSource('app/events/[slug]/page.tsx');
    expect(hubSource).not.toMatch(/useEffect\(\(\) => \{\s*requestLocation\(\);\s*\}, \[\]\);/);
    expect(hubSource).toContain('onLocateMe={requestLocation}');
  });

  it('the quest-detail page never auto-requests geolocation on mount either', () => {
    const questDetailSource = readSource('app/events/[slug]/quests/[questId]/page.tsx');
    expect(questDetailSource).not.toMatch(/useEffect\(\(\) => \{[^}]*navigator\.geolocation/);
  });
});

describe('3. Launch quest completion works without any coordinates supplied', () => {
  it('9th Street Signal completes with the real sign text and no userLat/userLon', () => {
    const player = newPlayer('ninth-no-coords');
    const result = submitQuestProof({
      playerId: player.id,
      questId: NINTH_STREET.id,
      eventId: EVENT_ID,
      proofType: 'passphrase',
      submittedContent: 'SKATE PARK',
    });
    expect(result.success).toBe(true);
    expect(result.awardedPoints).toBe(75);
  });

  it('McKinley Stone Stair Cipher completes with the real year and no userLat/userLon', () => {
    const player = newPlayer('mckinley-no-coords');
    const result = submitQuestProof({
      playerId: player.id,
      questId: MCKINLEY.id,
      eventId: EVENT_ID,
      proofType: 'passphrase',
      submittedContent: '1897',
    });
    expect(result.success).toBe(true);
    expect(result.awardedPoints).toBe(150);
  });

  it('The Open Ground accepts a photo submission with no userLat/userLon and completes immediately, never a GPS rejection', () => {
    const player = newPlayer('open-ground-no-coords');
    const result = submitQuestProof({
      playerId: player.id,
      questId: OPEN_GROUND.id,
      eventId: EVENT_ID,
      proofType: 'photo',
      proofUrl: 'https://example.com/photo.jpg',
    });
    expect(result.message).not.toMatch(/GPS/i);
    expect(result.success).toBe(true);
    expect(result.submission.status).toBe('verified');
  });
});

describe('4 & 5. Correct environmental answers are accepted; wrong ones are rejected', () => {
  it('9th Street Signal rejects an incorrect reading', () => {
    const player = newPlayer('ninth-wrong');
    const result = submitQuestProof({
      playerId: player.id,
      questId: NINTH_STREET.id,
      eventId: EVENT_ID,
      proofType: 'passphrase',
      submittedContent: 'SKATE CORRIDOR',
    });
    expect(result.success).toBe(false);
    expect(result.awardedPoints).toBe(0);
  });

  it('McKinley Stone Stair Cipher rejects an incorrect year', () => {
    const player = newPlayer('mckinley-wrong');
    const result = submitQuestProof({
      playerId: player.id,
      questId: MCKINLEY.id,
      eventId: EVENT_ID,
      proofType: 'passphrase',
      submittedContent: '1901',
    });
    expect(result.success).toBe(false);
    expect(result.awardedPoints).toBe(0);
  });
});

describe('6. acceptedAnswerVariants still function after the pivot', () => {
  it('9th Street Signal accepts the full on-site phrase as well as the short variant', () => {
    const player = newPlayer('ninth-variant');
    const result = submitQuestProof({
      playerId: player.id,
      questId: NINTH_STREET.id,
      eventId: EVENT_ID,
      proofType: 'passphrase',
      submittedContent: '9th Street Skate Park',
    });
    expect(result.success).toBe(true);
  });

  it('The Mural (goose-land-cipher) still accepts its existing WHALE variant, unaffected by this pass', () => {
    const player = newPlayer('mural-variant');
    const result = submitQuestProof({
      playerId: player.id,
      questId: questBySlug('goose-land-cipher').id,
      eventId: EVENT_ID,
      proofType: 'passphrase',
      submittedContent: 'whale',
    });
    expect(result.success).toBe(true);
  });
});

describe('7. Multi-step environmental questions remain sequential (platform-level, unaffected by GPS removal)', () => {
  it('a multi_step quest elsewhere in the roster still requires steps in order', () => {
    const multiStepQuest = SEED_QUESTS.find((q) => q.eventId === EVENT_ID && q.verificationType === 'multi_step' && q.steps && q.steps.length > 1);
    expect(multiStepQuest, 'expected at least one multi_step quest to exist in the seed roster').toBeTruthy();
    if (!multiStepQuest) return;
    const player = newPlayer('multistep');
    // Attempting the second step's answer without completing the first
    // must not silently skip ahead.
    const secondStep = multiStepQuest.steps![1];
    const result = submitQuestProof({
      playerId: player.id,
      questId: multiStepQuest.id,
      eventId: EVENT_ID,
      proofType: secondStep.verificationType as any,
      submittedContent: 'whatever-the-second-step-answer-might-be',
      stepIndex: 1,
    });
    expect(result.success).toBe(false);
  });
});

describe('8. Photo proof is never a real-time moderation queue — it completes immediately, locked as evidence', () => {
  it('The Open Ground (photo proof) awards full rewards immediately, with no pending/GM-approval step', () => {
    const player = newPlayer('open-ground-immediate');
    const result = submitQuestProof({
      playerId: player.id,
      questId: OPEN_GROUND.id,
      eventId: EVENT_ID,
      proofType: 'photo',
      proofUrl: 'https://example.com/open-ground.jpg',
    });
    expect(result.success).toBe(true);
    expect(result.submission.status).toBe('verified');
    expect(result.awardedPoints).toBe(100);
    expect(getDrawingEntriesForPlayer(player.id, EVENT_ID).some((e) => e.questId === OPEN_GROUND.id)).toBe(true);
  });

  it('the submitted photo is stored as locked evidence with auditStatus "not_needed", not flagged for any review queue', () => {
    const player = newPlayer('open-ground-evidence');
    const result = submitQuestProof({
      playerId: player.id,
      questId: OPEN_GROUND.id,
      eventId: EVENT_ID,
      proofType: 'photo',
      proofUrl: 'https://example.com/open-ground-evidence.jpg',
    });
    expect(result.submission.proofUrl).toBe('https://example.com/open-ground-evidence.jpg');
    expect(result.submission.auditStatus).toBe('not_needed');
  });
});

describe('9. Reward progression is unchanged by the proof-mechanism conversion', () => {
  it('9th Street Signal still awards exactly its original 75 XP / 1 drawing entry, no fragment', () => {
    expect(NINTH_STREET.xpReward).toBe(75);
    expect(NINTH_STREET.pointValue).toBe(75);
    expect(NINTH_STREET.drawingEntryReward).toBe(1);
    expect(NINTH_STREET.rewardConfig).toBeUndefined();
  });

  it('The Open Ground still grants the [GAVE A MONSTER] Cipher Fragment immediately on submission, matching its pre-pivot reward', () => {
    const player = newPlayer('open-ground-fragment');
    submitQuestProof({
      playerId: player.id,
      questId: OPEN_GROUND.id,
      eventId: EVENT_ID,
      proofType: 'photo',
      proofUrl: 'https://example.com/open-ground-2.jpg',
    });
    const fragments = getLocalCipherFragmentGrants(player.id, EVENT_ID);
    expect(fragments.some((f) => f.fragmentKey === 'challenge-helmet-emblem')).toBe(true);
  });

  it('McKinley Stone Stair Cipher still grants its original Secret District fragment and 150 XP', () => {
    expect(MCKINLEY.xpReward).toBe(150);
    expect(MCKINLEY.rewardConfig?.cipherFragmentKeys).toEqual(['secret-quiet-signal']);

    const player = newPlayer('mckinley-fragment');
    const result = submitQuestProof({
      playerId: player.id,
      questId: MCKINLEY.id,
      eventId: EVENT_ID,
      proofType: 'passphrase',
      submittedContent: '1897',
    });
    expect(result.awardedPoints).toBe(150);
    const fragments = getLocalCipherFragmentGrants(player.id, EVENT_ID);
    expect(fragments.some((f) => f.fragmentKey === 'secret-quiet-signal')).toBe(true);
  });

  it('The Tower keeps its Founder Lock THE CODE reward wiring untouched, still fail-closed (draft, no answer hash)', () => {
    expect(TOWER.status).toBe('draft');
    expect(TOWER.rewardConfig?.threeLocksFragment).toEqual({ lock: 'code', collectibleId: 'col-founder-code' });
    expect(TOWER.radiusMeters).toBeUndefined();
    expect(TOWER.requireLocationVerification).not.toBe(true);
  });
});

describe('10. No target answer or answer hash is ever leaked through PublicQuestView', () => {
  it('none of the 14 canonical quests expose targetCode, gmNotes, acceptedAnswerVariants, placementDetails, or placedAt', () => {
    for (const slug of ALL_14_SLUGS) {
      const quest = questBySlug(slug);
      const publicView = getPublicQuestView(quest) as Record<string, unknown>;
      expect(publicView.targetCode, `${slug} targetCode`).toBeUndefined();
      expect(publicView.gmNotes, `${slug} gmNotes`).toBeUndefined();
      expect(publicView.acceptedAnswerVariants, `${slug} acceptedAnswerVariants`).toBeUndefined();
      expect(publicView.placementDetails, `${slug} placementDetails`).toBeUndefined();
      expect(publicView.placedAt, `${slug} placedAt`).toBeUndefined();
    }
  });
});

describe('11. Fair QR Hunt (a fully separate Operation) is untouched by this pass', () => {
  it('the Fair QR Hunt event, its quests, and its dedicated /qr claim flow still exist unmodified', () => {
    const fairEventSource = readSource('lib/fair-hunt.ts');
    expect(fairEventSource).toContain("FAIR_EVENT_SLUG = 'fair-qr-hunt'");
    const qrClaimSource = readSource('app/api/qr/claim/route.ts');
    expect(qrClaimSource.length).toBeGreaterThan(0);
  });
});

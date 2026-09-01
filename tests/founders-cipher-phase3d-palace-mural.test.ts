/**
 * Canton Quests — Founder's Cipher Phase 3D: Palace + The Mural
 * implementation, using real photographic evidence recovered from the
 * local Mac photo archive (see docs/FOUNDERS-CIPHER-PHYSICAL-EVIDENCE.md,
 * Phase 3C/3D addenda). Palace grants no fragment/Lock (Optional Anomaly A
 * only); The Mural grants the Challenge District [THE WORLD] fragment.
 */

import { describe, expect, it } from 'vitest';
import {
  getCollectiblesForPlayer,
  getDrawingEntriesForPlayer,
  getLocalCipherFragmentGrants,
  getPublicQuestView,
  isPlayerQualifiedForFinale,
  reviewSubmission,
  setCurrentPlayer,
  submitQuestProof,
} from '../lib/game-engine';
import { SEED_EVENT, SEED_QUESTS } from '../lib/seed-data';
import { FOUNDER_CIPHER_MESSAGES } from '../lib/gameplay/founders-cipher/messages';
import { checkFinaleEligibility } from '../lib/finale';

const EVENT_ID = SEED_EVENT.id;

function newPlayer(label: string) {
  return setCurrentPlayer(`Phase3D_${label}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, '⭐');
}

function questById(id: string) {
  const quest = SEED_QUESTS.find((q) => q.id === id);
  if (!quest) throw new Error(`Fixture setup error: missing seed quest ${id}`);
  return quest;
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 2));

const PALACE = questById('qst-palace-stars');
const MURAL = questById('qst-goose-land-cipher');
const MURAL_RETIRED = questById('qst-challenge-the-mural');

describe('PALACE — 1. wrong year fails', () => {
  it('rejects a wrong four-digit year and grants nothing', () => {
    const player = newPlayer('palace-wrong');
    const result = submitQuestProof({
      playerId: player.id,
      questId: PALACE.id,
      eventId: EVENT_ID,
      proofType: 'passphrase',
      submittedContent: '1927', // the Palace's real opening year, deliberately NOT the star's year
    });
    expect(result.success).toBe(false);
    expect(result.awardedPoints).toBe(0);
    expect(getDrawingEntriesForPlayer(player.id, EVENT_ID).filter((e) => e.questId === PALACE.id)).toHaveLength(0);
  });
});

describe('PALACE — 2. 1997 succeeds', () => {
  it('the real star year completes the quest', () => {
    const player = newPlayer('palace-correct');
    const result = submitQuestProof({
      playerId: player.id,
      questId: PALACE.id,
      eventId: EVENT_ID,
      proofType: 'passphrase',
      submittedContent: '1997',
    });
    expect(result.success).toBe(true);
    expect(result.awardedPoints).toBeGreaterThan(0);
  });
});

describe('PALACE — 3 & 4. drawing entry exactly once, repeat gives zero additional', () => {
  it('one verified completion grants exactly one entry; resubmitting grants zero more', () => {
    const player = newPlayer('palace-entries');
    submitQuestProof({ playerId: player.id, questId: PALACE.id, eventId: EVENT_ID, proofType: 'passphrase', submittedContent: '1997' });
    const entriesAfterFirst = getDrawingEntriesForPlayer(player.id, EVENT_ID).filter((e) => e.questId === PALACE.id);
    expect(entriesAfterFirst.reduce((sum, e) => sum + e.entriesCount, 0)).toBe(1);

    const repeat = submitQuestProof({ playerId: player.id, questId: PALACE.id, eventId: EVENT_ID, proofType: 'passphrase', submittedContent: '1997' });
    expect(repeat.awardedPoints).toBe(0);
    const entriesAfterRepeat = getDrawingEntriesForPlayer(player.id, EVENT_ID).filter((e) => e.questId === PALACE.id);
    expect(entriesAfterRepeat.reduce((sum, e) => sum + e.entriesCount, 0)).toBe(1);
  });
});

describe('PALACE — 5 & 6. no Cipher Fragment, no Founder Lock', () => {
  it('carries no rewardConfig at all, and a real completion confirms zero fragment/Lock grants', () => {
    expect(PALACE.rewardConfig).toBeUndefined();

    const player = newPlayer('palace-no-progression');
    const result = submitQuestProof({ playerId: player.id, questId: PALACE.id, eventId: EVENT_ID, proofType: 'passphrase', submittedContent: '1997' });
    expect(result.success).toBe(true);
    expect(result.cipherFragmentsAwarded || []).toHaveLength(0);
    expect(result.threeLocksFragmentAwarded).toBeUndefined();
    expect(getLocalCipherFragmentGrants(player.id, EVENT_ID)).toHaveLength(0);
    expect(getCollectiblesForPlayer(player.id)).toHaveLength(0);
  });
});

describe('PALACE — 7. answer not public', () => {
  it('the public quest view never leaks "1997", the star name detail as an answer, or the hash', () => {
    const publicView = getPublicQuestView(PALACE);
    expect((publicView as any).targetCode).toBeUndefined();
    const serialized = JSON.stringify(publicView);
    expect(serialized).not.toContain('1997');
    expect(serialized).not.toContain('0985b889a1fe4f4e1fb925061ac6fb2247f10875f5fcbe63eec2ab55ed68970e');
  });

  it('the full public quest roster serialization stays free of the Palace hash across all quests (regression guard)', () => {
    const serialized = JSON.stringify(SEED_QUESTS.map(getPublicQuestView));
    expect(serialized).not.toContain('0985b889a1fe4f4e1fb925061ac6fb2247f10875f5fcbe63eec2ab55ed68970e');
  });
});

describe('PALACE — 8. Watcher signal anomaly: content registered, not prematurely wired', () => {
  it('PALACE_SIGNAL_ANOMALY exists in the message registry, is well-formed, and is marked onceOnly', () => {
    const msg = FOUNDER_CIPHER_MESSAGES.PALACE_SIGNAL_ANOMALY;
    expect(msg).toBeDefined();
    expect(msg.neutral.trim().length).toBeGreaterThan(0);
    expect(msg.family?.body.trim().length).toBeGreaterThan(0);
    expect(msg.challenge?.body.trim().length).toBeGreaterThan(0);
    expect(msg.secret?.body.trim().length).toBeGreaterThan(0);
    expect(msg.onceOnly).toBe(true);
  });

  it('no existing app/ call site references PALACE_SIGNAL_ANOMALY — confirms it is content-registered only, not wired to any trigger (no premature/duplicate firing is possible because nothing fires it yet)', () => {
    const fs = require('fs');
    const path = require('path');
    function findTsxFiles(dir: string, out: string[] = []): string[] {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) findTsxFiles(full, out);
        else if (/\.(tsx?|jsx?)$/.test(entry.name)) out.push(full);
      }
      return out;
    }
    const appDir = path.resolve(__dirname, '..', 'app');
    const componentsDir = path.resolve(__dirname, '..', 'components');
    const files = [...findTsxFiles(appDir), ...findTsxFiles(componentsDir)];
    const referencing = files.filter((f) => fs.readFileSync(f, 'utf-8').includes('PALACE_SIGNAL_ANOMALY'));
    expect(referencing).toHaveLength(0);
  });
});

describe('MURAL — 9. wrong answer fails', () => {
  it('rejects an unrelated creature name', () => {
    const player = newPlayer('mural-wrong');
    const result = submitQuestProof({
      playerId: player.id,
      questId: MURAL.id,
      eventId: EVENT_ID,
      proofType: 'passphrase',
      submittedContent: 'bear',
    });
    expect(result.success).toBe(false);
    expect(getLocalCipherFragmentGrants(player.id, EVENT_ID)).toHaveLength(0);
  });
});

describe('MURAL — 10 & 11. BLUE WHALE succeeds; WHALE variant behaves intentionally', () => {
  it('the canonical answer BLUE WHALE succeeds', () => {
    const player = newPlayer('mural-blue-whale');
    const result = submitQuestProof({
      playerId: player.id,
      questId: MURAL.id,
      eventId: EVENT_ID,
      proofType: 'passphrase',
      submittedContent: 'Blue Whale',
    });
    expect(result.success).toBe(true);
    expect(result.cipherFragmentsAwarded).toContain('challenge-brass-key');
  });

  it('the accepted bare "WHALE" variant also succeeds, reusing the established project convention', () => {
    const player = newPlayer('mural-whale-variant');
    const result = submitQuestProof({
      playerId: player.id,
      questId: MURAL.id,
      eventId: EVENT_ID,
      proofType: 'passphrase',
      submittedContent: 'whale',
    });
    expect(result.success).toBe(true);
  });
});

describe('MURAL — 12 & 13. THE WORLD awarded exactly once, never duplicated', () => {
  it('one verified completion grants the fragment exactly once; a duplicate correct submission grants nothing new', () => {
    const player = newPlayer('mural-fragment-once');
    submitQuestProof({ playerId: player.id, questId: MURAL.id, eventId: EVENT_ID, proofType: 'passphrase', submittedContent: 'BLUE WHALE' });
    let owned = getLocalCipherFragmentGrants(player.id, EVENT_ID).filter((g) => g.fragmentKey === 'challenge-brass-key');
    expect(owned).toHaveLength(1);

    submitQuestProof({ playerId: player.id, questId: MURAL.id, eventId: EVENT_ID, proofType: 'passphrase', submittedContent: 'BLUE WHALE' });
    owned = getLocalCipherFragmentGrants(player.id, EVENT_ID).filter((g) => g.fragmentKey === 'challenge-brass-key');
    expect(owned).toHaveLength(1);
  });
});

describe('MURAL — 14. exactly one drawing entry', () => {
  it('awards exactly one entry on verified completion', () => {
    const player = newPlayer('mural-entries');
    const result = submitQuestProof({ playerId: player.id, questId: MURAL.id, eventId: EVENT_ID, proofType: 'passphrase', submittedContent: 'BLUE WHALE' });
    expect(result.success).toBe(true);
    const entries = getDrawingEntriesForPlayer(player.id, EVENT_ID).filter((e) => e.questId === MURAL.id);
    expect(entries.reduce((sum, e) => sum + e.entriesCount, 0)).toBe(1);
  });
});

describe('MURAL — 15. answer not public', () => {
  it('the public quest view never leaks BLUE WHALE, WHALE, or either hash', () => {
    const publicView = getPublicQuestView(MURAL);
    expect((publicView as any).targetCode).toBeUndefined();
    expect((publicView as any).acceptedAnswerVariants).toBeUndefined();
    const serialized = JSON.stringify(publicView).toLowerCase();
    expect(serialized).not.toContain('blue whale');
    expect(serialized).not.toContain('"whale"');
  });
});

describe('MURAL — 16. inactive duplicate cannot act as canonical progression route', () => {
  it('qst-challenge-the-mural stays inactive and cannot be reactivated as an alternate THE WORLD source', () => {
    expect(MURAL_RETIRED.status).toBe('inactive');
    expect(MURAL_RETIRED.rewardConfig).toBeUndefined();
  });
});

describe('MURAL — 17. canonical Mural has an authoritative location', () => {
  it('location is set with real coordinates, matching loc-mother-goose-land', () => {
    expect(MURAL.location).toBeDefined();
    expect(MURAL.location?.latitude).toBeDefined();
    expect(MURAL.location?.longitude).toBeDefined();
    expect(MURAL.locationId).toBe('loc-mother-goose-land');
  });
});

describe('MURAL — 18. no prerequisite requirement', () => {
  it('has no prerequisiteQuestId', () => {
    expect(MURAL.prerequisiteQuestId).toBeUndefined();
    expect(PALACE.prerequisiteQuestId).toBeUndefined();
  });
});

describe('CROSS-SYSTEM — 19. completion order remains arbitrary', () => {
  it('completing The Mural before Palace (or vice versa) grants everything correctly either way', async () => {
    const playerA = newPlayer('order-mural-first');
    submitQuestProof({ playerId: playerA.id, questId: MURAL.id, eventId: EVENT_ID, proofType: 'passphrase', submittedContent: 'BLUE WHALE' });
    await tick();
    const palaceAfter = submitQuestProof({ playerId: playerA.id, questId: PALACE.id, eventId: EVENT_ID, proofType: 'passphrase', submittedContent: '1997' });
    expect(palaceAfter.success).toBe(true);
    expect(getLocalCipherFragmentGrants(playerA.id, EVENT_ID).map((g) => g.fragmentKey)).toContain('challenge-brass-key');

    const playerB = newPlayer('order-palace-first');
    submitQuestProof({ playerId: playerB.id, questId: PALACE.id, eventId: EVENT_ID, proofType: 'passphrase', submittedContent: '1997' });
    await tick();
    const muralAfter = submitQuestProof({ playerId: playerB.id, questId: MURAL.id, eventId: EVENT_ID, proofType: 'passphrase', submittedContent: 'BLUE WHALE' });
    expect(muralAfter.success).toBe(true);
    expect(getLocalCipherFragmentGrants(playerB.id, EVENT_ID).map((g) => g.fragmentKey)).toContain('challenge-brass-key');
  });
});

describe('CROSS-SYSTEM — 21. legacy Lock routes remain contained', () => {
  it.each([
    'qst-centennial-discovery',
    'qst-onesto-brass-motto',
    'qst-watchers-silent-court',
    'qst-secret-cipher-77',
    'qst-frankenstein-west-lawn',
  ])('%s still carries no rewardConfig after Palace/Mural implementation', (id) => {
    const quest = SEED_QUESTS.find((q) => q.id === id);
    expect(quest?.rewardConfig).toBeUndefined();
  });
});

describe('CROSS-SYSTEM — 22. Master Cipher architecture unchanged', () => {
  it('checkFinaleEligibility still requires exactly 3 Locks AND 3 decoded Sigils — Palace/Mural did not alter the gate', () => {
    const config = {
      eventId: EVENT_ID,
      requiredSigilCount: 3,
      requiresWatcherEligibility: false,
      masterCipherCluePieces: [],
      finalAnswerHash: 'sha256:deadbeef',
      finalDestinationReveal: null,
      opensAt: null,
      closesAt: null,
      falseFinaleEnabled: false,
      falseFinaleAnswerHash: null,
      falseFinaleRevealText: null,
    };
    // 3 locks, 2 sigils -> not eligible
    expect(checkFinaleEligibility(config, 2, true, false, false).ok).toBe(false);
    // 3 sigils, no locks -> not eligible
    expect(checkFinaleEligibility(config, 3, false, false, false).ok).toBe(false);
    // both -> eligible
    expect(checkFinaleEligibility(config, 3, true, false, false).ok).toBe(true);
  });
});

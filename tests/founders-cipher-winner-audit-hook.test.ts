// Canton Quests — Winner Audit Hook (Master Launch Pivot photo-verification
// correction)
//
// Photo/video proof is never a real-time moderation queue: it auto-completes
// immediately (see verifyAutomatedProof) and the submission is simply locked,
// immutable evidence from that point on (auditStatus: 'not_needed' for every
// ordinary player, forever). The ONLY time any submission's auditStatus ever
// changes is when executePrizeDraw actually selects that specific player as
// a drawn prize candidate — only then does their own photo/video evidence
// for this event get flagged 'winner_audit_pending', ready for a Game
// Master to inspect before payout. Nobody else's submissions are ever
// touched, and a non-photo (e.g. passphrase) quest is never affected either
// since it was never a prize-payout safeguard to begin with.

import { describe, expect, it, beforeEach } from 'vitest';
import {
  initializeGameEngine,
  resetGameEngineStore,
  setCurrentPlayer,
  submitQuestProof,
  awardDrawingEntries,
  lockDrawingLedger,
  executePrizeDraw,
  getWinnerAuditQueue,
  resolveWinnerAuditSubmission,
} from '../lib/game-engine';
import { SEED_EVENT } from '../lib/seed-data';

const EVENT_ID = SEED_EVENT.id;

describe('Winner audit queue stays empty for ordinary players', () => {
  beforeEach(() => {
    resetGameEngineStore();
    initializeGameEngine();
  });

  it('a player who submits photo proof but is never drawn never appears in the winner audit queue', () => {
    const player = setCurrentPlayer('Agent_Never_Drawn', '📸');
    submitQuestProof({
      playerId: player.id,
      questId: 'qst-canton-sign-capture',
      eventId: EVENT_ID,
      proofType: 'photo',
      proofUrl: 'https://example.com/never-drawn.jpg',
    });

    const queue = getWinnerAuditQueue(EVENT_ID);
    expect(queue.some((s) => s.playerId === player.id)).toBe(false);
  });
});

describe('executePrizeDraw flags only the drawn winner\'s photo/video evidence for audit', () => {
  beforeEach(() => {
    resetGameEngineStore();
    initializeGameEngine();
  });

  it('flags the winning candidate\'s photo submission for this event, and nobody else\'s', async () => {
    const winner = setCurrentPlayer('Agent_Winner_Candidate', '🏆');
    const bystander = setCurrentPlayer('Agent_Bystander', '👀');

    const winnerSubmit = submitQuestProof({
      playerId: winner.id,
      questId: 'qst-canton-sign-capture',
      eventId: EVENT_ID,
      proofType: 'photo',
      proofUrl: 'https://example.com/winner.jpg',
    });
    expect(winnerSubmit.submission.auditStatus).toBe('not_needed');

    submitQuestProof({
      playerId: bystander.id,
      questId: 'qst-canton-sign-capture',
      eventId: EVENT_ID,
      proofType: 'photo',
      proofUrl: 'https://example.com/bystander.jpg',
    });

    awardDrawingEntries({
      eventId: EVENT_ID,
      playerId: winner.id,
      entriesCount: 3,
      sourceType: 'quest_completion',
      reason: 'test fixture entries',
    });
    awardDrawingEntries({
      eventId: EVENT_ID,
      playerId: bystander.id,
      entriesCount: 3,
      sourceType: 'quest_completion',
      reason: 'test fixture entries',
    });

    lockDrawingLedger(EVENT_ID);
    await executePrizeDraw({
      eventId: EVENT_ID,
      prizeId: 'prz-audit-hook-test',
      prizeTitle: 'Test Prize',
      drawMethod: 'manual_external',
      manualWinnerPlayerId: winner.id,
      manualWinnerPublicLabel: 'Winner Candidate',
      providerReference: 'test-provider-ref-1',
    });

    const queue = getWinnerAuditQueue(EVENT_ID);
    expect(queue.some((s) => s.playerId === winner.id)).toBe(true);
    expect(queue.some((s) => s.playerId === bystander.id)).toBe(false);
  });

  it('a passphrase (non-photo) submission is never flagged, even for the drawn winner — it was never a payout safeguard to begin with', async () => {
    const winner = setCurrentPlayer('Agent_Passphrase_Winner', '🔑');
    submitQuestProof({
      playerId: winner.id,
      questId: 'qst-bicentennial-bell-cipher',
      eventId: EVENT_ID,
      proofType: 'passphrase',
      submittedContent: 'Janet Weir Creighton',
    });

    awardDrawingEntries({
      eventId: EVENT_ID,
      playerId: winner.id,
      entriesCount: 1,
      sourceType: 'quest_completion',
      reason: 'test fixture entries',
    });

    lockDrawingLedger(EVENT_ID);
    await executePrizeDraw({
      eventId: EVENT_ID,
      prizeId: 'prz-audit-hook-test-2',
      prizeTitle: 'Test Prize 2',
      drawMethod: 'manual_external',
      manualWinnerPlayerId: winner.id,
      manualWinnerPublicLabel: 'Passphrase Winner',
      providerReference: 'test-provider-ref-2',
    });

    const queue = getWinnerAuditQueue(EVENT_ID);
    expect(queue.some((s) => s.playerId === winner.id)).toBe(false);
  });
});

describe('resolveWinnerAuditSubmission approves or rejects without touching rewards/progression', () => {
  beforeEach(() => {
    resetGameEngineStore();
    initializeGameEngine();
  });

  it('approving flips auditStatus to approved and leaves the already-awarded XP untouched', async () => {
    const winner = setCurrentPlayer('Agent_Resolve_Approve', '✅');
    const submitted = submitQuestProof({
      playerId: winner.id,
      questId: 'qst-canton-sign-capture',
      eventId: EVENT_ID,
      proofType: 'photo',
      proofUrl: 'https://example.com/resolve-approve.jpg',
    });
    const xpAfterSubmit = submitted.awardedPoints;

    awardDrawingEntries({ eventId: EVENT_ID, playerId: winner.id, entriesCount: 1, sourceType: 'quest_completion', reason: 'fixture' });
    lockDrawingLedger(EVENT_ID);
    await executePrizeDraw({
      eventId: EVENT_ID,
      prizeId: 'prz-audit-hook-test-3',
      prizeTitle: 'Test Prize 3',
      drawMethod: 'manual_external',
      manualWinnerPlayerId: winner.id,
      manualWinnerPublicLabel: 'Resolve Approve',
      providerReference: 'test-provider-ref-3',
    });

    const resolved = resolveWinnerAuditSubmission(submitted.submission.id, 'approved');
    expect(resolved?.auditStatus).toBe('approved');
    expect(resolved?.awardedPoints).toBe(xpAfterSubmit);
  });
});

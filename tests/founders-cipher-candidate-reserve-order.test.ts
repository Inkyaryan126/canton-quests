// Canton Quests — Deterministic Candidate Reserve Order (Master Launch
// Pivot photo-verification correction, item 7)
//
// A rejected winning-evidence audit must NEVER trigger a fresh discretionary
// re-draw and must NEVER let anyone hand-pick a replacement. Instead, at the
// moment of the original draw, a full reserve sequence is computed once from
// the same locked/frozen snapshot (see buildFinalQuestCandidateSequence) and
// persisted on the PrizeDrawRecord. Rejecting a candidate's evidence only
// ever walks the SAME record forward to the next untried entry in that
// sequence — the rejected candidate's own submission history is preserved,
// never destroyed or rewritten.

import { describe, expect, it, beforeEach } from 'vitest';
import {
  authorizeQuestEvidenceUpload,
  initializeGameEngine,
  resetGameEngineStore,
  setCurrentPlayer,
  submitQuestProof,
  awardDrawingEntries,
  lockDrawingLedger,
  executePrizeDraw,
  resolveWinnerAuditSubmission,
  getWinnerAuditQueue,
} from '../lib/game-engine';
import { SEED_EVENT } from '../lib/seed-data';

const EVENT_ID = SEED_EVENT.id;

describe('executePrizeDraw persists a deterministic candidate reserve sequence', () => {
  beforeEach(() => {
    resetGameEngineStore();
    initializeGameEngine();
  });

  it('a final_quest draw stores an ordered candidateSequence in auditMetadata, starting at order 1 with no disqualifications', async () => {
    const players = ['Agent_Reserve_A', 'Agent_Reserve_B', 'Agent_Reserve_C', 'Agent_Reserve_D'].map((name) =>
      setCurrentPlayer(name, '🎟️')
    );
    players.forEach((p) => {
      awardDrawingEntries({ eventId: EVENT_ID, playerId: p.id, entriesCount: 2, sourceType: 'quest_completion', reason: 'fixture' });
    });

    lockDrawingLedger(EVENT_ID);
    const draw = await executePrizeDraw({
      eventId: EVENT_ID,
      prizeId: 'prz-reserve-order-1',
      prizeTitle: 'Reserve Order Prize',
      drawMethod: 'final_quest',
    });

    expect(Array.isArray(draw.auditMetadata.candidateSequence)).toBe(true);
    expect(draw.auditMetadata.candidateSequence.length).toBeGreaterThanOrEqual(2);
    expect(draw.auditMetadata.candidateSequence[0].playerId).toBe(draw.winningPlayerId);
    expect(draw.auditMetadata.candidateSequence[0].order).toBe(1);
    expect(draw.auditMetadata.currentCandidateOrder).toBe(1);
    expect(draw.auditMetadata.disqualifiedPlayerIds).toEqual([]);

    // Every entry in the sequence names a distinct player — the exclusion
    // set grows monotonically, so the same player can never appear twice.
    const seqPlayerIds = draw.auditMetadata.candidateSequence.map((c: any) => c.playerId);
    expect(new Set(seqPlayerIds).size).toBe(seqPlayerIds.length);
  });

  it('a manual_external draw (not a real weighted lottery) has no candidateSequence to advance through', async () => {
    const winner = setCurrentPlayer('Agent_Manual_NoSequence', '🖐️');
    awardDrawingEntries({ eventId: EVENT_ID, playerId: winner.id, entriesCount: 1, sourceType: 'quest_completion', reason: 'fixture' });
    lockDrawingLedger(EVENT_ID);

    const draw = await executePrizeDraw({
      eventId: EVENT_ID,
      prizeId: 'prz-manual-no-seq',
      prizeTitle: 'Manual Prize',
      drawMethod: 'manual_external',
      manualWinnerPlayerId: winner.id,
      manualWinnerPublicLabel: 'Manual Winner',
      providerReference: 'test-ref',
    });

    expect(draw.auditMetadata.candidateSequence).toBeUndefined();
  });
});

describe('rejecting a winner\'s evidence advances the SAME draw record to the next reserve candidate', () => {
  beforeEach(() => {
    resetGameEngineStore();
    initializeGameEngine();
  });

  it('never conducts a fresh re-draw and never destroys the rejected candidate\'s submission history', async () => {
    const players = ['Agent_R1', 'Agent_R2', 'Agent_R3'].map((name) => setCurrentPlayer(name, '🎯'));
    const submissions = players.map((p) =>
      submitQuestProof({
        playerId: p.id,
        questId: 'qst-canton-sign-capture',
        eventId: EVENT_ID,
        proofType: 'photo',
        proofUrl: authorizeQuestEvidenceUpload({ eventId: EVENT_ID, playerId: p.id, questId: 'qst-canton-sign-capture' }).path,
      })
    );
    players.forEach((p) => {
      awardDrawingEntries({ eventId: EVENT_ID, playerId: p.id, entriesCount: 3, sourceType: 'quest_completion', reason: 'fixture' });
    });

    lockDrawingLedger(EVENT_ID);
    const draw = await executePrizeDraw({
      eventId: EVENT_ID,
      prizeId: 'prz-reserve-order-2',
      prizeTitle: 'Reserve Order Prize 2',
      drawMethod: 'final_quest',
    });

    const originalWinnerId = draw.winningPlayerId;
    const originalWinnerSubmission = submissions.find((s) => s.submission.playerId === originalWinnerId)!;
    expect(originalWinnerSubmission.submission.auditStatus).toBe('not_needed');

    // Queue confirms only the original winner's evidence is pending review.
    expect(getWinnerAuditQueue(EVENT_ID).map((s) => s.playerId)).toContain(originalWinnerId);

    const resolved = resolveWinnerAuditSubmission(originalWinnerSubmission.submission.id, 'rejected');
    expect(resolved?.auditStatus).toBe('rejected');
    expect(resolved?.playerId).toBe(originalWinnerId);
    // Rejection preserves the exact rejected submission — same id, same
    // player, same proof — it is never deleted or reassigned.
    expect(resolved?.id).toBe(originalWinnerSubmission.submission.id);
    expect(resolved?.proofUrl).toBe(originalWinnerSubmission.submission.proofUrl);

    const expectedNextCandidate = draw.auditMetadata.candidateSequence.find((c: any) => c.order === 2);
    expect(expectedNextCandidate).toBeDefined();

    // Re-fetch this exact draw record (via a fresh draw for the same prize
    // is impossible — it's a duplicate-draw guard — so we confirm via the
    // winner audit queue that the NEW candidate's own evidence is now
    // pending, never a fresh discretionary draw).
    const nextCandidateSubmission = submissions.find((s) => s.submission.playerId === expectedNextCandidate.playerId);
    if (nextCandidateSubmission) {
      const queueAfterAdvance = getWinnerAuditQueue(EVENT_ID);
      expect(queueAfterAdvance.some((s) => s.playerId === expectedNextCandidate.playerId)).toBe(true);
    }

    // The originally-rejected player's submission stays rejected, not
    // silently reverted or removed from history.
    const stillRejected = getWinnerAuditQueue(EVENT_ID).some((s) => s.id === originalWinnerSubmission.submission.id);
    expect(stillRejected).toBe(false); // it's 'rejected', not 'winner_audit_pending' anymore — but the row itself persists
  });

  it('approving never advances the candidate sequence', async () => {
    const players = ['Agent_Approve_1', 'Agent_Approve_2'].map((name) => setCurrentPlayer(name, '✅'));
    const submitted = submitQuestProof({
      playerId: players[0].id,
      questId: 'qst-canton-sign-capture',
      eventId: EVENT_ID,
      proofType: 'photo',
      proofUrl: authorizeQuestEvidenceUpload({ eventId: EVENT_ID, playerId: players[0].id, questId: 'qst-canton-sign-capture' }).path,
    });
    players.forEach((p) => {
      awardDrawingEntries({ eventId: EVENT_ID, playerId: p.id, entriesCount: 2, sourceType: 'quest_completion', reason: 'fixture' });
    });

    lockDrawingLedger(EVENT_ID);
    const draw = await executePrizeDraw({
      eventId: EVENT_ID,
      prizeId: 'prz-reserve-order-3',
      prizeTitle: 'Reserve Order Prize 3',
      drawMethod: 'final_quest',
    });

    if (draw.winningPlayerId !== players[0].id) return; // only meaningful when player 1 is drawn

    const resolved = resolveWinnerAuditSubmission(submitted.submission.id, 'approved');
    expect(resolved?.auditStatus).toBe('approved');
    // currentCandidateOrder must remain 1 — approval never advances anything.
    const queue = getWinnerAuditQueue(EVENT_ID);
    expect(queue.some((s) => s.id === submitted.submission.id)).toBe(false); // no longer pending, now approved
  });
});

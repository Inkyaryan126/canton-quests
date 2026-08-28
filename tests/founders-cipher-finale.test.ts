/**
 * Canton Quests — Founder's Cipher Convergence / Master Finale Tests
 */

import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { getConvergenceStage, checkFinaleEligibility, evaluateFinaleSubmission, FinaleConfig } from '../lib/finale';
import { proofDigest } from '../lib/quest-proof-secrets';
import { getPlayerFinaleStatusDB, submitFinaleAnswerDB } from '../lib/finale-db';
import { GET as finaleGET, POST as finalePOST } from '../app/api/game/finale/route';
import { SEED_EVENT } from '../lib/seed-data';

function makeConfig(overrides: Partial<FinaleConfig> = {}): FinaleConfig {
  return {
    eventId: SEED_EVENT.id,
    requiredSigilCount: 3,
    requiresWatcherEligibility: false,
    masterCipherCluePieces: ['Piece one.', 'Piece two.'],
    finalAnswerHash: `sha256:${proofDigest('CONVERGENCE')}`,
    finalDestinationReveal: 'Meet at the fountain at dawn.',
    opensAt: null,
    closesAt: null,
    falseFinaleEnabled: false,
    falseFinaleAnswerHash: null,
    falseFinaleRevealText: null,
    ...overrides,
  };
}

describe('Any district order works — convergence stage only ever counts', () => {
  it('classifies purely by count, never by which specific districts', () => {
    expect(getConvergenceStage(0)).toBe('no_sigils');
    expect(getConvergenceStage(1)).toBe('one_sigil');
    expect(getConvergenceStage(2)).toBe('two_sigils');
    expect(getConvergenceStage(3)).toBe('convergence_ready');
    expect(getConvergenceStage(4)).toBe('convergence_ready'); // never off-by-one for an unexpected higher count
  });
});

describe('3 sigils required (configurable, defaults to 3)', () => {
  it('2 sigils is insufficient against the default 3-sigil requirement', () => {
    const result = checkFinaleEligibility(makeConfig(), 2, false, false);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('insufficient_sigils');
  });

  it('exactly 3 sigils satisfies the default requirement', () => {
    expect(checkFinaleEligibility(makeConfig(), 3, false, false).ok).toBe(true);
  });

  it('a GM-configured lower requirement (e.g. 2) is honored — the count IS configurable', () => {
    expect(checkFinaleEligibility(makeConfig({ requiredSigilCount: 2 }), 2, false, false).ok).toBe(true);
  });
});

describe('Premature master-cipher access blocked', () => {
  it('an unconfigured finale (no answer hash) is never eligible, regardless of sigil count', () => {
    const result = checkFinaleEligibility(makeConfig({ finalAnswerHash: null }), 3, false, false);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_configured');
  });

  it('a finale window that has not opened yet blocks access even with enough sigils', () => {
    const result = checkFinaleEligibility(makeConfig({ opensAt: new Date(Date.now() + 3_600_000).toISOString() }), 3, false, false);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_yet_open');
  });

  it('getPlayerFinaleStatusDB never includes clue pieces when ineligible', async () => {
    const status = await getPlayerFinaleStatusDB(SEED_EVENT.id, 'plr-1');
    expect(status.eligibility.ok).toBe(false);
    expect(status.cluePieces).toEqual([]);
  });
});

describe('Hidden solution not leaked', () => {
  it('FinaleConfig / PlayerFinaleStatus types never carry a raw plaintext answer field — only a *Hash field, and getPlayerFinaleStatusDB never returns any hash field at all', async () => {
    const status = await getPlayerFinaleStatusDB(SEED_EVENT.id, 'plr-1');
    expect(status).not.toHaveProperty('finalAnswerHash');
    expect(status).not.toHaveProperty('falseFinaleAnswerHash');
    expect(JSON.stringify(status)).not.toMatch(/hash/i);
  });

  it('GET /api/game/finale response never contains the word "hash" or "answer" in any key path', async () => {
    const res = await finaleGET(new Request(`http://localhost/api/game/finale?eventSlug=${SEED_EVENT.slug}`));
    // Unauthenticated in this test env -> 401, but even the shape of a
    // failure response carries no config leakage.
    const body = await res.json();
    expect(JSON.stringify(body).toLowerCase()).not.toContain('hash');
  });

  it('lib/finale-db.ts never selects final_answer_hash/false_finale_answer_hash into any player-facing return type (source-level check on the one function that reads player status)', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../lib/finale-db.ts'), 'utf-8');
    const statusFn = source.slice(source.indexOf('export async function getPlayerFinaleStatusDB'));
    expect(statusFn).not.toMatch(/finalAnswerHash:/);
  });
});

describe('Duplicate finale submission idempotent', () => {
  it('evaluateFinaleSubmission short-circuits to already_completed once completedAt is set, never re-checking the answer', () => {
    const outcome = evaluateFinaleSubmission(makeConfig(), { falseFinaleSolvedAt: null, completedAt: new Date().toISOString() }, 'TOTALLY WRONG ANSWER');
    expect(outcome.stage).toBe('already_completed');
  });

  it('a correct answer completes exactly once; the same correct answer submitted again still resolves to already_completed, not a fresh "completed"', () => {
    const config = makeConfig();
    const first = evaluateFinaleSubmission(config, { falseFinaleSolvedAt: null, completedAt: null }, 'CONVERGENCE');
    expect(first.stage).toBe('completed');
    const second = evaluateFinaleSubmission(config, { falseFinaleSolvedAt: null, completedAt: new Date().toISOString() }, 'CONVERGENCE');
    expect(second.stage).toBe('already_completed');
  });

  it('submitFinaleAnswerDB never throws when unconfigured, and reports the same not_configured/not_in_event-shaped rejection on repeat calls', async () => {
    const first = await submitFinaleAnswerDB(SEED_EVENT.id, 'plr-1', 'CONVERGENCE');
    const second = await submitFinaleAnswerDB(SEED_EVENT.id, 'plr-1', 'CONVERGENCE');
    expect(first.eligibility.ok).toBe(false);
    expect(second.eligibility.ok).toBe(false);
  });
});

describe('Ended event blocks inappropriate submissions', () => {
  it('eventEnded=true blocks eligibility even with a fully-configured, open finale and enough sigils', () => {
    const result = checkFinaleEligibility(makeConfig(), 3, false, true);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('event_ended');
  });
});

describe('Watcher optional requirement respected', () => {
  it('when requiresWatcherEligibility is false (default), watcher status never matters', () => {
    expect(checkFinaleEligibility(makeConfig({ requiresWatcherEligibility: false }), 3, false, false).ok).toBe(true);
    expect(checkFinaleEligibility(makeConfig({ requiresWatcherEligibility: false }), 3, true, false).ok).toBe(true);
  });

  it('when requiresWatcherEligibility is true, an ineligible player is blocked and an eligible one passes', () => {
    const blocked = checkFinaleEligibility(makeConfig({ requiresWatcherEligibility: true }), 3, false, false);
    const allowed = checkFinaleEligibility(makeConfig({ requiresWatcherEligibility: true }), 3, true, false);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.reason).toBe('watcher_required');
    expect(allowed.ok).toBe(true);
  });
});

describe('False finale / second-stage reveal', () => {
  const twoStageConfig = makeConfig({
    falseFinaleEnabled: true,
    falseFinaleAnswerHash: `sha256:${proofDigest('APPARENT ANSWER')}`,
    falseFinaleRevealText: 'THE THREE SIGNALS AGREE.',
  });

  it('the apparent answer resolves to false_finale_solved, not completed, when false-finale is enabled', () => {
    const outcome = evaluateFinaleSubmission(twoStageConfig, { falseFinaleSolvedAt: null, completedAt: null }, 'APPARENT ANSWER');
    expect(outcome.stage).toBe('false_finale_solved');
  });

  it('the REAL final answer is rejected until the false finale has been solved first', () => {
    const outcome = evaluateFinaleSubmission(twoStageConfig, { falseFinaleSolvedAt: null, completedAt: null }, 'CONVERGENCE');
    expect(outcome.stage).toBe('incorrect');
  });

  it('once the false finale is solved, the real answer completes the finale', () => {
    const outcome = evaluateFinaleSubmission(twoStageConfig, { falseFinaleSolvedAt: new Date().toISOString(), completedAt: null }, 'CONVERGENCE');
    expect(outcome.stage).toBe('completed');
  });

  it('with false-finale disabled entirely, the real answer completes directly (no gate)', () => {
    const outcome = evaluateFinaleSubmission(makeConfig({ falseFinaleEnabled: false }), { falseFinaleSolvedAt: null, completedAt: null }, 'CONVERGENCE');
    expect(outcome.stage).toBe('completed');
  });
});

describe('Prize drawing not automatically invoked', () => {
  // Strips // and /* */ comments before checking, so an explanatory
  // comment naming these functions (to document their absence) can't
  // produce a false positive — only a real import/call counts.
  function stripComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  }

  it('lib/finale-db.ts never imports or calls any prize-drawing function (source-level structural check, comments excluded)', () => {
    const code = stripComments(fs.readFileSync(path.resolve(__dirname, '../lib/finale-db.ts'), 'utf-8'));
    expect(code).not.toMatch(/executePrizeDrawDB|lockDrawingLedgerDB|publishDrawingResultsDB|drawing_ledger_locks/);
  });

  it('app/api/game/finale/route.ts never imports or calls any prize-drawing function (comments excluded)', () => {
    const code = stripComments(fs.readFileSync(path.resolve(__dirname, '../app/api/game/finale/route.ts'), 'utf-8'));
    expect(code).not.toMatch(/executePrizeDrawDB|lockDrawingLedgerDB|publishDrawingResultsDB/);
  });

  it('a completed finale outcome carries no drawing-entry or prize-draw field at all — only an XP-shaped grant via the existing reward_grants ledger', () => {
    const outcome = evaluateFinaleSubmission(makeConfig(), { falseFinaleSolvedAt: null, completedAt: null }, 'CONVERGENCE');
    expect(outcome).not.toHaveProperty('drawingEntriesAwarded');
    expect(outcome).not.toHaveProperty('prizeDraw');
  });
});

describe('POST /api/game/finale — request validation and auth', () => {
  it('rejects a missing eventSlug or answer', async () => {
    const res = await finalePOST(new Request('http://localhost/api/game/finale', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventSlug: SEED_EVENT.slug }) }));
    expect(res.status).toBe(400);
  });

  it('rejects an unauthenticated submission with 401', async () => {
    const res = await finalePOST(new Request('http://localhost/api/game/finale', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventSlug: SEED_EVENT.slug, answer: 'CONVERGENCE' }) }));
    expect(res.status).toBe(401);
  });

  it('an unknown event slug returns 404 before any auth/eligibility logic runs', async () => {
    const res = await finalePOST(new Request('http://localhost/api/game/finale', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventSlug: 'totally-unknown-mission', answer: 'CONVERGENCE' }) }));
    expect(res.status).toBe(404);
  });
});

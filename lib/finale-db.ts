/**
 * Canton Quests — Founder's Cipher Convergence / Master Finale (Supabase data access)
 * =========================================================================================
 * Server-only. Nothing here ever calls into the prize-drawing system
 * (executePrizeDrawDB, lockDrawingLedgerDB, or any drawing_ledger_locks
 * write) — finale completion is structurally incapable of triggering a
 * prize draw; that remains a fully separate, GM-explicit action, exactly
 * as the mission requires. The one reward this grants is a modest one-time
 * XP token via the existing reward_grants ledger (reward_type
 * FINALE_PROGRESS, already a valid enum value — no schema change needed
 * for that part).
 */

import { supabaseAdmin, isSupabaseAdminConfigured } from './supabase';
import { getEventByIdDB, insertRewardGrantDB } from './supabase-db';
import { getWatcherStatusDB } from './watchers-db';
import {
  FinaleConfig,
  FinaleEligibility,
  FinaleSubmissionOutcome,
  ConvergenceStage,
  getConvergenceStage,
  checkFinaleEligibility,
  evaluateFinaleSubmission,
} from './finale';

function isMissingTable(error: any): boolean {
  // PostgREST returns two different shapes for "this table doesn't exist
  // yet" depending on path: a raw Postgres 42P01/"relation ... does not
  // exist" error, OR (far more commonly in practice, including every
  // migration this session left unapplied remotely) its own
  // schema-cache-miss wording ("Could not find the table 'public.x' in the
  // schema cache", code PGRST205) — both must be treated as "gracefully
  // degrade," not "crash the route."
  return (
    error?.code === '42P01' ||
    error?.code === 'PGRST205' ||
    /relation .* does not exist/i.test(error?.message || '') ||
    /could not find the table/i.test(error?.message || '')
  );
}

function mapConfigFromDB(row: any): FinaleConfig {
  return {
    eventId: row.event_id,
    requiredSigilCount: row.required_sigil_count,
    requiresWatcherEligibility: row.requires_watcher_eligibility,
    masterCipherCluePieces: row.master_cipher_clue_pieces || [],
    finalAnswerHash: row.final_answer_hash || null,
    finalDestinationReveal: row.final_destination_reveal || null,
    opensAt: row.opens_at || null,
    closesAt: row.closes_at || null,
    falseFinaleEnabled: row.false_finale_enabled,
    falseFinaleAnswerHash: row.false_finale_answer_hash || null,
    falseFinaleRevealText: row.false_finale_reveal_text || null,
  };
}

async function getFinaleConfigDB(eventId: string): Promise<FinaleConfig | null> {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin.from('finale_config').select('*').eq('event_id', eventId).maybeSingle();
  if (error) {
    if (isMissingTable(error)) return null;
    throw new Error(`Failed to read finale config: ${error.message}`);
  }
  return data ? mapConfigFromDB(data) : null;
}

async function getUnlockedSigilCountDB(eventId: string, playerId: string): Promise<number> {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return 0;
  const { data, error } = await supabaseAdmin
    .from('player_district_cipher_progress')
    .select('status')
    .eq('event_id', eventId)
    .eq('player_id', playerId);
  if (error) return 0;
  return (data || []).filter((r: any) => r.status === 'token_unlocked').length;
}

async function getPlayerThreeLocksDB(
  eventId: string,
  playerId: string
): Promise<{ mark: boolean; code: boolean; word: boolean; hasAll: boolean }> {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return { mark: false, code: false, word: false, hasAll: false };
  }

  const keys = new Set<string>();

  // 1. Check reward_grants for event-scoped lock provenance
  const { data: grants } = await supabaseAdmin
    .from('reward_grants')
    .select('reward_key')
    .eq('event_id', eventId)
    .eq('player_id', playerId)
    .in('reward_type', ['THREE_LOCKS_FRAGMENT', 'COLLECTIBLE_UNLOCK']);

  if (grants) {
    for (const g of grants) {
      if (g.reward_key) keys.add(g.reward_key.toLowerCase());
    }
  }

  // 2. Check player_collectibles table where event_id matches
  const { data: cols } = await supabaseAdmin
    .from('player_collectibles')
    .select('collectible_id, event_id, collectibles(id, slug)')
    .eq('player_id', playerId);

  if (cols) {
    for (const row of cols as any[]) {
      if (row.event_id === eventId) {
        if (row.collectibles?.slug) keys.add(row.collectibles.slug.toLowerCase());
        if (row.collectibles?.id) keys.add(row.collectibles.id.toLowerCase());
        if (row.collectible_id) keys.add(row.collectible_id.toLowerCase());
      }
    }
  }

  const mark = keys.has('col-founder-mark') || keys.has('founder-mark') || keys.has('mark');
  const code = keys.has('col-founder-code') || keys.has('founder-code') || keys.has('code');
  const word = keys.has('col-founder-word') || keys.has('founder-word') || keys.has('word');

  return {
    mark,
    code,
    word,
    hasAll: mark && code && word,
  };
}

async function getPlayerFinaleProgressDB(eventId: string, playerId: string): Promise<{ falseFinaleSolvedAt: string | null; completedAt: string | null; attempts: number }> {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return { falseFinaleSolvedAt: null, completedAt: null, attempts: 0 };
  const { data, error } = await supabaseAdmin.from('player_finale_progress').select('*').eq('event_id', eventId).eq('player_id', playerId).maybeSingle();
  if (error || !data) return { falseFinaleSolvedAt: null, completedAt: null, attempts: 0 };
  return { falseFinaleSolvedAt: data.false_finale_solved_at || null, completedAt: data.completed_at || null, attempts: data.attempts || 0 };
}

export interface PlayerFinaleStatus {
  convergenceStage: ConvergenceStage;
  unlockedSigilCount: number;
  hasAllThreeLocks: boolean;
  threeLocks: { mark: boolean; code: boolean; word: boolean };
  eligibility: FinaleEligibility;
  /** Only populated once eligibility.ok is true — never leaked before then. */
  cluePieces: string[];
  falseFinaleSolvedAt: string | null;
  completedAt: string | null;
  /**
   * Only populated once completedAt is set — same "only reveal once earned"
   * rule as cluePieces above. Lets the player-facing completed state survive
   * a refresh/deep-link (state E) with the real reveal text, rather than
   * only ever seeing it once, live, from the POST response at the moment of
   * submission.
   */
  destinationReveal: string | null;
}

/** The single player-facing read — computes convergence stage, eligibility, and (only if eligible) the clue pieces. The answer hash itself is never part of this or any other return value in this module. */
export async function getPlayerFinaleStatusDB(eventId: string, playerId: string): Promise<PlayerFinaleStatus> {
  const [config, unlockedSigilCount, threeLocks, event, watcherStatus, progress] = await Promise.all([
    getFinaleConfigDB(eventId),
    getUnlockedSigilCountDB(eventId, playerId),
    getPlayerThreeLocksDB(eventId, playerId),
    getEventByIdDB(eventId),
    getWatcherStatusDB(eventId, playerId),
    getPlayerFinaleProgressDB(eventId, playerId),
  ]);

  const eventEnded = event?.status === 'ended' || event?.currentPhase === 'ended';
  const eligibility = checkFinaleEligibility(config, unlockedSigilCount, threeLocks.hasAll, watcherStatus.isEligible, eventEnded);

  return {
    convergenceStage: getConvergenceStage(unlockedSigilCount),
    unlockedSigilCount,
    hasAllThreeLocks: threeLocks.hasAll,
    threeLocks: { mark: threeLocks.mark, code: threeLocks.code, word: threeLocks.word },
    eligibility,
    cluePieces: eligibility.ok ? config!.masterCipherCluePieces : [],
    falseFinaleSolvedAt: progress.falseFinaleSolvedAt,
    completedAt: progress.completedAt,
    destinationReveal: progress.completedAt ? config?.finalDestinationReveal ?? null : null,
  };
}

export interface FinaleSubmissionResult {
  eligibility: FinaleEligibility;
  outcome?: FinaleSubmissionOutcome;
}

/**
 * The single authenticated-player submission entry point. Re-checks full
 * eligibility server-side (never trusts that a prior status check is still
 * valid — sigils, the window, and event state can all change between
 * requests), then evaluates the answer via the pure, hash-comparing
 * evaluateFinaleSubmission. A wrong answer increments the attempts counter
 * (observability only — this mission sets no hard attempt cap); a correct
 * one records completion exactly once (UNIQUE(event_id, player_id) plus
 * the completedAt-already-set short-circuit in evaluateFinaleSubmission
 * makes a duplicate correct submission a safe no-op, never a double grant).
 */
export async function submitFinaleAnswerDB(eventId: string, playerId: string, submittedAnswer: string): Promise<FinaleSubmissionResult> {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return { eligibility: { ok: false, reason: 'not_configured', message: 'Live finale submission requires Supabase configuration.' } };
  }

  const [config, unlockedSigilCount, threeLocks, event, watcherStatus, progress] = await Promise.all([
    getFinaleConfigDB(eventId),
    getUnlockedSigilCountDB(eventId, playerId),
    getPlayerThreeLocksDB(eventId, playerId),
    getEventByIdDB(eventId),
    getWatcherStatusDB(eventId, playerId),
    getPlayerFinaleProgressDB(eventId, playerId),
  ]);

  const eventEnded = event?.status === 'ended' || event?.currentPhase === 'ended';
  const eligibility = checkFinaleEligibility(config, unlockedSigilCount, threeLocks.hasAll, watcherStatus.isEligible, eventEnded);
  if (!eligibility.ok) return { eligibility };

  const outcome = evaluateFinaleSubmission(config!, progress, submittedAnswer);

  const nowIso = new Date().toISOString();
  const patch: Record<string, unknown> = { updated_at: nowIso };
  if (outcome.stage === 'incorrect') patch.attempts = progress.attempts + 1;
  if (outcome.stage === 'false_finale_solved') patch.false_finale_solved_at = nowIso;
  if (outcome.stage === 'completed') patch.completed_at = nowIso;

  await supabaseAdmin.from('player_finale_progress').upsert(
    { event_id: eventId, player_id: playerId, ...patch },
    { onConflict: 'event_id,player_id' }
  );

  if (outcome.stage === 'completed') {
    const granted = await insertRewardGrantDB({ eventId, playerId, rewardType: 'FINALE_PROGRESS', rewardKey: 'master_cipher_complete', xpAwarded: 100 });
    if (granted) {
      const { data: player } = await supabaseAdmin.from('players').select('total_xp').eq('id', playerId).maybeSingle();
      const nextTotalXp = Math.max(0, (player?.total_xp || 0) + 100);
      await supabaseAdmin.from('players').update({ total_xp: nextTotalXp, level: Math.floor(nextTotalXp / 250) + 1 }).eq('id', playerId);
    }
  }

  return { eligibility, outcome };
}

/** GM-only: create or update the finale configuration for an event. Never reachable by a player-facing route. */
export async function upsertFinaleConfigDB(eventId: string, patch: Partial<Omit<FinaleConfig, 'eventId'>>): Promise<void> {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) throw new Error('upsertFinaleConfigDB requires Supabase service-role configuration.');
  const dbPatch: Record<string, unknown> = { event_id: eventId, updated_at: new Date().toISOString() };
  if (patch.requiredSigilCount !== undefined) dbPatch.required_sigil_count = patch.requiredSigilCount;
  if (patch.requiresWatcherEligibility !== undefined) dbPatch.requires_watcher_eligibility = patch.requiresWatcherEligibility;
  if (patch.masterCipherCluePieces !== undefined) dbPatch.master_cipher_clue_pieces = patch.masterCipherCluePieces;
  if (patch.finalAnswerHash !== undefined) dbPatch.final_answer_hash = patch.finalAnswerHash;
  if (patch.finalDestinationReveal !== undefined) dbPatch.final_destination_reveal = patch.finalDestinationReveal;
  if (patch.opensAt !== undefined) dbPatch.opens_at = patch.opensAt;
  if (patch.closesAt !== undefined) dbPatch.closes_at = patch.closesAt;
  if (patch.falseFinaleEnabled !== undefined) dbPatch.false_finale_enabled = patch.falseFinaleEnabled;
  if (patch.falseFinaleAnswerHash !== undefined) dbPatch.false_finale_answer_hash = patch.falseFinaleAnswerHash;
  if (patch.falseFinaleRevealText !== undefined) dbPatch.false_finale_reveal_text = patch.falseFinaleRevealText;

  const { error } = await supabaseAdmin.from('finale_config').upsert(dbPatch, { onConflict: 'event_id' });
  if (error) throw new Error(`Failed to save finale config: ${error.message}`);
}

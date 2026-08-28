/**
 * Canton Quests — Generic Admin Mutation Audit Log
 * ====================================================
 * A single, reusable audit trail for Game Master mutations that don't
 * already have their own dedicated ledger (Live City Events has
 * live_event_audit_log; reward-granting has reward_grants — neither is
 * duplicated here). Every meaningful GM action wired into
 * app/api/admin/live/route.ts calls recordAdminAuditDB after the mutation
 * succeeds — this is observability, never a gate on the mutation itself.
 */

import { supabaseAdmin, isSupabaseAdminConfigured } from './supabase';

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

export interface AdminAuditEntry {
  id: string;
  eventId: string;
  actor: string;
  action: string;
  targetType?: string;
  targetId?: string;
  detail: Record<string, unknown>;
  createdAt: string;
}

export async function recordAdminAuditDB(params: {
  eventId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  detail?: Record<string, unknown>;
  actor?: string;
}): Promise<void> {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return;
  const { error } = await supabaseAdmin.from('admin_audit_log').insert({
    event_id: params.eventId,
    actor: params.actor || 'Game Master',
    action: params.action,
    target_type: params.targetType || null,
    target_id: params.targetId || null,
    detail: params.detail || {},
  });
  if (error && !isMissingTable(error)) {
    // Never fail the underlying mutation over an audit-write problem.
  }
}

/** Event-scoped read, most recent first — a mutation for event A is never returned when querying event B. */
export async function getAdminAuditLogDB(eventId: string, limit: number = 100): Promise<AdminAuditEntry[]> {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return [];
  const { data, error } = await supabaseAdmin
    .from('admin_audit_log')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    if (isMissingTable(error)) return [];
    return [];
  }
  return (data || []).map((row: any) => ({
    id: row.id,
    eventId: row.event_id,
    actor: row.actor,
    action: row.action,
    targetType: row.target_type || undefined,
    targetId: row.target_id || undefined,
    detail: row.detail || {},
    createdAt: row.created_at,
  }));
}

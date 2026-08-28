/**
 * Canton Quests — Personal Roles & Signal Carrier Propagation (Supabase data access)
 * =======================================================================================
 * Server-only, and this is the one module in the whole session where that
 * matters most for privacy, not just security: a role row is never
 * readable by anyone but its own player (RLS) and never returned by any
 * API route for a player other than the authenticated caller.
 */

import { supabaseAdmin, isSupabaseAdminConfigured } from './supabase';
import { PersonalRoleType, PersonalRoleState, PERSONAL_ROLE_DEFINITIONS, assignCoreRole, decideSignalPropagation } from './personal-roles';

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

function mapRow(row: any): PersonalRoleState {
  const type = row.role_type as PersonalRoleType;
  return {
    type,
    definition: PERSONAL_ROLE_DEFINITIONS[type],
    origin: row.origin,
    isRevealed: row.is_revealed,
    assignedAt: row.assigned_at,
  };
}

/** Grants a specific role type, idempotently — a repeat grant for a role the player already holds is a safe no-op (UNIQUE(event_id, player_id, role_type) absorbs it). */
async function grantRoleDB(eventId: string, playerId: string, roleType: PersonalRoleType, origin: 'SEEDED' | 'PROPAGATED', propagatedFromPlayerId?: string): Promise<{ newlyGranted: boolean }> {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return { newlyGranted: false };
  const { error } = await supabaseAdmin.from('player_personal_roles').insert({
    event_id: eventId,
    player_id: playerId,
    role_type: roleType,
    origin,
    propagated_from_player_id: propagatedFromPlayerId || null,
  });
  if (error) {
    if (error.code === '23505') return { newlyGranted: false }; // already holds this role
    if (isMissingTable(error)) return { newlyGranted: false };
    throw new Error(`Failed to grant personal role: ${error.message}`);
  }
  return { newlyGranted: true };
}

/** Every role this player currently holds for this event — private, own-eyes-only by construction (callers must always scope playerId to the authenticated session). */
export async function getPlayerPersonalRolesDB(eventId: string, playerId: string): Promise<PersonalRoleState[]> {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return [];
  const { data, error } = await supabaseAdmin.from('player_personal_roles').select('*').eq('event_id', eventId).eq('player_id', playerId);
  if (error) {
    if (isMissingTable(error)) return [];
    throw new Error(`Failed to read personal roles: ${error.message}`);
  }
  return (data || []).map(mapRow);
}

/** Lazily assigns this player's one core role (Messenger/Witness/Keyholder) on first check, deterministically — idempotent, safe to call every time the player views their status. */
export async function getOrAssignCoreRoleDB(eventId: string, playerId: string): Promise<PersonalRoleState[]> {
  const existing = await getPlayerPersonalRolesDB(eventId, playerId);
  if (existing.some((r) => r.type !== 'SIGNAL_CARRIER')) return existing;

  const coreType = assignCoreRole(playerId, eventId);
  await grantRoleDB(eventId, playerId, coreType, 'SEEDED');
  return getPlayerPersonalRolesDB(eventId, playerId);
}

/**
 * The Signal Carrier propagation hook — call this after any NEW player_links
 * row is recorded (lib/player-links-db.ts's createPlayerLinkDB). If exactly
 * one of the two players already carries the signal, the other legitimately
 * catches it too (both keep carrying — this is a spread, not a hot-potato
 * transfer, matching "city-wide count increases"). If neither or both
 * already carry it, nothing happens. Idempotent: a repeat link between the
 * same already-carrying pair is a no-op, since grantRoleDB's UNIQUE
 * constraint makes a second grant to an existing carrier free.
 */
export async function propagateSignalCarrierDB(eventId: string, playerAId: string, playerBId: string): Promise<{ propagatedTo?: string }> {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return {};
  const [aRoles, bRoles] = await Promise.all([getPlayerPersonalRolesDB(eventId, playerAId), getPlayerPersonalRolesDB(eventId, playerBId)]);
  const aCarries = aRoles.some((r) => r.type === 'SIGNAL_CARRIER');
  const bCarries = bRoles.some((r) => r.type === 'SIGNAL_CARRIER');

  const decision = decideSignalPropagation(aCarries, bCarries);
  if (decision.propagateToA) {
    const result = await grantRoleDB(eventId, playerAId, 'SIGNAL_CARRIER', 'PROPAGATED', playerBId);
    return result.newlyGranted ? { propagatedTo: playerAId } : {};
  }
  if (decision.propagateToB) {
    const result = await grantRoleDB(eventId, playerBId, 'SIGNAL_CARRIER', 'PROPAGATED', playerAId);
    return result.newlyGranted ? { propagatedTo: playerBId } : {};
  }
  return {};
}

/** GM-only: seed the first carrier(s) at event start. Not reachable by any player-facing route. */
export async function seedSignalCarrierDB(eventId: string, playerId: string): Promise<{ newlyGranted: boolean }> {
  return grantRoleDB(eventId, playerId, 'SIGNAL_CARRIER', 'SEEDED');
}

/** Safe aggregate count — no per-player identity — for the City State projection (Mission 3). */
export async function getSignalCarrierCountDB(eventId: string): Promise<number> {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return 0;
  const { count, error } = await supabaseAdmin
    .from('player_personal_roles')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .eq('role_type', 'SIGNAL_CARRIER');
  if (error) return 0;
  return count || 0;
}

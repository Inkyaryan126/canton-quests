/**
 * Canton Quests — GM Player Search (Supabase data access)
 * ===========================================================
 * Server-only, GM-authenticated-route-only. This deliberately reads
 * PRIVATE per-player state (personal roles, Watcher status) that no
 * player-facing route ever exposes across players — safe here because the
 * only caller is app/api/admin/live's search_players action, which
 * requires a real Game Master session. Never exposes email or any other
 * account-identity field beyond what the roster already shows publicly
 * (displayName, path, XP, rank) plus the additional admin-authorized
 * fields the mission explicitly lists (quests, drawing entries, sigils,
 * badges, personal mission state).
 */

import { supabaseAdmin, isSupabaseAdminConfigured } from './supabase';
import { getLeaderboardDB, getDrawingEntriesForPlayerDB, getAchievementsForPlayerDB, getEventParticipationDB, getQuestByIdDB } from './supabase-db';
import { getPlayerPersonalRolesDB } from './personal-roles-db';

export interface AdminPlayerSearchResult {
  playerId: string;
  displayName: string;
  path: string | null;
  totalXp: number;
  rank: number;
  questsCompletedCount: number;
  drawingEntriesCount: number;
  unlockedSigilCount: number;
  badgeCount: number;
  personalRoleTypes: string[];
}

/** Case-insensitive substring match on displayName, or an exact playerId match — capped to a reasonable result size for a live GM search box. */
export async function searchPlayersDB(eventId: string, query: string, limit: number = 25): Promise<AdminPlayerSearchResult[]> {
  const leaderboard = await getLeaderboardDB(eventId);
  const q = query.trim().toLowerCase();

  const matches = leaderboard.filter((e) => !q || e.displayName.toLowerCase().includes(q) || e.playerId === query.trim()).slice(0, limit);

  return Promise.all(
    matches.map(async (entry) => {
      const [participation, drawingEntries, achievements, roles, sigilRows] = await Promise.all([
        getEventParticipationDB(eventId, entry.playerId).catch(() => undefined),
        getDrawingEntriesForPlayerDB(entry.playerId, eventId).catch(() => []),
        getAchievementsForPlayerDB(entry.playerId).catch(() => []),
        getPlayerPersonalRolesDB(eventId, entry.playerId).catch(() => []),
        isSupabaseAdminConfigured && supabaseAdmin
          ? supabaseAdmin.from('player_district_cipher_progress').select('status').eq('event_id', eventId).eq('player_id', entry.playerId)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const unlockedSigilCount = (sigilRows.data || []).filter((r: any) => r.status === 'token_unlocked').length;

      return {
        playerId: entry.playerId,
        displayName: entry.displayName,
        path: participation?.path || null,
        totalXp: entry.totalPoints,
        rank: entry.rank,
        questsCompletedCount: entry.questsCompletedCount,
        drawingEntriesCount: drawingEntries.reduce((sum, e) => sum + (e.entriesCount || 0), 0),
        unlockedSigilCount,
        badgeCount: achievements.length,
        personalRoleTypes: roles.map((r) => r.type),
      };
    })
  );
}

export interface AdminPendingSubmission {
  submissionId: string;
  questId: string;
  questTitle: string;
  playerId: string;
  proofType: string;
  submittedContent?: string;
  proofUrl?: string;
  submittedAt: string;
}

/** Quest Operations section: every currently-pending submission for this event, most recent first, capped for a live GM view. */
export async function getPendingSubmissionsDB(eventId: string, limit: number = 50): Promise<AdminPendingSubmission[]> {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return [];
  const { data, error } = await supabaseAdmin
    .from('quest_submissions')
    .select('id, quest_id, player_id, proof_type, submitted_content, proof_url, submitted_at')
    .eq('event_id', eventId)
    .eq('status', 'pending')
    .order('submitted_at', { ascending: false })
    .limit(limit);
  if (error || !data) return [];

  const questCache = new Map<string, string>();
  return Promise.all(
    data.map(async (row: any) => {
      if (!questCache.has(row.quest_id)) {
        const quest = await getQuestByIdDB(row.quest_id).catch(() => undefined);
        questCache.set(row.quest_id, quest?.title || 'Unknown Mission');
      }
      return {
        submissionId: row.id,
        questId: row.quest_id,
        questTitle: questCache.get(row.quest_id)!,
        playerId: row.player_id,
        proofType: row.proof_type,
        submittedContent: row.submitted_content || undefined,
        proofUrl: row.proof_url || undefined,
        submittedAt: row.submitted_at,
      };
    })
  );
}

import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../supabase';
import {
  GRID_CONTEST_HISTORY_EVENT_TYPES,
  type GridContestHistoryContext,
  type GridContestHistoryEvent,
  type GridContestHistoryEventType,
  type GridContestHistoryPort,
} from './contest-history-port';

interface GridContestHistoryContextRow {
  id: string;
  season_id: string;
  city_id: string;
  source_territory_id: string;
  target_territory_id: string;
  attacker_player_id: string;
  defender_player_id: string;
  attacker_committed_influence: number;
  defender_committed_influence: number;
  attacker_remaining_influence: number;
  defender_remaining_influence: number;
  round_number: number;
  status: GridContestHistoryContext['status'];
  started_at: string;
  ended_at: string | null;
}

interface GridContestHistoryEventRow {
  id: string;
  actor_player_id: string | null;
  event_type: GridContestHistoryEventType;
  payload: unknown;
  created_at: string;
}

function mapContest(
  row: GridContestHistoryContextRow,
): GridContestHistoryContext {
  return {
    contestId: row.id,
    seasonId: row.season_id,
    cityId: row.city_id,
    sourceTerritoryId: row.source_territory_id,
    targetTerritoryId: row.target_territory_id,
    attackerPlayerId: row.attacker_player_id,
    defenderPlayerId: row.defender_player_id,
    attackerCommittedInfluence: row.attacker_committed_influence,
    defenderCommittedInfluence: row.defender_committed_influence,
    attackerRemainingInfluence: row.attacker_remaining_influence,
    defenderRemainingInfluence: row.defender_remaining_influence,
    roundNumber: row.round_number,
    status: row.status,
    startedAt: row.started_at,
    endedAt: row.ended_at,
  };
}

function mapPayload(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {};
  }
  return payload as Record<string, unknown>;
}

function mapEvent(row: GridContestHistoryEventRow): GridContestHistoryEvent {
  return {
    eventId: row.id,
    actorPlayerId: row.actor_player_id,
    eventType: row.event_type,
    payload: mapPayload(row.payload),
    createdAt: row.created_at,
  };
}

export function createSupabaseGridContestHistoryPort(
  client: SupabaseClient | null = supabaseAdmin,
): GridContestHistoryPort {
  if (!client) {
    throw new Error(
      'Grid contest history requires Supabase service-role configuration',
    );
  }

  return {
    async getContestContext(contestId: string) {
      const { data, error } = await client
        .from('grid_contests')
        .select(
          [
            'id',
            'season_id',
            'city_id',
            'source_territory_id',
            'target_territory_id',
            'attacker_player_id',
            'defender_player_id',
            'attacker_committed_influence',
            'defender_committed_influence',
            'attacker_remaining_influence',
            'defender_remaining_influence',
            'round_number',
            'status',
            'started_at',
            'ended_at',
          ].join(','),
        )
        .eq('id', contestId)
        .maybeSingle();

      if (error) {
        throw new Error(
          `Failed to read Grid contest history context: ${error.message}`,
        );
      }

      return data
        ? mapContest(data as unknown as GridContestHistoryContextRow)
        : null;
    },

    async listContestEvents(contestId: string, seasonId: string) {
      const { data, error } = await client
        .from('grid_game_events')
        .select('id,actor_player_id,event_type,payload,created_at')
        .eq('season_id', seasonId)
        .eq('entity_type', 'contest')
        .eq('entity_id', contestId)
        .in('event_type', [...GRID_CONTEST_HISTORY_EVENT_TYPES])
        .order('created_at', { ascending: true })
        .order('id', { ascending: true });

      if (error) {
        throw new Error(
          `Failed to read Grid contest replay events: ${error.message}`,
        );
      }

      return (data ?? []).map((row) =>
        mapEvent(row as GridContestHistoryEventRow),
      );
    },
  };
}

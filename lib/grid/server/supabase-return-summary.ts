import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../supabase';
import type { GridCityPackage } from '../core/types';
import type {
  GridReturnActivityBatch,
  GridReturnActivityEvent,
  GridReturnContestOutcome,
  GridReturnSummaryPort,
  GridReturnViewerRole,
} from './return-summary-port';

type EventRow = {
  event_type: string;
  actor_player_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
};

function isContestOutcome(value: unknown): value is Exclude<GridReturnContestOutcome, null> {
  return (
    value === 'active' ||
    value === 'captured' ||
    value === 'defended' ||
    value === 'withdrawn' ||
    value === 'cancelled'
  );
}

export function createSupabaseGridReturnSummaryPort(
  pkg: GridCityPackage,
  client: SupabaseClient | null = supabaseAdmin,
): GridReturnSummaryPort {
  if (!client) {
    throw new Error('Grid return summary requires Supabase service-role configuration');
  }

  return {
    async getContext(playerId) {
      const cityResult = await client
        .from('grid_cities')
        .select('id')
        .eq('slug', pkg.city.slug)
        .maybeSingle();
      if (cityResult.error) {
        throw new Error(`Failed to read Grid return city: ${cityResult.error.message}`);
      }
      if (!cityResult.data) return null;

      const cityId = (cityResult.data as { id: string }).id;
      const seasonResult = await client
        .from('grid_seasons')
        .select('id')
        .eq('city_id', cityId)
        .eq('slug', pkg.seasonTemplate.slug)
        .maybeSingle();
      if (seasonResult.error) {
        throw new Error(`Failed to read Grid return season: ${seasonResult.error.message}`);
      }
      if (!seasonResult.data) return null;

      const seasonId = (seasonResult.data as { id: string }).id;
      const playerResult = await client
        .from('grid_player_season_state')
        .select('last_active_at')
        .eq('season_id', seasonId)
        .eq('player_id', playerId)
        .maybeSingle();
      if (playerResult.error) {
        throw new Error(
          `Failed to read Grid return player state: ${playerResult.error.message}`,
        );
      }
      if (!playerResult.data) return null;

      return {
        cityId,
        seasonId,
        lastActiveAt: (playerResult.data as { last_active_at: string }).last_active_at,
      };
    },

    async listActivity(seasonId, playerId, since, limit): Promise<GridReturnActivityBatch> {
      const eventResult = await client
        .from('grid_game_events')
        .select('event_type,actor_player_id,entity_type,entity_id,payload,created_at')
        .eq('season_id', seasonId)
        .gt('created_at', since)
        .order('created_at', { ascending: false })
        .limit(limit + 1);
      if (eventResult.error) {
        throw new Error(
          `Failed to read Grid return activity: ${eventResult.error.message}`,
        );
      }

      const rows = (eventResult.data ?? []) as EventRow[];
      const truncated = rows.length > limit;
      const selected = rows.slice(0, limit);

      const contestIds = [
        ...new Set(
          selected
            .filter((row) => row.entity_type === 'contest' && row.entity_id)
            .map((row) => row.entity_id as string),
        ),
      ];

      const contestRoles = new Map<
        string,
        { attackerPlayerId: string; defenderPlayerId: string }
      >();

      if (contestIds.length > 0) {
        const contestResult = await client
          .from('grid_contests')
          .select('id,attacker_player_id,defender_player_id')
          .in('id', contestIds);
        if (contestResult.error) {
          throw new Error(
            `Failed to read Grid return contest roles: ${contestResult.error.message}`,
          );
        }

        for (const row of (contestResult.data ?? []) as Array<{
          id: string;
          attacker_player_id: string;
          defender_player_id: string;
        }>) {
          contestRoles.set(row.id, {
            attackerPlayerId: row.attacker_player_id,
            defenderPlayerId: row.defender_player_id,
          });
        }
      }

      const events: GridReturnActivityEvent[] = selected.map((row) => {
        const contestRole =
          row.entity_type === 'contest' && row.entity_id
            ? contestRoles.get(row.entity_id)
            : undefined;

        let viewerRole: GridReturnViewerRole = 'none';
        if (contestRole?.attackerPlayerId === playerId) viewerRole = 'attacker';
        else if (contestRole?.defenderPlayerId === playerId) viewerRole = 'defender';
        else if (row.actor_player_id === playerId) viewerRole = 'actor';
        else if (row.payload?.defenderPlayerId === playerId) viewerRole = 'defender';

        const status = row.payload?.status;
        const contestOutcome: GridReturnContestOutcome = isContestOutcome(status)
          ? status
          : null;

        return {
          eventType: row.event_type,
          entityType: row.entity_type,
          createdAt: row.created_at,
          viewerRole,
          contestOutcome,
        };
      });

      return { events, truncated };
    },
  };
}

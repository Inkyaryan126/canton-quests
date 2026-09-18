import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../supabase';
import type { GridProgressionEvent } from '../core/progression-events';
import type {
  GridProgressionEventReadPort,
  GridProgressionProjectionSource,
  GridProgressionProjectionWritePort,
  GridSeasonProgressionProjection,
} from './progression-rebuild-port';

const EVENT_PAGE_SIZE = 500;

type EventRow = {
  id: string;
  season_id: string | null;
  actor_player_id: string | null;
  event_type: string;
  payload: Record<string, unknown> | null;
  created_at: string;
};

function mapEvent(row: EventRow): GridProgressionEvent {
  return {
    id: row.id,
    seasonId: row.season_id,
    actorPlayerId: row.actor_player_id,
    eventType: row.event_type,
    payload: row.payload && typeof row.payload === 'object' ? row.payload : {},
    createdAt: row.created_at,
  };
}

async function readActorEvents(
  client: SupabaseClient,
  playerId: string,
  seasonId?: string,
): Promise<GridProgressionEvent[]> {
  const events: GridProgressionEvent[] = [];
  let offset = 0;

  while (true) {
    let query = client
      .from('grid_game_events')
      .select('id,season_id,actor_player_id,event_type,payload,created_at')
      .eq('actor_player_id', playerId)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true });

    if (seasonId) query = query.eq('season_id', seasonId);

    const { data, error } = await query.range(offset, offset + EVENT_PAGE_SIZE - 1);
    if (error) {
      throw new Error(`Failed to read Grid progression events: ${error.message}`);
    }

    const page = (data ?? []) as EventRow[];
    events.push(...page.map(mapEvent));
    if (page.length < EVENT_PAGE_SIZE) break;
    offset += page.length;
  }

  return events;
}

function seasonRpcArgs(projection: GridSeasonProgressionProjection) {
  return {
    p_season_id: projection.seasonId,
    p_player_id: projection.playerId,
    p_source_event_count: projection.sourceEventCount,
    p_source_event_fingerprint: projection.sourceEventFingerprint,
    p_policy_fingerprint: projection.policyFingerprint,
    p_source_last_event_at: projection.sourceLastEventAt,
    p_snapshot: projection.snapshot,
  };
}

function lifetimeRpcArgs(projection: GridProgressionProjectionSource) {
  return {
    p_player_id: projection.playerId,
    p_source_event_count: projection.sourceEventCount,
    p_source_event_fingerprint: projection.sourceEventFingerprint,
    p_policy_fingerprint: projection.policyFingerprint,
    p_source_last_event_at: projection.sourceLastEventAt,
    p_snapshot: projection.snapshot,
  };
}

function appliedResult(data: unknown): { applied: boolean } {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Grid progression projection RPC returned an invalid result');
  }
  return { applied: Boolean((data as { applied?: unknown }).applied) };
}

export function createSupabaseGridProgressionRebuildPorts(
  client: SupabaseClient | null = supabaseAdmin,
): {
  read: GridProgressionEventReadPort;
  write: GridProgressionProjectionWritePort;
} {
  if (!client) {
    throw new Error('Grid progression rebuild requires Supabase service-role configuration');
  }

  return {
    read: {
      getSeasonPlayerEvents(seasonId, playerId) {
        return readActorEvents(client, playerId, seasonId);
      },
      getLifetimePlayerEvents(playerId) {
        return readActorEvents(client, playerId);
      },
    },
    write: {
      async replaceSeasonProjection(projection) {
        const { data, error } = await client.rpc(
          'grid_replace_season_progression_projection',
          seasonRpcArgs(projection),
        );
        if (error) {
          throw new Error(
            `Failed to replace Grid season progression projection: ${error.message}`,
          );
        }
        return appliedResult(data);
      },
      async replaceLifetimeProjection(projection) {
        const { data, error } = await client.rpc(
          'grid_replace_lifetime_progression_projection',
          lifetimeRpcArgs(projection),
        );
        if (error) {
          throw new Error(
            `Failed to replace Grid lifetime progression projection: ${error.message}`,
          );
        }
        return appliedResult(data);
      },
    },
  };
}

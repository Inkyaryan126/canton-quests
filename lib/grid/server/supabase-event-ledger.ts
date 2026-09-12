import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../supabase';
import type {
  GridEventInput,
  GridGameEvent,
} from './event-ledger';
import type {
  GridEventLedgerPort,
  GridEventLedgerInsertResult,
} from './event-ledger-port';

interface DatabaseGridGameEventRow {
  id: string;
  city_id: string;
  season_id: string | null;
  actor_player_id: string | null;
  event_type: string;
  entity_type: string | null;
  entity_id: string | null;
  payload: Record<string, any> | null;
  idempotency_key: string | null;
  correlation_id: string | null;
  causation_id: string | null;
  created_at: string;
}

function mapEvent(row: DatabaseGridGameEventRow): GridGameEvent {
  return {
    id: row.id,
    cityId: row.city_id,
    seasonId: row.season_id,
    actorPlayerId: row.actor_player_id,
    eventType: row.event_type,
    entityType: row.entity_type,
    entityId: row.entity_id,
    payload: (row.payload as any) || {},
    idempotencyKey: row.idempotency_key,
    correlationId: row.correlation_id,
    causationId: row.causation_id,
    createdAt: row.created_at,
  };
}

export function createSupabaseGridEventLedgerPort(
  client: SupabaseClient | null = supabaseAdmin
): GridEventLedgerPort {
  if (!client) {
    throw new Error('Grid event ledger requires Supabase service-role configuration');
  }

  return {
    async insert(input: GridEventInput): Promise<GridEventLedgerInsertResult> {
      const { data, error } = await client
        .from('grid_game_events')
        .insert({
          city_id: input.cityId,
          season_id: input.seasonId,
          actor_player_id: input.actorPlayerId ?? null,
          event_type: input.eventType,
          entity_type: input.entityType ?? null,
          entity_id: input.entityId ?? null,
          payload: input.payload ?? {},
          idempotency_key: input.idempotencyKey ?? null,
          correlation_id: input.correlationId ?? null,
          causation_id: input.causationId ?? null,
        })
        .select()
        .single();

      if (error?.code === '23505') {
        return { event: null, duplicate: true };
      }

      if (error || !data) {
        throw new Error(`Failed to append Grid event: ${error?.message || 'unknown error'}`);
      }

      return { event: mapEvent(data as DatabaseGridGameEventRow), duplicate: false };
    },

    async getByIdempotencyKey(
      seasonId: string | null,
      idempotencyKey: string
    ): Promise<GridGameEvent | null> {
      let query = client
        .from('grid_game_events')
        .select('*')
        .eq('idempotency_key', idempotencyKey);

      query =
        seasonId === null
          ? query.is('season_id', null)
          : query.eq('season_id', seasonId);

      const { data, error } = await query.maybeSingle();

      if (error) {
        throw new Error(`Failed to reconcile Grid event: ${error.message}`);
      }

      return data ? mapEvent(data as DatabaseGridGameEventRow) : null;
    },
  };
}

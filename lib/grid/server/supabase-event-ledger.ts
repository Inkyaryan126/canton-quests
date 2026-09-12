// Supabase adapter for the Grid event-ledger port. Writes go through the
// server-side admin client only — grid_game_events revokes INSERT/UPDATE/
// DELETE from anon/authenticated (see the grid_foundation migration), so
// there is no browser mutation path here, and this module must never import
// the anon `supabase` client for writes.

import { supabaseAdmin, isSupabaseAdminConfigured } from '../../supabase';
import {
  GridEventIdempotencyConflictError,
  type GridEventAppendInput,
  type GridEventLedgerPort,
  type GridLedgerEvent,
} from './event-ledger-port';

const TABLE = 'grid_game_events';
const IDEMPOTENCY_UNIQUE_VIOLATION = '23505';

interface GridGameEventRow {
  id: string;
  city_id: string;
  season_id: string | null;
  actor_player_id: string | null;
  event_type: string;
  entity_type: string | null;
  entity_id: string | null;
  payload: Record<string, unknown>;
  idempotency_key: string | null;
  correlation_id: string | null;
  causation_id: string | null;
  created_at: string;
}

function requireAdminClient(): NonNullable<typeof supabaseAdmin> {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    throw new Error(
      'Grid event ledger requires the server-side Supabase admin client; none is configured for this environment'
    );
  }
  return supabaseAdmin;
}

function toRow(input: GridEventAppendInput) {
  return {
    city_id: input.cityId,
    season_id: input.seasonId ?? null,
    actor_player_id: input.actorPlayerId ?? null,
    event_type: input.eventType,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    payload: input.payload ?? {},
    idempotency_key: input.idempotencyKey ?? null,
    correlation_id: input.correlationId ?? null,
    causation_id: input.causationId ?? null,
  };
}

function fromRow(row: GridGameEventRow): GridLedgerEvent {
  return {
    id: row.id,
    cityId: row.city_id,
    seasonId: row.season_id,
    actorPlayerId: row.actor_player_id,
    eventType: row.event_type,
    entityType: row.entity_type,
    entityId: row.entity_id,
    payload: row.payload ?? {},
    idempotencyKey: row.idempotency_key,
    correlationId: row.correlation_id,
    causationId: row.causation_id,
    createdAt: row.created_at,
  };
}

export function createSupabaseGridEventLedger(): GridEventLedgerPort {
  return {
    async insertEvent(input: GridEventAppendInput): Promise<GridLedgerEvent> {
      const admin = requireAdminClient();

      const { data, error } = await admin
        .from(TABLE)
        .insert(toRow(input))
        .select()
        .single();

      if (error) {
        if (
          error.code === IDEMPOTENCY_UNIQUE_VIOLATION &&
          input.idempotencyKey &&
          input.seasonId
        ) {
          throw new GridEventIdempotencyConflictError(
            input.seasonId,
            input.idempotencyKey
          );
        }
        throw new Error(`Failed to append Grid event: ${error.message}`);
      }

      return fromRow(data as GridGameEventRow);
    },

    async findByIdempotencyKey(
      seasonId: string,
      idempotencyKey: string
    ): Promise<GridLedgerEvent | null> {
      const admin = requireAdminClient();

      const { data, error } = await admin
        .from(TABLE)
        .select('*')
        .eq('season_id', seasonId)
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();

      if (error) {
        throw new Error(
          `Failed to look up Grid event by idempotency key: ${error.message}`
        );
      }

      return data ? fromRow(data as GridGameEventRow) : null;
    },
  };
}

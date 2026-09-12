// Grid event-ledger port — the domain-facing contract for the append-only
// grid_game_events history. Adapters (e.g. Supabase) implement this
// interface; domain logic (event-ledger.ts) only ever depends on it, never
// on a specific storage technology.

export interface GridLedgerEvent {
  id: string;
  cityId: string;
  seasonId: string | null;
  actorPlayerId: string | null;
  eventType: string;
  entityType: string | null;
  entityId: string | null;
  payload: Record<string, unknown>;
  idempotencyKey: string | null;
  correlationId: string | null;
  causationId: string | null;
  createdAt: string;
}

export interface GridEventAppendInput {
  cityId: string;
  seasonId?: string | null;
  actorPlayerId?: string | null;
  eventType: string;
  entityType?: string | null;
  entityId?: string | null;
  payload?: Record<string, unknown>;
  idempotencyKey?: string | null;
  correlationId?: string | null;
  causationId?: string | null;
}

/**
 * Thrown by a port implementation when an insert collides with the
 * (season_id, idempotency_key) uniqueness guarantee. This is not itself a
 * failure — the domain service catches it and reconciles against the event
 * already on record.
 */
export class GridEventIdempotencyConflictError extends Error {
  readonly seasonId: string;
  readonly idempotencyKey: string;

  constructor(seasonId: string, idempotencyKey: string) {
    super(
      `Grid event idempotency collision for season ${seasonId} key ${idempotencyKey}`
    );
    this.name = 'GridEventIdempotencyConflictError';
    this.seasonId = seasonId;
    this.idempotencyKey = idempotencyKey;
  }
}

export interface GridEventLedgerPort {
  /**
   * Persists a new event. Must throw GridEventIdempotencyConflictError
   * (rather than a generic error) when the only reason the write failed is
   * an existing (seasonId, idempotencyKey) row.
   */
  insertEvent(input: GridEventAppendInput): Promise<GridLedgerEvent>;

  /** Looks up the event already on record for a given idempotency key. */
  findByIdempotencyKey(
    seasonId: string,
    idempotencyKey: string
  ): Promise<GridLedgerEvent | null>;
}

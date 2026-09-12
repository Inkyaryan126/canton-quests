// Grid event-ledger domain service — the single place that decides what an
// idempotent append means. Storage concerns live behind GridEventLedgerPort;
// this file only ever talks to that interface.

import {
  GridEventIdempotencyConflictError,
  type GridEventAppendInput,
  type GridEventLedgerPort,
  type GridLedgerEvent,
} from './event-ledger-port';

export interface GridEventAppendResult {
  event: GridLedgerEvent;
  /** true when this call reconciled with a pre-existing event instead of inserting a new one */
  idempotent: boolean;
}

/**
 * Raised when an idempotency key collides with an existing event whose
 * recorded fields disagree with the request. This is never silently
 * resolved — the caller sent the same key for what is, in substance, a
 * different event, so the ledger must fail loudly instead of guessing.
 */
export class GridEventReconciliationError extends Error {
  readonly seasonId: string;
  readonly idempotencyKey: string;
  readonly existing: GridLedgerEvent;

  constructor(input: GridEventAppendInput, existing: GridLedgerEvent) {
    super(
      `Grid event idempotency key ${input.idempotencyKey} for season ${input.seasonId} ` +
        `is already recorded against a different event (existing id ${existing.id}); refusing to reconcile`
    );
    this.name = 'GridEventReconciliationError';
    this.seasonId = String(input.seasonId);
    this.idempotencyKey = String(input.idempotencyKey);
    this.existing = existing;
  }
}

function normalize(input: GridEventAppendInput): Required<
  Pick<
    GridEventAppendInput,
    | 'seasonId'
    | 'actorPlayerId'
    | 'entityType'
    | 'entityId'
    | 'idempotencyKey'
    | 'correlationId'
    | 'causationId'
  >
> & { payload: Record<string, unknown> } {
  return {
    seasonId: input.seasonId ?? null,
    actorPlayerId: input.actorPlayerId ?? null,
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    idempotencyKey: input.idempotencyKey ?? null,
    correlationId: input.correlationId ?? null,
    causationId: input.causationId ?? null,
    payload: input.payload ?? {},
  };
}

function eventMatchesAppendInput(
  existing: GridLedgerEvent,
  input: GridEventAppendInput
): boolean {
  const normalized = normalize(input);

  return (
    existing.cityId === input.cityId &&
    existing.seasonId === normalized.seasonId &&
    existing.actorPlayerId === normalized.actorPlayerId &&
    existing.eventType === input.eventType &&
    existing.entityType === normalized.entityType &&
    existing.entityId === normalized.entityId &&
    existing.correlationId === normalized.correlationId &&
    existing.causationId === normalized.causationId &&
    JSON.stringify(existing.payload) === JSON.stringify(normalized.payload)
  );
}

/**
 * Appends a Grid game event through the given port, reconciling idempotency
 * collisions instead of letting them bubble up as raw storage errors.
 */
export async function appendGridEvent(
  port: GridEventLedgerPort,
  input: GridEventAppendInput
): Promise<GridEventAppendResult> {
  if (input.idempotencyKey && !input.seasonId) {
    throw new Error(
      'Grid event append with an idempotencyKey requires a seasonId — idempotency is only enforced within a season'
    );
  }

  try {
    const event = await port.insertEvent(input);
    return { event, idempotent: false };
  } catch (error) {
    if (!(error instanceof GridEventIdempotencyConflictError)) throw error;

    const existing = await port.findByIdempotencyKey(
      error.seasonId,
      error.idempotencyKey
    );

    if (!existing) {
      throw new Error(
        `Grid event ledger reported an idempotency collision for season ${error.seasonId} ` +
          `key ${error.idempotencyKey}, but no existing event could be found to reconcile against`
      );
    }

    if (!eventMatchesAppendInput(existing, input)) {
      throw new GridEventReconciliationError(input, existing);
    }

    return { event: existing, idempotent: true };
  }
}

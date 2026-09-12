import type { GridEventLedgerPort } from './event-ledger-port';

export type GridJson =
  | null
  | boolean
  | number
  | string
  | GridJson[]
  | { [key: string]: GridJson };

export interface GridEventInput {
  cityId: string;
  seasonId: string | null;
  actorPlayerId?: string | null;
  eventType: string;
  entityType?: string | null;
  entityId?: string | null;
  payload?: { [key: string]: GridJson };
  idempotencyKey?: string | null;
  correlationId?: string | null;
  causationId?: string | null;
}

export interface GridGameEvent extends GridEventInput {
  id: string;
  actorPlayerId: string | null;
  entityType: string | null;
  entityId: string | null;
  payload: { [key: string]: GridJson };
  idempotencyKey: string | null;
  correlationId: string | null;
  causationId: string | null;
  createdAt: string;
}

export async function appendGridEvent(
  port: GridEventLedgerPort,
  input: GridEventInput
): Promise<GridGameEvent> {
  const result = await port.insert(input);

  if (result.event) return result.event;

  if (result.duplicate && input.idempotencyKey) {
    const existing = await port.getByIdempotencyKey(
      input.seasonId,
      input.idempotencyKey
    );

    if (existing) return existing;
    throw new Error('Grid idempotency collision could not be reconciled');
  }

  throw new Error('Grid event insert failed without a persisted event');
}

import type {
  GridEventInput,
  GridGameEvent,
} from './event-ledger';

export interface GridEventLedgerInsertResult {
  event: GridGameEvent | null;
  duplicate: boolean;
}

export interface GridEventLedgerPort {
  insert(input: GridEventInput): Promise<GridEventLedgerInsertResult>;
  getByIdempotencyKey(
    seasonId: string | null,
    idempotencyKey: string
  ): Promise<GridGameEvent | null>;
}

import type { GridContractProgressPort } from './contract-port';

/**
 * Server-only persistence boundary for the Contract service.
 *
 * Implementations must keep the compare-and-swap transition, replay record,
 * and reward outbox writes in one database transaction.  Reward values and
 * the next state are intentionally not accepted from callers of the RPC
 * adapter; they are derived from the server-side contract definition.
 */
export interface GridContractPersistencePort extends GridContractProgressPort {}

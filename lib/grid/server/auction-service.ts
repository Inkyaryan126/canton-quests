import type {
  GridAuctionCommandPort,
  GridAuctionCommandResult,
  GridAuctionBidResult,
  GridAuctionSettlementResult,
  GridPlaceAuctionBidCommand,
  GridScheduleAuctionCommand,
  GridSettleAuctionCommand,
} from './auction-port';

function requireNonBlank(value: string, label: string): void {
  if (!value.trim()) {
    throw new Error(`Grid auction requires ${label}`);
  }
}

function requireTimestamp(value: string, label: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Grid auction requires valid ${label}`);
  }
  return parsed;
}

function requireNonNegativeSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Grid auction requires non-negative safe integer ${label}`);
  }
}

function requirePositiveSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`Grid auction requires positive safe integer ${label}`);
  }
}

function validateBaseCommand(
  command: { idempotencyKey: string; now: string },
): void {
  requireNonBlank(command.idempotencyKey, 'a non-empty idempotency key');
  requireTimestamp(command.now, 'now timestamp');
}

export async function scheduleGridAuction(
  port: GridAuctionCommandPort,
  command: GridScheduleAuctionCommand,
): Promise<GridAuctionCommandResult> {
  requireNonBlank(command.seasonId, 'seasonId');
  requireNonBlank(command.propertyId, 'propertyId');
  validateBaseCommand(command);

  requireNonNegativeSafeInteger(command.reserveCredits, 'reserveCredits');
  requirePositiveSafeInteger(
    command.minimumBidIncrementCredits,
    'minimumBidIncrementCredits',
  );

  const startsAt = requireTimestamp(command.startsAt, 'startsAt');
  const endsAt = requireTimestamp(command.endsAt, 'endsAt');
  if (endsAt <= startsAt) {
    throw new Error('Grid auction requires endsAt after startsAt');
  }

  return port.scheduleAuction(command);
}

export async function placeGridAuctionBid(
  port: GridAuctionCommandPort,
  command: GridPlaceAuctionBidCommand,
): Promise<GridAuctionBidResult> {
  requireNonBlank(command.auctionId, 'auctionId');
  requireNonBlank(command.bidderPlayerId, 'bidderPlayerId');
  validateBaseCommand(command);
  requireNonNegativeSafeInteger(command.amountCredits, 'amountCredits');

  return port.placeBid(command);
}

export async function settleGridAuctionCommand(
  port: GridAuctionCommandPort,
  command: GridSettleAuctionCommand,
): Promise<GridAuctionSettlementResult> {
  requireNonBlank(command.auctionId, 'auctionId');
  validateBaseCommand(command);

  return port.settleAuction(command);
}

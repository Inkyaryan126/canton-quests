import type {
  GridFixedPriceTradeInput,
  GridFixedPriceTradeSettlement,
  GridMarketConfig,
  GridMarketTaxQuote,
} from './market-types';

const BASIS_POINTS = 10_000;

function requireText(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required`);
  return normalized;
}

function requireSafeInteger(value: number, label: string, minimum = 0): number {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${label} must be a safe integer >= ${minimum}`);
  }
  return value;
}

function addSafe(left: number, right: number, label: string): number {
  const total = left + right;
  if (!Number.isSafeInteger(total)) {
    throw new Error(`${label} exceeds JavaScript safe integer range`);
  }
  return total;
}

export function validateGridMarketConfig(config: GridMarketConfig): void {
  requireSafeInteger(config.transactionTaxBps, 'Grid Market transactionTaxBps');
  if (config.transactionTaxBps > BASIS_POINTS) {
    throw new Error(`Grid Market transactionTaxBps must be <= ${BASIS_POINTS}`);
  }
  requireSafeInteger(
    config.postCaptureTradeCooldownSeconds,
    'Grid Market postCaptureTradeCooldownSeconds',
  );
}

export function quoteGridMarketTax(
  grossCredits: number,
  config: GridMarketConfig,
): GridMarketTaxQuote {
  validateGridMarketConfig(config);
  requireSafeInteger(grossCredits, 'Grid Market gross Credits', 1);

  const taxBig =
    (BigInt(grossCredits) * BigInt(config.transactionTaxBps)) /
    BigInt(BASIS_POINTS);
  const taxCredits = Number(taxBig);
  if (!Number.isSafeInteger(taxCredits)) {
    throw new Error('Grid Market tax exceeds JavaScript safe integer range');
  }

  return {
    grossCredits,
    taxCredits,
    sellerNetCredits: grossCredits - taxCredits,
  };
}

export function settleGridFixedPriceTrade(
  input: GridFixedPriceTradeInput,
  config: GridMarketConfig,
): GridFixedPriceTradeSettlement {
  validateGridMarketConfig(config);
  const sellerPlayerId = requireText(input.sellerPlayerId, 'Grid Market sellerPlayerId');
  const buyerPlayerId = requireText(input.buyerPlayerId, 'Grid Market buyerPlayerId');
  if (sellerPlayerId === buyerPlayerId) {
    throw new Error('Grid Market buyer and seller must be different players');
  }

  requireSafeInteger(input.sellerCredits, 'Grid Market seller Credits');
  requireSafeInteger(input.buyerCredits, 'Grid Market buyer Credits');
  requireSafeInteger(input.priceCredits, 'Grid Market price Credits', 1);
  requireSafeInteger(input.item.acquiredAtMs, 'Grid Market item acquiredAtMs');
  requireSafeInteger(input.nowMs, 'Grid Market nowMs');
  requireText(input.item.itemId, 'Grid Market itemId');
  requireText(input.item.ownerPlayerId, 'Grid Market item ownerPlayerId');

  if (input.item.ownerPlayerId !== sellerPlayerId) {
    throw new Error('Grid Market seller does not own the trade item');
  }
  if (!input.item.tradable) {
    throw new Error('Grid Market item is not eligible for trade');
  }
  if (input.item.majorLandmark) {
    throw new Error('Grid Market major landmarks cannot be freely traded');
  }
  if (input.nowMs < input.item.acquiredAtMs) {
    throw new Error('Grid Market time cannot move backward');
  }

  const cooldownMs = config.postCaptureTradeCooldownSeconds * 1000;
  if (input.nowMs - input.item.acquiredAtMs < cooldownMs) {
    throw new Error('Grid Market post-capture trade cooldown is still active');
  }
  if (input.buyerCredits < input.priceCredits) {
    throw new Error('Grid Market buyer does not have enough Credits');
  }

  const quote = quoteGridMarketTax(input.priceCredits, config);
  return {
    ...quote,
    sellerCreditsAfter: addSafe(
      input.sellerCredits,
      quote.sellerNetCredits,
      'Grid Market seller Credits',
    ),
    buyerCreditsAfter: input.buyerCredits - input.priceCredits,
    itemOwnerPlayerIdAfter: buyerPlayerId,
  };
}

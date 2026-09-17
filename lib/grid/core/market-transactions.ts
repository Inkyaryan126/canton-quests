import type { GridTradeIntegrityTransaction } from './trade-integrity-types';
import type {
  BuildGridMarketTransactionFromDirectDealInput,
  BuildGridMarketTransactionFromFixedPricePurchaseInput,
  GridMarketTransactionAssetTransfer,
  GridMarketTransactionCreditTransfer,
  GridMarketTransactionFacts,
  GridMarketTransactionRecord,
  GridMarketTransactionTaxCharge,
} from './market-transaction-types';

function requireId(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`Grid market transaction requires ${label}`);
  return trimmed;
}

function requireSafeNonNegative(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
  return value;
}

function requireSafePositive(value: number, label: string): number {
  requireSafeNonNegative(value, label);
  if (value === 0) throw new Error(`${label} must be positive`);
  return value;
}

function checkedAdd(left: number, right: number, label: string): number {
  const result = left + right;
  if (!Number.isSafeInteger(result)) throw new Error(`${label} exceeds safe integer range`);
  return result;
}

function requireTimestamp(value: string, label: string): string {
  if (!Number.isFinite(Date.parse(value))) throw new Error(`${label} must be a valid timestamp`);
  return value;
}

function canonicalParticipants(left: string, right: string): [string, string] {
  const a = requireId(left, 'participant');
  const b = requireId(right, 'participant');
  if (a === b) throw new Error('Grid market transaction requires two distinct participants');
  return a.localeCompare(b) <= 0 ? [a, b] : [b, a];
}

function aggregateCreditTransfers(
  transfers: readonly GridMarketTransactionCreditTransfer[],
): GridMarketTransactionCreditTransfer[] {
  const sums = new Map<string, GridMarketTransactionCreditTransfer>();
  for (const transfer of transfers) {
    requireId(transfer.fromPlayerId, 'credit transfer fromPlayerId');
    requireId(transfer.toPlayerId, 'credit transfer toPlayerId');
    if (transfer.fromPlayerId === transfer.toPlayerId) throw new Error('Credit transfer cannot be self-directed');
    const amountCredits = requireSafePositive(transfer.amountCredits, 'credit transfer amountCredits');
    const key = `${transfer.fromPlayerId}\u0000${transfer.toPlayerId}`;
    const existing = sums.get(key);
    sums.set(key, existing ? { ...existing, amountCredits: checkedAdd(existing.amountCredits, amountCredits, 'credit transfer total') } : { ...transfer, amountCredits });
  }
  return [...sums.values()].sort((a, b) => a.fromPlayerId.localeCompare(b.fromPlayerId) || a.toPlayerId.localeCompare(b.toPlayerId));
}

function aggregateTaxCharges(charges: readonly GridMarketTransactionTaxCharge[]): GridMarketTransactionTaxCharge[] {
  const sums = new Map<string, number>();
  for (const charge of charges) {
    const playerId = requireId(charge.playerId, 'tax charge playerId');
    const amountCredits = requireSafePositive(charge.amountCredits, 'tax charge amountCredits');
    sums.set(playerId, checkedAdd(sums.get(playerId) ?? 0, amountCredits, 'tax charge total'));
  }
  return [...sums].sort(([a], [b]) => a.localeCompare(b)).map(([playerId, amountCredits]) => ({ playerId, amountCredits }));
}

function validateDirectDealCreditDeltas(
  participantIds: readonly [string, string],
  creditTransfers: readonly GridMarketTransactionCreditTransfer[],
  taxCharges: readonly GridMarketTransactionTaxCharge[],
  playerCreditDeltas: Record<string, number>,
): void {
  const expected: Record<string, number> = {
    [participantIds[0]]: 0,
    [participantIds[1]]: 0,
  };
  for (const transfer of creditTransfers) {
    if (!(transfer.fromPlayerId in expected) || !(transfer.toPlayerId in expected)) {
      throw new Error('Direct deal transfer references a non-participant');
    }
    expected[transfer.fromPlayerId] = checkedAdd(expected[transfer.fromPlayerId], -transfer.amountCredits, 'direct deal sender credit delta');
    expected[transfer.toPlayerId] = checkedAdd(expected[transfer.toPlayerId], transfer.amountCredits, 'direct deal receiver credit delta');
  }
  for (const charge of taxCharges) {
    if (!(charge.playerId in expected)) throw new Error('Direct deal tax references a non-participant');
    expected[charge.playerId] = checkedAdd(expected[charge.playerId], -charge.amountCredits, 'direct deal tax credit delta');
  }
  for (const playerId of participantIds) {
    const actual = playerCreditDeltas[playerId];
    if (!Number.isSafeInteger(actual) || actual !== expected[playerId]) {
      throw new Error('Direct deal player credit deltas do not match transfers and taxes');
    }
  }
}

function deriveFacts(
  creditTransfers: readonly GridMarketTransactionCreditTransfer[],
  assetTransfers: readonly GridMarketTransactionAssetTransfer[],
  taxCharges: readonly GridMarketTransactionTaxCharge[],
): GridMarketTransactionFacts {
  const grossCreditsTransferred = creditTransfers.reduce((sum, transfer) => checkedAdd(sum, transfer.amountCredits, 'grossCreditsTransferred'), 0);
  const grossEstimatedAssetValue = assetTransfers.reduce((sum, transfer) => checkedAdd(sum, transfer.estimatedValueCredits, 'grossEstimatedAssetValue'), 0);
  const totalTaxCredits = taxCharges.reduce((sum, charge) => checkedAdd(sum, charge.amountCredits, 'totalTaxCredits'), 0);
  const directions = new Set(creditTransfers.map(({ fromPlayerId, toPlayerId }) => `${fromPlayerId}\u0000${toPlayerId}`));
  const reciprocalCreditFlow = [...directions].some((key) => {
    const [from, to] = key.split('\u0000');
    return directions.has(`${to}\u0000${from}`);
  });
  return {
    grossCreditsTransferred,
    grossEstimatedAssetValue,
    grossEstimatedValue: checkedAdd(grossCreditsTransferred, grossEstimatedAssetValue, 'grossEstimatedValue'),
    totalTaxCredits,
    propertyTransfers: assetTransfers.filter(({ kind }) => kind === 'property').length,
    otherAssetTransfers: assetTransfers.filter(({ kind }) => kind === 'asset').length,
    zeroCreditTransaction: grossCreditsTransferred === 0,
    reciprocalCreditFlow,
  };
}

export function validateGridMarketTransactionRecord(record: GridMarketTransactionRecord): void {
  requireId(record.transactionId, 'transactionId');
  requireId(record.sourceId, 'sourceId');
  requireId(record.cityId, 'cityId');
  requireTimestamp(record.occurredAt, 'occurredAt');
  if (record.version !== 1) throw new Error('Unsupported Grid market transaction version');
  if (record.source !== 'direct-deal' && record.source !== 'fixed-price') throw new Error('Unsupported Grid market transaction source');
  if (!Array.isArray(record.participantIds) || record.participantIds.length !== 2) throw new Error('Grid market transaction requires exactly two participants');
  const canonical = canonicalParticipants(record.participantIds[0], record.participantIds[1]);
  if (record.participantIds[0] !== canonical[0] || record.participantIds[1] !== canonical[1]) throw new Error('Grid market transaction participants must be canonically ordered');
  const participants = new Set(record.participantIds);
  const seenAssets = new Set<string>();
  for (const transfer of record.creditTransfers) {
    if (!participants.has(transfer.fromPlayerId) || !participants.has(transfer.toPlayerId)) throw new Error('Credit transfer references a non-participant');
    requireSafePositive(transfer.amountCredits, 'credit transfer amountCredits');
    if (transfer.fromPlayerId === transfer.toPlayerId) throw new Error('Credit transfer cannot be self-directed');
  }
  for (const transfer of record.assetTransfers) {
    requireId(transfer.assetId, 'assetId');
    if (seenAssets.has(transfer.assetId)) throw new Error(`Duplicate Grid market transaction assetId: ${transfer.assetId}`);
    seenAssets.add(transfer.assetId);
    if (!participants.has(transfer.fromPlayerId) || !participants.has(transfer.toPlayerId)) throw new Error('Asset transfer references a non-participant');
    if (transfer.fromPlayerId === transfer.toPlayerId) throw new Error('Asset transfer cannot be self-directed');
    if (transfer.kind !== 'property' && transfer.kind !== 'asset') throw new Error('Unsupported Grid market transaction asset kind');
    requireSafeNonNegative(transfer.estimatedValueCredits, 'asset estimatedValueCredits');
  }
  for (const charge of record.taxCharges) {
    if (!participants.has(charge.playerId)) throw new Error('Tax charge references a non-participant');
    requireSafePositive(charge.amountCredits, 'tax charge amountCredits');
  }
  if (record.creditTransfers.length === 0 && record.assetTransfers.length === 0) throw new Error('Grid market transaction must contain value movement');
  const expectedFacts = deriveFacts(record.creditTransfers, record.assetTransfers, record.taxCharges);
  for (const key of Object.keys(expectedFacts) as Array<keyof GridMarketTransactionFacts>) {
    if (record.facts[key] !== expectedFacts[key]) {
      throw new Error('Grid market transaction facts do not match transfer contents');
    }
  }
}

export function buildGridMarketTransactionFromDirectDeal(input: BuildGridMarketTransactionFromDirectDealInput): GridMarketTransactionRecord {
  if (!input.plan.settleable) throw new Error('Direct deal must be settleable before transaction logging');
  const playerIds = Object.keys(input.plan.playerCreditDeltas).sort();
  if (playerIds.length !== 2) throw new Error('Direct deal transaction logging requires exactly two players');
  const participantIds = canonicalParticipants(playerIds[0], playerIds[1]);
  const creditTransfers = aggregateCreditTransfers(input.plan.creditTransfers);
  const taxCharges = aggregateTaxCharges(input.plan.taxCharges);
  validateDirectDealCreditDeltas(participantIds, creditTransfers, taxCharges, input.plan.playerCreditDeltas);
  const expectedAssetIds = new Set(input.plan.assetTransfers.map(({ assetId }) => assetId));
  for (const assetId of Object.keys(input.estimatedAssetValueCreditsById)) {
    if (!expectedAssetIds.has(assetId)) throw new Error(`Unexpected estimated asset value for ${assetId}`);
  }
  const seen = new Set<string>();
  const assetTransfers = input.plan.assetTransfers.map((transfer): GridMarketTransactionAssetTransfer => {
    const assetId = requireId(transfer.assetId, 'assetId');
    if (seen.has(assetId)) throw new Error(`Duplicate direct-deal asset transfer: ${assetId}`);
    seen.add(assetId);
    if (!(assetId in input.estimatedAssetValueCreditsById)) throw new Error(`Missing estimated asset value for ${assetId}`);
    return { ...transfer, assetId, estimatedValueCredits: requireSafeNonNegative(input.estimatedAssetValueCreditsById[assetId], `estimated asset value for ${assetId}`) };
  }).sort((a, b) => a.assetId.localeCompare(b.assetId));
  const record: GridMarketTransactionRecord = {
    version: 1,
    transactionId: requireId(input.transactionId, 'transactionId'),
    source: 'direct-deal',
    sourceId: requireId(input.sourceId, 'sourceId'),
    cityId: requireId(input.plan.cityId, 'cityId'),
    occurredAt: requireTimestamp(input.plan.settledAt, 'settledAt'),
    participantIds,
    creditTransfers,
    assetTransfers,
    taxCharges,
    facts: deriveFacts(creditTransfers, assetTransfers, taxCharges),
  };
  validateGridMarketTransactionRecord(record);
  if (record.facts.grossCreditsTransferred !== input.plan.audit.grossCreditsTransferred || record.facts.totalTaxCredits !== input.plan.audit.totalTaxCredits || record.facts.propertyTransfers !== input.plan.audit.propertyTransfers || record.facts.otherAssetTransfers !== input.plan.audit.otherAssetTransfers || record.facts.zeroCreditTransaction !== input.plan.audit.zeroCreditDeal || record.facts.reciprocalCreditFlow !== input.plan.audit.reciprocalCreditFlow) {
    throw new Error('Direct deal audit facts do not match normalized transaction');
  }
  return record;
}

export function buildGridMarketTransactionFromFixedPricePurchase(input: BuildGridMarketTransactionFromFixedPricePurchaseInput): GridMarketTransactionRecord {
  if (!input.plan.purchasable) throw new Error('Fixed-price purchase must be purchasable before transaction logging');
  if (!input.plan.assetTransfer) throw new Error('Fixed-price purchase transaction requires an asset transfer');
  const expectedBuyerDebit = checkedAdd(
    requireSafePositive(input.plan.priceCredits, 'fixed-price purchase priceCredits'),
    requireSafeNonNegative(input.plan.taxCredits, 'fixed-price purchase taxCredits'),
    'fixed-price purchase total debit',
  );
  if (
    input.plan.buyerTotalDebitCredits !== expectedBuyerDebit ||
    input.plan.buyerCreditDelta !== -expectedBuyerDebit ||
    input.plan.sellerCreditDelta !== input.plan.priceCredits
  ) {
    throw new Error('Fixed-price purchase plan credit math is inconsistent');
  }
  if (
    input.plan.nextListing.listingId !== input.plan.listingId ||
    input.plan.nextListing.cityId !== input.cityId ||
    input.plan.nextListing.sellerPlayerId !== input.plan.sellerPlayerId ||
    input.plan.nextListing.assetId !== input.plan.assetTransfer.assetId ||
    input.plan.nextListing.assetKind !== input.plan.assetTransfer.kind ||
    input.plan.nextListing.priceCredits !== input.plan.priceCredits ||
    input.plan.nextListing.status !== 'sold' ||
    input.plan.nextListing.buyerPlayerId !== input.plan.buyerPlayerId ||
    input.plan.nextListing.soldAt !== input.plan.purchasedAt ||
    input.plan.assetTransfer.fromPlayerId !== input.plan.sellerPlayerId ||
    input.plan.assetTransfer.toPlayerId !== input.plan.buyerPlayerId
  ) {
    throw new Error('Fixed-price purchase plan state is inconsistent');
  }
  const participantIds = canonicalParticipants(input.plan.buyerPlayerId, input.plan.sellerPlayerId);
  const creditTransfers = aggregateCreditTransfers([{ fromPlayerId: input.plan.buyerPlayerId, toPlayerId: input.plan.sellerPlayerId, amountCredits: input.plan.priceCredits }]);
  const taxCharges = input.plan.taxCredits > 0 ? aggregateTaxCharges([{ playerId: input.plan.buyerPlayerId, amountCredits: input.plan.taxCredits }]) : [];
  const assetTransfers: GridMarketTransactionAssetTransfer[] = [{ ...input.plan.assetTransfer, estimatedValueCredits: requireSafeNonNegative(input.estimatedAssetValueCredits, 'estimatedAssetValueCredits') }];
  const record: GridMarketTransactionRecord = {
    version: 1,
    transactionId: requireId(input.transactionId, 'transactionId'),
    source: 'fixed-price',
    sourceId: requireId(input.plan.listingId, 'listingId'),
    cityId: requireId(input.cityId, 'cityId'),
    occurredAt: requireTimestamp(input.plan.purchasedAt, 'purchasedAt'),
    participantIds,
    creditTransfers,
    assetTransfers,
    taxCharges,
    facts: deriveFacts(creditTransfers, assetTransfers, taxCharges),
  };
  validateGridMarketTransactionRecord(record);
  return record;
}

export function toGridTradeIntegrityTransaction(record: GridMarketTransactionRecord): GridTradeIntegrityTransaction {
  validateGridMarketTransactionRecord(record);
  const [participantAId, participantBId] = record.participantIds;
  let creditsToA = 0;
  let creditsToB = 0;
  let estimatedAssetValueToA = 0;
  let estimatedAssetValueToB = 0;
  for (const transfer of record.creditTransfers) {
    if (transfer.toPlayerId === participantAId) creditsToA = checkedAdd(creditsToA, transfer.amountCredits, 'creditsToA');
    else creditsToB = checkedAdd(creditsToB, transfer.amountCredits, 'creditsToB');
  }
  for (const transfer of record.assetTransfers) {
    if (transfer.toPlayerId === participantAId) estimatedAssetValueToA = checkedAdd(estimatedAssetValueToA, transfer.estimatedValueCredits, 'estimatedAssetValueToA');
    else estimatedAssetValueToB = checkedAdd(estimatedAssetValueToB, transfer.estimatedValueCredits, 'estimatedAssetValueToB');
  }
  return {
    transactionId: record.transactionId,
    cityId: record.cityId,
    occurredAt: record.occurredAt,
    participantAId,
    participantBId,
    creditsToA,
    creditsToB,
    estimatedAssetValueToA,
    estimatedAssetValueToB,
    assetTransfers: record.assetTransfers.length,
    taxCredits: record.facts.totalTaxCredits,
  };
}

import type {
  GridDirectDealAssetSnapshot,
  GridDirectDealAssetTransfer,
  GridDirectDealAuditFacts,
  GridDirectDealProposal,
  GridDirectDealRejectionReason,
  GridDirectDealRules,
  GridDirectDealSettlementPlan,
  GridDirectDealSide,
} from './direct-deal-types';

const BASIS_POINTS = 10_000;

function requireNonNegativeSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
}

function requirePositiveSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive safe integer`);
  }
}

function parseTimestamp(value: string, label: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} must be a valid timestamp`);
  }
  return parsed;
}

function checkedAdd(left: number, right: number, label: string): number {
  const result = left + right;
  if (!Number.isSafeInteger(result)) {
    throw new Error(`${label} exceeds safe integer range`);
  }
  return result;
}

function checkedSubtract(left: number, right: number, label: string): number {
  const result = left - right;
  if (!Number.isSafeInteger(result)) {
    throw new Error(`${label} exceeds safe integer range`);
  }
  return result;
}

export function validateGridDirectDealRules(rules: GridDirectDealRules): void {
  requireNonNegativeSafeInteger(
    rules.transactionTaxBps,
    'transactionTaxBps',
  );
  if (rules.transactionTaxBps > BASIS_POINTS) {
    throw new Error('transactionTaxBps cannot exceed 10000 basis points');
  }

  requireNonNegativeSafeInteger(
    rules.propertyTradeCooldownMinutes,
    'propertyTradeCooldownMinutes',
  );
  if (
    !Number.isSafeInteger(rules.propertyTradeCooldownMinutes * 60_000)
  ) {
    throw new Error('propertyTradeCooldownMinutes is too large');
  }

  requirePositiveSafeInteger(rules.maxAssetsPerSide, 'maxAssetsPerSide');
}

export function calculateGridDirectDealTax(
  offeredCredits: number,
  rules: GridDirectDealRules,
): number {
  validateGridDirectDealRules(rules);
  requireNonNegativeSafeInteger(offeredCredits, 'offeredCredits');

  return Number(
    (BigInt(offeredCredits) * BigInt(rules.transactionTaxBps)) /
      BigInt(BASIS_POINTS),
  );
}

function validateSide(side: GridDirectDealSide, label: string): void {
  if (!side.playerId.trim()) {
    throw new Error(`${label}.playerId is required`);
  }
  if (!side.cityId.trim()) {
    throw new Error(`${label}.cityId is required`);
  }

  requireNonNegativeSafeInteger(
    side.creditBalance,
    `${label}.creditBalance`,
  );
  requireNonNegativeSafeInteger(
    side.offeredCredits,
    `${label}.offeredCredits`,
  );

  for (const assetId of side.offeredAssetIds) {
    if (!assetId.trim()) {
      throw new Error(`${label}.offeredAssetIds cannot contain blanks`);
    }
  }
}

function reject(
  proposal: GridDirectDealProposal,
  settledAt: string,
  reason: GridDirectDealRejectionReason,
): GridDirectDealSettlementPlan {
  return {
    settleable: false,
    reason,
    cityId: proposal.cityId,
    settledAt,
    proposerTotalDebitCredits: 0,
    counterpartyTotalDebitCredits: 0,
    creditTransfers: [],
    assetTransfers: [],
    taxCharges: [],
    playerCreditDeltas: {
      [proposal.proposer.playerId]: 0,
      [proposal.counterparty.playerId]: 0,
    },
    audit: {
      grossCreditsTransferred: 0,
      totalTaxCredits: 0,
      propertyTransfers: 0,
      otherAssetTransfers: 0,
      zeroCreditDeal: true,
      reciprocalCreditFlow: false,
    },
  };
}

function findDuplicateAssetId(proposal: GridDirectDealProposal): string | null {
  const seen = new Set<string>();
  for (const assetId of [
    ...proposal.proposer.offeredAssetIds,
    ...proposal.counterparty.offeredAssetIds,
  ]) {
    if (seen.has(assetId)) return assetId;
    seen.add(assetId);
  }
  return null;
}

function buildAssetMap(
  assets: readonly GridDirectDealAssetSnapshot[],
): Map<string, GridDirectDealAssetSnapshot> {
  const map = new Map<string, GridDirectDealAssetSnapshot>();
  for (const asset of assets) {
    if (!asset.assetId.trim()) {
      throw new Error('Grid direct deal assetId cannot be blank');
    }
    if (!asset.cityId.trim()) {
      throw new Error(`Grid direct deal asset ${asset.assetId} requires cityId`);
    }
    if (!asset.ownerPlayerId.trim()) {
      throw new Error(
        `Grid direct deal asset ${asset.assetId} requires ownerPlayerId`,
      );
    }
    if (map.has(asset.assetId)) {
      throw new Error(`Duplicate Grid direct deal asset snapshot: ${asset.assetId}`);
    }
    map.set(asset.assetId, asset);
  }
  return map;
}

function validateAssetForTransfer(
  assetId: string,
  fromPlayerId: string,
  proposal: GridDirectDealProposal,
  assetMap: Map<string, GridDirectDealAssetSnapshot>,
  rules: GridDirectDealRules,
  settledAtMs: number,
): GridDirectDealRejectionReason | null {
  const asset = assetMap.get(assetId);
  if (!asset) return 'asset-not-found';
  if (asset.ownerPlayerId !== fromPlayerId) return 'asset-owner-mismatch';
  if (asset.cityId !== proposal.cityId) return 'asset-city-mismatch';
  if (!asset.tradable) return 'asset-not-tradable';
  if (asset.majorLandmark) return 'major-landmark';

  if (asset.kind === 'property' && rules.propertyTradeCooldownMinutes > 0) {
    if (!asset.acquiredAt) return 'property-cooldown-unverifiable';
    const acquiredAtMs = Date.parse(asset.acquiredAt);
    if (!Number.isFinite(acquiredAtMs)) {
      return 'property-cooldown-unverifiable';
    }
    const cooldownMs = rules.propertyTradeCooldownMinutes * 60_000;
    if (settledAtMs < acquiredAtMs + cooldownMs) {
      return 'property-cooldown-active';
    }
  }

  return null;
}

function makeAssetTransfers(
  proposal: GridDirectDealProposal,
  assetMap: Map<string, GridDirectDealAssetSnapshot>,
): GridDirectDealAssetTransfer[] {
  const transfers: GridDirectDealAssetTransfer[] = [];

  for (const assetId of proposal.proposer.offeredAssetIds) {
    const asset = assetMap.get(assetId)!;
    transfers.push({
      assetId,
      kind: asset.kind,
      fromPlayerId: proposal.proposer.playerId,
      toPlayerId: proposal.counterparty.playerId,
    });
  }

  for (const assetId of proposal.counterparty.offeredAssetIds) {
    const asset = assetMap.get(assetId)!;
    transfers.push({
      assetId,
      kind: asset.kind,
      fromPlayerId: proposal.counterparty.playerId,
      toPlayerId: proposal.proposer.playerId,
    });
  }

  return transfers.sort((a, b) => a.assetId.localeCompare(b.assetId));
}

function makeAuditFacts(
  proposal: GridDirectDealProposal,
  assetTransfers: readonly GridDirectDealAssetTransfer[],
  totalTaxCredits: number,
): GridDirectDealAuditFacts {
  const grossCreditsTransferred = checkedAdd(
    proposal.proposer.offeredCredits,
    proposal.counterparty.offeredCredits,
    'grossCreditsTransferred',
  );

  return {
    grossCreditsTransferred,
    totalTaxCredits,
    propertyTransfers: assetTransfers.filter(({ kind }) => kind === 'property')
      .length,
    otherAssetTransfers: assetTransfers.filter(({ kind }) => kind === 'asset')
      .length,
    zeroCreditDeal: grossCreditsTransferred === 0,
    reciprocalCreditFlow:
      proposal.proposer.offeredCredits > 0 &&
      proposal.counterparty.offeredCredits > 0,
  };
}

export function planGridDirectDealSettlement(
  proposal: GridDirectDealProposal,
  assets: readonly GridDirectDealAssetSnapshot[],
  rules: GridDirectDealRules,
  settledAt: string,
): GridDirectDealSettlementPlan {
  validateGridDirectDealRules(rules);
  validateSide(proposal.proposer, 'proposer');
  validateSide(proposal.counterparty, 'counterparty');

  if (!proposal.cityId.trim()) {
    throw new Error('Grid direct deal cityId is required');
  }

  const createdAtMs = parseTimestamp(proposal.createdAt, 'createdAt');
  const expiresAtMs = parseTimestamp(proposal.expiresAt, 'expiresAt');
  const settledAtMs = parseTimestamp(settledAt, 'settledAt');

  if (expiresAtMs <= createdAtMs) {
    throw new Error('Grid direct deal expiresAt must be after createdAt');
  }

  if (proposal.proposer.playerId === proposal.counterparty.playerId) {
    return reject(proposal, settledAt, 'same-player');
  }

  if (
    proposal.proposer.cityId !== proposal.cityId ||
    proposal.counterparty.cityId !== proposal.cityId
  ) {
    return reject(proposal, settledAt, 'city-mismatch');
  }

  if (settledAtMs < createdAtMs || settledAtMs >= expiresAtMs) {
    return reject(proposal, settledAt, 'outside-deal-window');
  }

  if (
    proposal.proposer.offeredAssetIds.length > rules.maxAssetsPerSide ||
    proposal.counterparty.offeredAssetIds.length > rules.maxAssetsPerSide
  ) {
    return reject(proposal, settledAt, 'too-many-assets');
  }

  if (
    proposal.proposer.offeredCredits === 0 &&
    proposal.counterparty.offeredCredits === 0 &&
    proposal.proposer.offeredAssetIds.length === 0 &&
    proposal.counterparty.offeredAssetIds.length === 0
  ) {
    return reject(proposal, settledAt, 'empty-deal');
  }

  if (findDuplicateAssetId(proposal)) {
    return reject(proposal, settledAt, 'duplicate-asset');
  }

  const assetMap = buildAssetMap(assets);
  for (const assetId of proposal.proposer.offeredAssetIds) {
    const reason = validateAssetForTransfer(
      assetId,
      proposal.proposer.playerId,
      proposal,
      assetMap,
      rules,
      settledAtMs,
    );
    if (reason) return reject(proposal, settledAt, reason);
  }
  for (const assetId of proposal.counterparty.offeredAssetIds) {
    const reason = validateAssetForTransfer(
      assetId,
      proposal.counterparty.playerId,
      proposal,
      assetMap,
      rules,
      settledAtMs,
    );
    if (reason) return reject(proposal, settledAt, reason);
  }

  const proposerTax = calculateGridDirectDealTax(
    proposal.proposer.offeredCredits,
    rules,
  );
  const counterpartyTax = calculateGridDirectDealTax(
    proposal.counterparty.offeredCredits,
    rules,
  );

  const proposerTotalDebitCredits = checkedAdd(
    proposal.proposer.offeredCredits,
    proposerTax,
    'proposerTotalDebitCredits',
  );
  const counterpartyTotalDebitCredits = checkedAdd(
    proposal.counterparty.offeredCredits,
    counterpartyTax,
    'counterpartyTotalDebitCredits',
  );

  if (
    proposal.proposer.creditBalance < proposerTotalDebitCredits ||
    proposal.counterparty.creditBalance < counterpartyTotalDebitCredits
  ) {
    return reject(proposal, settledAt, 'insufficient-credits');
  }

  const totalTaxCredits = checkedAdd(
    proposerTax,
    counterpartyTax,
    'totalTaxCredits',
  );
  const assetTransfers = makeAssetTransfers(proposal, assetMap);

  const proposerAfterDebit = checkedSubtract(
    proposal.proposer.creditBalance,
    proposerTotalDebitCredits,
    'proposer balance',
  );
  const counterpartyAfterDebit = checkedSubtract(
    proposal.counterparty.creditBalance,
    counterpartyTotalDebitCredits,
    'counterparty balance',
  );
  checkedAdd(
    proposerAfterDebit,
    proposal.counterparty.offeredCredits,
    'proposer post-settlement balance',
  );
  checkedAdd(
    counterpartyAfterDebit,
    proposal.proposer.offeredCredits,
    'counterparty post-settlement balance',
  );

  const proposerDelta = checkedSubtract(
    proposal.counterparty.offeredCredits,
    proposerTotalDebitCredits,
    'proposer credit delta',
  );
  const counterpartyDelta = checkedSubtract(
    proposal.proposer.offeredCredits,
    counterpartyTotalDebitCredits,
    'counterparty credit delta',
  );

  return {
    settleable: true,
    cityId: proposal.cityId,
    settledAt,
    proposerTotalDebitCredits,
    counterpartyTotalDebitCredits,
    creditTransfers: [
      ...(proposal.proposer.offeredCredits > 0
        ? [
            {
              fromPlayerId: proposal.proposer.playerId,
              toPlayerId: proposal.counterparty.playerId,
              amountCredits: proposal.proposer.offeredCredits,
            },
          ]
        : []),
      ...(proposal.counterparty.offeredCredits > 0
        ? [
            {
              fromPlayerId: proposal.counterparty.playerId,
              toPlayerId: proposal.proposer.playerId,
              amountCredits: proposal.counterparty.offeredCredits,
            },
          ]
        : []),
    ],
    assetTransfers,
    taxCharges: [
      ...(proposerTax > 0
        ? [{ playerId: proposal.proposer.playerId, amountCredits: proposerTax }]
        : []),
      ...(counterpartyTax > 0
        ? [
            {
              playerId: proposal.counterparty.playerId,
              amountCredits: counterpartyTax,
            },
          ]
        : []),
    ],
    playerCreditDeltas: {
      [proposal.proposer.playerId]: proposerDelta,
      [proposal.counterparty.playerId]: counterpartyDelta,
    },
    audit: makeAuditFacts(proposal, assetTransfers, totalTaxCredits),
  };
}

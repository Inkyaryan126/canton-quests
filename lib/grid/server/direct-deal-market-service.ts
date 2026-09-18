import { planGridDirectDealSettlement } from '../core/direct-deals';
import type {
  GridDirectDealAssetSnapshot,
  GridDirectDealProposal,
} from '../core/direct-deal-types';
import { buildGridMarketTransactionFromDirectDeal } from '../core/market-transactions';
import type { GridCityPackage } from '../core/types';
import {
  acceptGridDirectDealProposal,
  cancelGridDirectDealProposal,
  createGridDirectDealProposal,
} from './direct-deal-proposal-service';
import type { GridDirectDealProposalCommandPort } from './direct-deal-proposal-port';
import {
  GRID_DIRECT_DEAL_MAX_DURATION_MINUTES,
  GRID_DIRECT_DEAL_MIN_DURATION_MINUTES,
  GRID_DIRECT_DEAL_RULES,
} from './direct-deal-rules';
import type {
  GridDirectDealMarketPort,
  GridDirectDealPropertySnapshot,
  GridDirectDealStoredProposal,
} from './direct-deal-market-port';

export interface GridDirectDealPropertyTerm {
  slug: string;
  name: string;
}

export interface GridDirectDealSummary {
  proposalId: string;
  role: 'sent' | 'received';
  counterpartyCallsign: string;
  yourCredits: number;
  theirCredits: number;
  yourProperties: GridDirectDealPropertyTerm[];
  theirProperties: GridDirectDealPropertyTerm[];
  createdAt: string;
  expiresAt: string;
}

export interface GridCreateDirectDealRequest {
  proposerPlayerId: string;
  counterpartyCallsign: string;
  proposerCredits: number;
  counterpartyCredits: number;
  proposerPropertySlugs: string[];
  durationMinutes: number;
  idempotencyKey: string;
  now: string;
}

export interface GridResolveDirectDealRequest {
  playerId: string;
  proposalId: string;
  idempotencyKey: string;
  now: string;
}
function nonBlank(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`Grid Direct Deal market requires ${label}`);
  return normalized;
}

function validTime(value: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new Error('Grid Direct Deal market requires a valid now timestamp');
  }
  return parsed;
}

function requireNonNegativeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Grid Direct Deal market requires non-negative integer ${label}`);
  }
}

function activeContext(
  context: Awaited<ReturnType<GridDirectDealMarketPort['getContext']>>,
) {
  if (!context || !['active', 'surge'].includes(context.seasonStatus)) {
    throw new Error('Grid Direct Deal market requires an active season');
  }
  return context;
}

function safePropertyName(pkg: GridCityPackage, slug: string): string {
  const property = pkg.properties.find((candidate) => candidate.slug === slug);
  if (!property) return 'Grid Property';
  return property.publicNameSafe ? property.name : 'Grid Property';
}

function propertyTerms(
  pkg: GridCityPackage,
  ids: readonly string[],
  snapshots: readonly GridDirectDealPropertySnapshot[],
): GridDirectDealPropertyTerm[] {
  const byId = new Map(snapshots.map((property) => [property.propertyId, property]));
  return ids.map((id) => {
    const property = byId.get(id);
    return {
      slug: property?.propertySlug ?? 'unavailable-property',
      name: property
        ? safePropertyName(pkg, property.propertySlug)
        : 'Grid Property',
    };
  });
}

export async function listGridDirectDeals(
  port: GridDirectDealMarketPort,
  pkg: GridCityPackage,
  viewerPlayerId: string,
  now: string,
): Promise<GridDirectDealSummary[]> {
  const viewer = nonBlank(viewerPlayerId, 'viewerPlayerId');
  validTime(now);
  activeContext(await port.getContext());

  const proposals = await port.listOpenProposals(viewer, now);
  const participantIds = proposals.flatMap((proposal) => [
    proposal.proposerPlayerId,
    proposal.counterpartyPlayerId,
  ]);
  const propertyIds = proposals.flatMap((proposal) => [
    ...proposal.proposerPropertyIds,
    ...proposal.counterpartyPropertyIds,
  ]);
  const [labels, properties] = await Promise.all([
    port.readPlayerLabels(participantIds),
    port.readProperties(propertyIds),
  ]);
  const callsignById = new Map(
    labels.map((player) => [player.playerId, player.callsign] as const),
  );

  return proposals.map((proposal) => {
    const sent = proposal.proposerPlayerId === viewer;
    if (!sent && proposal.counterpartyPlayerId !== viewer) {
      throw new Error('Grid Direct Deal market returned a proposal for another player');
    }
    const counterpartyId = sent
      ? proposal.counterpartyPlayerId
      : proposal.proposerPlayerId;

    return {
      proposalId: proposal.proposalId,
      role: sent ? 'sent' : 'received',
      counterpartyCallsign: callsignById.get(counterpartyId) ?? 'GRID PLAYER',
      yourCredits: sent
        ? proposal.proposerCredits
        : proposal.counterpartyCredits,
      theirCredits: sent
        ? proposal.counterpartyCredits
        : proposal.proposerCredits,
      yourProperties: propertyTerms(
        pkg,
        sent ? proposal.proposerPropertyIds : proposal.counterpartyPropertyIds,
        properties,
      ),
      theirProperties: propertyTerms(
        pkg,
        sent ? proposal.counterpartyPropertyIds : proposal.proposerPropertyIds,
        properties,
      ),
      createdAt: proposal.createdAt,
      expiresAt: proposal.expiresAt,
    };
  });
}
export async function createGridPlayerDirectDeal(
  marketPort: GridDirectDealMarketPort,
  commandPort: GridDirectDealProposalCommandPort,
  request: GridCreateDirectDealRequest,
) {
  const proposerPlayerId = nonBlank(
    request.proposerPlayerId,
    'proposerPlayerId',
  );
  const counterpartyCallsign = nonBlank(
    request.counterpartyCallsign,
    'counterpartyCallsign',
  );
  const idempotencyKey = nonBlank(
    request.idempotencyKey,
    'a non-empty idempotency key',
  );
  const nowMs = validTime(request.now);
  requireNonNegativeInteger(request.proposerCredits, 'proposerCredits');
  requireNonNegativeInteger(request.counterpartyCredits, 'counterpartyCredits');

  if (
    !Number.isSafeInteger(request.durationMinutes) ||
    request.durationMinutes < GRID_DIRECT_DEAL_MIN_DURATION_MINUTES ||
    request.durationMinutes > GRID_DIRECT_DEAL_MAX_DURATION_MINUTES
  ) {
    throw new Error('Grid Direct Deal market durationMinutes is outside configured bounds');
  }
  if (request.proposerPropertySlugs.length > GRID_DIRECT_DEAL_RULES.maxAssetsPerSide) {
    throw new Error('Grid Direct Deal market exceeds maxAssetsPerSide');
  }
  if (
    request.proposerCredits === 0 &&
    request.counterpartyCredits === 0 &&
    request.proposerPropertySlugs.length === 0
  ) {
    throw new Error('Grid Direct Deal market requires value movement');
  }

  const context = activeContext(await marketPort.getContext());
  const counterparty = await marketPort.resolvePlayerByCallsign(
    counterpartyCallsign,
  );
  if (!counterparty) throw new Error('Player callsign not found');
  if (counterparty.playerId === proposerPlayerId) {
    throw new Error('Grid Direct Deal market requires another player');
  }

  const uniqueSlugs = [...new Set(
    request.proposerPropertySlugs.map((slug) => slug.trim()).filter(Boolean),
  )];
  if (uniqueSlugs.length !== request.proposerPropertySlugs.length) {
    throw new Error('Grid Direct Deal market property slugs must be unique and non-blank');
  }
  const resolvedProperties = await marketPort.resolvePropertyIds(uniqueSlugs);
  if (resolvedProperties.length !== uniqueSlugs.length) {
    throw new Error('Grid Direct Deal market could not resolve every offered property');
  }
  const idBySlug = new Map(
    resolvedProperties.map((property) => [
      property.propertySlug,
      property.propertyId,
    ] as const),
  );
  const proposerPropertyIds = uniqueSlugs.map((slug) => idBySlug.get(slug)!);

  const proposalId = 'direct:' + idempotencyKey;
  const expiresAt = new Date(
    nowMs + request.durationMinutes * 60_000,
  ).toISOString();

  const result = await createGridDirectDealProposal(commandPort, {
    seasonId: context.seasonId,
    proposalId,
    proposerPlayerId,
    counterpartyPlayerId: counterparty.playerId,
    proposerCredits: request.proposerCredits,
    counterpartyCredits: request.counterpartyCredits,
    proposerPropertyIds,
    counterpartyPropertyIds: [],
    transactionTaxBps: GRID_DIRECT_DEAL_RULES.transactionTaxBps,
    propertyTradeCooldownMinutes:
      GRID_DIRECT_DEAL_RULES.propertyTradeCooldownMinutes,
    maxAssetsPerSide: GRID_DIRECT_DEAL_RULES.maxAssetsPerSide,
    createdAt: request.now,
    expiresAt,
    idempotencyKey,
    now: request.now,
  });

  return {
    proposalId: result.proposalId,
    counterpartyCallsign: counterparty.callsign,
    proposerCredits: result.proposerCredits,
    counterpartyCredits: result.counterpartyCredits,
    offeredPropertySlugs: uniqueSlugs,
    createdAt: result.createdAt,
    expiresAt: result.expiresAt,
    status: result.status,
  };
}
function buildProposal(
  stored: GridDirectDealStoredProposal,
  states: Map<string, number>,
): GridDirectDealProposal {
  const proposerCredits = states.get(stored.proposerPlayerId);
  const counterpartyCredits = states.get(stored.counterpartyPlayerId);
  if (proposerCredits === undefined || counterpartyCredits === undefined) {
    throw new Error('Grid Direct Deal market could not load both player balances');
  }

  return {
    cityId: stored.cityId,
    proposer: {
      playerId: stored.proposerPlayerId,
      cityId: stored.cityId,
      creditBalance: proposerCredits,
      offeredCredits: stored.proposerCredits,
      offeredAssetIds: stored.proposerPropertyIds,
    },
    counterparty: {
      playerId: stored.counterpartyPlayerId,
      cityId: stored.cityId,
      creditBalance: counterpartyCredits,
      offeredCredits: stored.counterpartyCredits,
      offeredAssetIds: stored.counterpartyPropertyIds,
    },
    createdAt: stored.createdAt,
    expiresAt: stored.expiresAt,
  };
}

export async function acceptGridPlayerDirectDeal(
  marketPort: GridDirectDealMarketPort,
  commandPort: GridDirectDealProposalCommandPort,
  request: GridResolveDirectDealRequest,
) {
  const playerId = nonBlank(request.playerId, 'playerId');
  const proposalId = nonBlank(request.proposalId, 'proposalId');
  const idempotencyKey = nonBlank(
    request.idempotencyKey,
    'a non-empty idempotency key',
  );
  validTime(request.now);
  const context = activeContext(await marketPort.getContext());

  const stored = await marketPort.readProposal(proposalId);
  if (!stored || stored.seasonId !== context.seasonId || stored.status !== 'open') {
    throw new Error('Grid Direct Deal proposal is not open');
  }
  if (stored.counterpartyPlayerId !== playerId) {
    throw new Error('Only the named Direct Deal counterparty can accept');
  }

  const participantIds = [
    stored.proposerPlayerId,
    stored.counterpartyPlayerId,
  ];
  const propertyIds = [
    ...stored.proposerPropertyIds,
    ...stored.counterpartyPropertyIds,
  ];
  const [playerStates, properties] = await Promise.all([
    marketPort.readPlayerStates(participantIds),
    marketPort.readProperties(propertyIds),
  ]);
  const balances = new Map(
    playerStates.map((state) => [state.playerId, state.credits] as const),
  );
  const proposal = buildProposal(stored, balances);
  const assets: GridDirectDealAssetSnapshot[] = properties.map((property) => ({
    assetId: property.propertyId,
    kind: 'property',
    cityId: stored.cityId,
    ownerPlayerId: property.ownerPlayerId ?? '',
    tradable: property.tradable,
    majorLandmark: property.majorLandmark,
    acquiredAt: property.acquiredAt,
  }));
  const rules = {
    transactionTaxBps: stored.transactionTaxBps,
    propertyTradeCooldownMinutes: stored.propertyTradeCooldownMinutes,
    maxAssetsPerSide: stored.maxAssetsPerSide,
  };
  const plan = planGridDirectDealSettlement(
    proposal,
    assets,
    rules,
    request.now,
  );
  if (!plan.settleable) {
    throw new Error(
      `Grid Direct Deal cannot settle: ${plan.reason ?? 'unknown reason'}`,
    );
  }

  const estimatedAssetValueCreditsById = Object.fromEntries(
    properties.map((property) => [
      property.propertyId,
      property.baseValueCredits,
    ]),
  );
  const transaction = buildGridMarketTransactionFromDirectDeal({
    transactionId: 'direct-deal:' + idempotencyKey,
    sourceId: proposalId,
    plan,
    estimatedAssetValueCreditsById,
  });

  const result = await acceptGridDirectDealProposal(commandPort, {
    seasonId: context.seasonId,
    proposalId,
    acceptingPlayerId: playerId,
    transaction,
    idempotencyKey,
    now: request.now,
  });

  return {
    proposalId: result.proposalId,
    status: result.status,
    acceptedAt: result.acceptedAt,
    transactionId: result.settlement.transactionId,
  };
}
export async function cancelGridPlayerDirectDeal(
  marketPort: GridDirectDealMarketPort,
  commandPort: GridDirectDealProposalCommandPort,
  request: GridResolveDirectDealRequest,
) {
  const playerId = nonBlank(request.playerId, 'playerId');
  const proposalId = nonBlank(request.proposalId, 'proposalId');
  const idempotencyKey = nonBlank(
    request.idempotencyKey,
    'a non-empty idempotency key',
  );
  validTime(request.now);
  const context = activeContext(await marketPort.getContext());

  const stored = await marketPort.readProposal(proposalId);
  if (!stored || stored.seasonId !== context.seasonId || stored.status !== 'open') {
    throw new Error('Grid Direct Deal proposal is not open');
  }
  if (stored.proposerPlayerId !== playerId) {
    throw new Error('Only the Direct Deal proposer can cancel');
  }

  const result = await cancelGridDirectDealProposal(commandPort, {
    seasonId: context.seasonId,
    proposalId,
    proposerPlayerId: playerId,
    idempotencyKey,
    now: request.now,
  });

  return {
    proposalId: result.proposalId,
    status: result.status,
    cancelledAt: result.cancelledAt,
  };
}

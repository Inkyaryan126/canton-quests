import type {
  GridAllianceContributionDecision,
  GridAllianceAdjacencyEdge,
  GridAllianceContributionInput,
  GridAllianceJoinDecision,
  GridAllianceJoinRequest,
  GridAllianceMembership,
  GridAllianceNetworkProjection,
  GridAllianceRules,
  GridAllianceTerritoryOwnership,
  GridAllianceUpkeepInput,
  GridAllianceUpkeepProjection,
  GridAllianceUpkeepSettlement,
  GridAllianceUpkeepSettlementInput,
} from './alliance-types';

function requireNonEmpty(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`Grid Alliance requires ${label}`);
  }
  return normalized;
}

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

function timestampMs(value: string, label: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} must be a valid timestamp`);
  }
  return parsed;
}

function checkedMultiply(left: number, right: number, label: string): number {
  const result = left * right;
  if (!Number.isSafeInteger(result)) {
    throw new Error(`${label} exceeds safe integer range`);
  }
  return result;
}

function checkedAdd(left: number, right: number, label: string): number {
  const result = left + right;
  if (!Number.isSafeInteger(result)) {
    throw new Error(`${label} exceeds safe integer range`);
  }
  return result;
}

export function validateGridAllianceRules(rules: GridAllianceRules): void {
  requirePositiveSafeInteger(rules.maxMembers, 'maxMembers');
  requirePositiveSafeInteger(rules.leaveCooldownSeconds, 'leaveCooldownSeconds');
  requirePositiveSafeInteger(rules.influencePoolCap, 'influencePoolCap');
  requireNonNegativeSafeInteger(
    rules.baseUpkeepInfluencePerTick,
    'baseUpkeepInfluencePerTick',
  );
  requireNonNegativeSafeInteger(
    rules.memberUpkeepInfluencePerTick,
    'memberUpkeepInfluencePerTick',
  );
  requireNonNegativeSafeInteger(
    rules.disconnectedComponentUpkeepInfluencePerTick,
    'disconnectedComponentUpkeepInfluencePerTick',
  );
  requirePositiveSafeInteger(
    rules.largeAllianceThreshold,
    'largeAllianceThreshold',
  );
  requireNonNegativeSafeInteger(
    rules.largeAllianceSurchargeInfluencePerMemberPerTick,
    'largeAllianceSurchargeInfluencePerMemberPerTick',
  );
  if (rules.largeAllianceThreshold > rules.maxMembers) {
    throw new Error('largeAllianceThreshold cannot exceed maxMembers');
  }
}

function validateMembership(membership: GridAllianceMembership): void {
  requireNonEmpty(membership.playerId, 'membership.playerId');
  requireNonEmpty(membership.seasonId, 'membership.seasonId');
  requireNonEmpty(membership.allianceId, 'membership.allianceId');
  const joinedAt = timestampMs(membership.joinedAt, 'membership.joinedAt');
  if (membership.leftAt === null) {
    if (membership.cooldownUntil !== null) {
      throw new Error('active membership cannot have cooldownUntil');
    }
    return;
  }

  const leftAt = timestampMs(membership.leftAt, 'membership.leftAt');
  if (leftAt < joinedAt) {
    throw new Error('membership.leftAt cannot precede joinedAt');
  }
  if (membership.cooldownUntil === null) {
    throw new Error('left membership requires cooldownUntil');
  }
  const cooldownUntil = timestampMs(
    membership.cooldownUntil,
    'membership.cooldownUntil',
  );
  if (cooldownUntil < leftAt) {
    throw new Error('membership.cooldownUntil cannot precede leftAt');
  }
}

function validateJoinRequest(request: GridAllianceJoinRequest): number {
  requireNonEmpty(request.playerId, 'playerId');
  requireNonEmpty(request.seasonId, 'seasonId');
  requireNonEmpty(request.allianceId, 'allianceId');
  requireNonNegativeSafeInteger(
    request.targetActiveMemberCount,
    'targetActiveMemberCount',
  );
  for (const membership of request.membershipHistory) {
    validateMembership(membership);
  }
  return timestampMs(request.now, 'now');
}

function latestCooldownUntil(
  request: GridAllianceJoinRequest,
): { timestamp: number; iso: string } | null {
  const matching = request.membershipHistory.filter(
    (membership) =>
      membership.playerId === request.playerId &&
      membership.seasonId === request.seasonId &&
      membership.leftAt !== null &&
      membership.cooldownUntil !== null,
  );

  let latest: { timestamp: number; iso: string } | null = null;
  for (const membership of matching) {
    const timestamp = timestampMs(
      membership.cooldownUntil!,
      'membership.cooldownUntil',
    );
    if (!latest || timestamp > latest.timestamp) {
      latest = { timestamp, iso: new Date(timestamp).toISOString() };
    }
  }
  return latest;
}

export function evaluateGridAllianceJoin(
  request: GridAllianceJoinRequest,
  rules: GridAllianceRules,
): GridAllianceJoinDecision {
  validateGridAllianceRules(rules);
  const now = validateJoinRequest(request);

  const activeMembership = request.membershipHistory.find(
    (membership) =>
      membership.playerId === request.playerId &&
      membership.seasonId === request.seasonId &&
      membership.leftAt === null,
  );
  if (activeMembership) {
    return {
      allowed: false,
      reason: 'already-in-alliance',
      cooldownUntil: null,
    };
  }

  const cooldown = latestCooldownUntil(request);
  if (cooldown && now < cooldown.timestamp) {
    return {
      allowed: false,
      reason: 'cooldown-active',
      cooldownUntil: cooldown.iso,
    };
  }

  if (request.targetActiveMemberCount >= rules.maxMembers) {
    return {
      allowed: false,
      reason: 'alliance-full',
      cooldownUntil: null,
    };
  }

  return {
    allowed: true,
    reason: null,
    cooldownUntil: null,
  };
}

export function leaveGridAlliance(
  membership: GridAllianceMembership,
  leftAt: string,
  rules: GridAllianceRules,
): GridAllianceMembership {
  validateGridAllianceRules(rules);
  if (membership.leftAt !== null) {
    throw new Error('Grid Alliance leave requires an active membership');
  }
  validateMembership(membership);

  const leftAtMs = timestampMs(leftAt, 'leftAt');
  const joinedAtMs = timestampMs(membership.joinedAt, 'membership.joinedAt');
  if (leftAtMs < joinedAtMs) {
    throw new Error('leftAt cannot precede membership.joinedAt');
  }

  const cooldownMs = checkedMultiply(
    rules.leaveCooldownSeconds,
    1000,
    'leaveCooldownSeconds',
  );
  const cooldownUntilMs = checkedAdd(leftAtMs, cooldownMs, 'cooldownUntil');
  const cooldownUntil = new Date(cooldownUntilMs);
  if (!Number.isFinite(cooldownUntil.getTime())) {
    throw new Error('cooldownUntil exceeds supported timestamp range');
  }

  return {
    ...membership,
    leftAt: new Date(leftAtMs).toISOString(),
    cooldownUntil: cooldownUntil.toISOString(),
  };
}

export function contributeGridAllianceInfluence(
  input: GridAllianceContributionInput,
  rules: GridAllianceRules,
): GridAllianceContributionDecision {
  validateGridAllianceRules(rules);
  requirePositiveSafeInteger(input.requestedInfluence, 'requestedInfluence');
  requireNonNegativeSafeInteger(input.playerInfluence, 'playerInfluence');
  requireNonNegativeSafeInteger(input.poolInfluence, 'poolInfluence');
  if (input.poolInfluence > rules.influencePoolCap) {
    throw new Error('poolInfluence cannot exceed influencePoolCap');
  }

  const remainingCapacity = rules.influencePoolCap - input.poolInfluence;
  const acceptedInfluence = Math.min(
    input.requestedInfluence,
    input.playerInfluence,
    remainingCapacity,
  );
  const constraints: GridAllianceContributionDecision['constraints'] = [];
  if (input.playerInfluence < input.requestedInfluence) {
    constraints.push('player-balance');
  }
  if (remainingCapacity < input.requestedInfluence) {
    constraints.push('pool-capacity');
  }

  return {
    acceptedInfluence,
    playerInfluenceAfter: input.playerInfluence - acceptedInfluence,
    poolInfluenceAfter: checkedAdd(
      input.poolInfluence,
      acceptedInfluence,
      'poolInfluenceAfter',
    ),
    constraints,
  };
}

export function calculateGridAllianceUpkeep(
  input: GridAllianceUpkeepInput,
  rules: GridAllianceRules,
): GridAllianceUpkeepProjection {
  validateGridAllianceRules(rules);
  requirePositiveSafeInteger(input.activeMemberCount, 'activeMemberCount');
  if (input.activeMemberCount > rules.maxMembers) {
    throw new Error('activeMemberCount cannot exceed maxMembers');
  }
  requireNonNegativeSafeInteger(
    input.disconnectedComponentCount,
    'disconnectedComponentCount',
  );
  requirePositiveSafeInteger(input.ticks, 'ticks');

  const memberInfluencePerTick = checkedMultiply(
    input.activeMemberCount,
    rules.memberUpkeepInfluencePerTick,
    'memberInfluencePerTick',
  );
  const disconnectedInfluencePerTick = checkedMultiply(
    input.disconnectedComponentCount,
    rules.disconnectedComponentUpkeepInfluencePerTick,
    'disconnectedInfluencePerTick',
  );
  const membersAboveThreshold = Math.max(
    0,
    input.activeMemberCount - rules.largeAllianceThreshold,
  );
  const largeAllianceSurchargeInfluencePerTick = checkedMultiply(
    membersAboveThreshold,
    rules.largeAllianceSurchargeInfluencePerMemberPerTick,
    'largeAllianceSurchargeInfluencePerTick',
  );

  let perTickInfluence = checkedAdd(
    rules.baseUpkeepInfluencePerTick,
    memberInfluencePerTick,
    'perTickInfluence',
  );
  perTickInfluence = checkedAdd(
    perTickInfluence,
    disconnectedInfluencePerTick,
    'perTickInfluence',
  );
  perTickInfluence = checkedAdd(
    perTickInfluence,
    largeAllianceSurchargeInfluencePerTick,
    'perTickInfluence',
  );
  const totalInfluence = checkedMultiply(
    perTickInfluence,
    input.ticks,
    'totalInfluence',
  );

  return {
    ticks: input.ticks,
    perTickInfluence,
    totalInfluence,
    breakdown: {
      baseInfluencePerTick: rules.baseUpkeepInfluencePerTick,
      memberInfluencePerTick,
      disconnectedInfluencePerTick,
      largeAllianceSurchargeInfluencePerTick,
    },
  };
}

export function settleGridAllianceUpkeep(
  input: GridAllianceUpkeepSettlementInput,
  rules: GridAllianceRules,
): GridAllianceUpkeepSettlement {
  validateGridAllianceRules(rules);
  requireNonNegativeSafeInteger(input.poolInfluence, 'poolInfluence');
  if (input.poolInfluence > rules.influencePoolCap) {
    throw new Error('poolInfluence cannot exceed influencePoolCap');
  }

  const upkeep = calculateGridAllianceUpkeep(input, rules);
  const paidInfluence = Math.min(input.poolInfluence, upkeep.totalInfluence);
  const poolInfluenceAfter = input.poolInfluence - paidInfluence;
  const shortfallInfluence = upkeep.totalInfluence - paidInfluence;

  return {
    upkeep,
    paidInfluence,
    poolInfluenceAfter,
    shortfallInfluence,
    fullyPaid: shortfallInfluence === 0,
  };
}

function compareStringArrays(left: string[], right: string[]): number {
  const first = (left[0] ?? '').localeCompare(right[0] ?? '');
  if (first !== 0) return first;
  if (left.length !== right.length) return left.length - right.length;
  return left.join('\u0000').localeCompare(right.join('\u0000'));
}

export function projectGridAllianceNetwork(
  memberPlayerIds: string[],
  territoryOwnership: GridAllianceTerritoryOwnership[],
  adjacencyEdges: GridAllianceAdjacencyEdge[],
): GridAllianceNetworkProjection {
  const members = new Set(
    memberPlayerIds.map((playerId) => requireNonEmpty(playerId, 'memberPlayerId')),
  );
  const ownerByTerritory = new Map<string, string>();

  for (const ownership of territoryOwnership) {
    const territorySlug = requireNonEmpty(
      ownership.territorySlug,
      'territoryOwnership.territorySlug',
    );
    const ownerPlayerId = requireNonEmpty(
      ownership.ownerPlayerId,
      'territoryOwnership.ownerPlayerId',
    );
    const existingOwner = ownerByTerritory.get(territorySlug);
    if (existingOwner && existingOwner !== ownerPlayerId) {
      throw new Error(
        `Grid Alliance conflicting ownership for territory ${territorySlug}`,
      );
    }
    ownerByTerritory.set(territorySlug, ownerPlayerId);
  }

  const controlledTerritorySlugs = [...ownerByTerritory.entries()]
    .filter(([, ownerPlayerId]) => members.has(ownerPlayerId))
    .map(([territorySlug]) => territorySlug)
    .sort();
  const controlled = new Set(controlledTerritorySlugs);
  const neighbors = new Map<string, Set<string>>(
    controlledTerritorySlugs.map((slug) => [slug, new Set<string>()]),
  );

  for (const edge of adjacencyEdges) {
    const from = requireNonEmpty(
      edge.fromTerritorySlug,
      'adjacencyEdge.fromTerritorySlug',
    );
    const to = requireNonEmpty(
      edge.toTerritorySlug,
      'adjacencyEdge.toTerritorySlug',
    );
    if (from === to || !controlled.has(from) || !controlled.has(to)) continue;
    neighbors.get(from)!.add(to);
    neighbors.get(to)!.add(from);
  }

  const visited = new Set<string>();
  const components: string[][] = [];
  for (const start of controlledTerritorySlugs) {
    if (visited.has(start)) continue;
    const stack = [start];
    const component: string[] = [];
    visited.add(start);

    while (stack.length > 0) {
      const current = stack.pop()!;
      component.push(current);
      const next = [...(neighbors.get(current) ?? [])].sort().reverse();
      for (const neighbor of next) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        stack.push(neighbor);
      }
    }

    component.sort();
    components.push(component);
  }
  components.sort(compareStringArrays);

  const isolatedTerritorySlugs = components
    .filter((component) => component.length === 1)
    .map((component) => component[0]);
  const largestComponentSize = components.reduce(
    (largest, component) => Math.max(largest, component.length),
    0,
  );

  return {
    controlledTerritorySlugs,
    components,
    componentCount: components.length,
    largestComponentSize,
    isolatedTerritorySlugs,
    disconnectedComponentCount: Math.max(components.length - 1, 0),
  };
}

import type {
  GridCityWealthTransferDecision,
  GridCityWealthTransferRequest,
  GridVisitorAction,
  GridVisitorActionDecision,
  GridVisitorEconomyFacts,
  GridVisitorEconomyPolicy,
  GridVisitorEconomyProjection,
  GridVisitorStanding,
} from './visitor-economy-types';

function nonBlank(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error('Grid visitor economy requires ' + field);
  return normalized;
}

function nonNegativeSafeInteger(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(
      'Grid visitor economy requires ' +
        field +
        ' to be a non-negative safe integer',
    );
  }
  return value;
}

function positiveSafeInteger(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(
      'Grid visitor economy requires ' +
        field +
        ' to be a positive safe integer',
    );
  }
  return value;
}

export function validateGridVisitorEconomyPolicy(
  policy: GridVisitorEconomyPolicy,
): void {
  nonNegativeSafeInteger(
    policy.visitorInvestmentCapCredits,
    'visitor investment cap',
  );
  nonNegativeSafeInteger(
    policy.visitorPropertyLimit,
    'visitor property limit',
  );
  nonNegativeSafeInteger(
    policy.visitorDeploymentAllowance,
    'visitor deployment allowance',
  );

  if (policy.residencyThresholdPoints !== null) {
    positiveSafeInteger(
      policy.residencyThresholdPoints,
      'residency threshold points',
    );
  }
}

function validateFacts(facts: GridVisitorEconomyFacts): void {
  nonBlank(facts.targetCitySlug, 'target city slug');
  if (facts.homeCitySlug !== null) {
    nonBlank(facts.homeCitySlug, 'home city slug');
  }
  nonNegativeSafeInteger(
    facts.localInvestmentCredits,
    'local investment credits',
  );
  nonNegativeSafeInteger(
    facts.ownedPropertyCount,
    'owned property count',
  );
  nonNegativeSafeInteger(facts.deploymentsUsed, 'deployments used');
  nonNegativeSafeInteger(facts.residencyPoints, 'residency points');
}

function standingFor(
  targetCitySlug: string,
  homeCitySlug: string | null,
): GridVisitorStanding {
  if (homeCitySlug === null) return 'unassigned';
  return targetCitySlug === homeCitySlug ? 'home' : 'visitor';
}

export function projectGridVisitorEconomy(
  policy: GridVisitorEconomyPolicy,
  facts: GridVisitorEconomyFacts,
): GridVisitorEconomyProjection {
  validateGridVisitorEconomyPolicy(policy);
  validateFacts(facts);

  const targetCitySlug = facts.targetCitySlug.trim();
  const homeCitySlug = facts.homeCitySlug?.trim() ?? null;
  const standing = standingFor(targetCitySlug, homeCitySlug);
  const restrictionsApply = standing !== 'home';

  return {
    standing,
    targetCitySlug,
    homeCitySlug,
    restrictionsApply,
    investmentCapCredits: restrictionsApply
      ? policy.visitorInvestmentCapCredits
      : null,
    investmentRemainingCredits: restrictionsApply
      ? Math.max(
          0,
          policy.visitorInvestmentCapCredits -
            facts.localInvestmentCredits,
        )
      : null,
    propertyLimit: restrictionsApply
      ? policy.visitorPropertyLimit
      : null,
    propertySlotsRemaining: restrictionsApply
      ? Math.max(
          0,
          policy.visitorPropertyLimit - facts.ownedPropertyCount,
        )
      : null,
    deploymentAllowance: restrictionsApply
      ? policy.visitorDeploymentAllowance
      : null,
    deploymentsRemaining: restrictionsApply
      ? Math.max(
          0,
          policy.visitorDeploymentAllowance - facts.deploymentsUsed,
        )
      : null,
    residency: {
      points: facts.residencyPoints,
      threshold: policy.residencyThresholdPoints,
      eligible:
        policy.residencyThresholdPoints !== null &&
        facts.residencyPoints >= policy.residencyThresholdPoints,
    },
  };
}

export function evaluateGridVisitorAction(
  projection: GridVisitorEconomyProjection,
  action: GridVisitorAction,
): GridVisitorActionDecision {
  if (!projection.restrictionsApply) {
    return { allowed: true, reason: 'allowed' };
  }

  switch (action.type) {
    case 'invest': {
      positiveSafeInteger(action.credits, 'investment credits');
      const remaining = projection.investmentRemainingCredits ?? 0;
      return action.credits <= remaining
        ? { allowed: true, reason: 'allowed' }
        : { allowed: false, reason: 'investment-cap' };
    }
    case 'acquire-property':
      return (projection.propertySlotsRemaining ?? 0) > 0
        ? { allowed: true, reason: 'allowed' }
        : { allowed: false, reason: 'property-limit' };
    case 'deploy':
      return (projection.deploymentsRemaining ?? 0) > 0
        ? { allowed: true, reason: 'allowed' }
        : { allowed: false, reason: 'deployment-limit' };
  }
}

export function evaluateGridCityWealthTransfer(
  request: GridCityWealthTransferRequest,
): GridCityWealthTransferDecision {
  const sourceCitySlug = nonBlank(
    request.sourceCitySlug,
    'source city slug',
  );
  const targetCitySlug = nonBlank(
    request.targetCitySlug,
    'target city slug',
  );
  const credits = nonNegativeSafeInteger(request.credits, 'credits');
  const influence = nonNegativeSafeInteger(request.influence, 'influence');
  const commandPoints = nonNegativeSafeInteger(
    request.commandPoints,
    'command points',
  );

  if (sourceCitySlug === targetCitySlug) {
    return { allowed: true, reason: 'same-city' };
  }

  if (credits === 0 && influence === 0 && commandPoints === 0) {
    return { allowed: true, reason: 'no-local-wealth' };
  }

  return { allowed: false, reason: 'cross-city-wealth-disabled' };
}

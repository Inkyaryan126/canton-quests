import type {
  GridOfflineDefenseContext,
  GridOfflineDefenseDecision,
  GridOfflineDefensePolicy,
  GridOfflineDefensePriorityRule,
} from './offline-defense-types';

function isNonNegativeInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

function assertBasisPoints(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0 || value > 10_000) {
    throw new Error(`${label} must be an integer from 0 to 10000`);
  }
}

export function validateOfflineDefensePolicy(
  policy: GridOfflineDefensePolicy,
): void {
  if (!policy.doctrineId.trim()) {
    throw new Error('doctrineId is required');
  }

  for (const [label, value] of [
    ['reserveInfluence', policy.reserveInfluence],
    ['maxCommitPerContest', policy.maxCommitPerContest],
    ['autoRetreatBelowInfluence', policy.autoRetreatBelowInfluence],
    ['autoRetreatAfterLosses', policy.autoRetreatAfterLosses],
  ] as const) {
    if (!isNonNegativeInteger(value)) {
      throw new Error(`${label} must be a non-negative integer`);
    }
  }

  assertBasisPoints(policy.defaultCommitBps, 'defaultCommitBps');

  const seen = new Set<string>();
  for (const rule of policy.priorityRules) {
    if (!rule.territorySlug.trim()) {
      throw new Error('priority rule territorySlug is required');
    }
    if (seen.has(rule.territorySlug)) {
      throw new Error(`duplicate priority rule for ${rule.territorySlug}`);
    }
    seen.add(rule.territorySlug);

    if (!isNonNegativeInteger(rule.priority)) {
      throw new Error('priority must be a non-negative integer');
    }
    if (rule.commitBps !== undefined) {
      assertBasisPoints(rule.commitBps, 'priority rule commitBps');
    }
  }
}

function priorityRuleFor(
  territorySlug: string,
  policy: GridOfflineDefensePolicy,
): GridOfflineDefensePriorityRule | undefined {
  return policy.priorityRules.find(
    (rule) => rule.territorySlug === territorySlug,
  );
}

function withdrawDecision(
  policy: GridOfflineDefensePolicy,
  rule: GridOfflineDefensePriorityRule | undefined,
  reason: GridOfflineDefenseDecision['reason'],
): GridOfflineDefenseDecision {
  return {
    action: 'withdraw',
    committedInfluence: 0,
    tactic: rule?.tactic ?? policy.defaultTactic,
    priority: rule?.priority ?? 0,
    reason,
  };
}

export function decideOfflineDefense(
  policy: GridOfflineDefensePolicy,
  context: GridOfflineDefenseContext,
): GridOfflineDefenseDecision {
  validateOfflineDefensePolicy(policy);

  for (const [label, value] of [
    ['reserveInfluenceAvailable', context.reserveInfluenceAvailable],
    ['currentDefenderInfluence', context.currentDefenderInfluence],
    ['cumulativeInfluenceLost', context.cumulativeInfluenceLost],
    ['minimumViableCommit', context.minimumViableCommit],
  ] as const) {
    if (!isNonNegativeInteger(value)) {
      throw new Error(`${label} must be a non-negative integer`);
    }
  }

  const rule = priorityRuleFor(context.targetTerritorySlug, policy);

  if (context.currentDefenderInfluence <= policy.autoRetreatBelowInfluence) {
    return withdrawDecision(policy, rule, 'retreat-threshold');
  }

  if (
    policy.autoRetreatAfterLosses > 0 &&
    context.cumulativeInfluenceLost >= policy.autoRetreatAfterLosses
  ) {
    return withdrawDecision(policy, rule, 'loss-threshold');
  }

  const commitBps = rule?.commitBps ?? policy.defaultCommitBps;
  const available = Math.min(
    policy.reserveInfluence,
    policy.maxCommitPerContest,
    context.reserveInfluenceAvailable,
  );
  const committedInfluence = Math.floor((available * commitBps) / 10_000);

  if (
    committedInfluence <= 0 ||
    committedInfluence < context.minimumViableCommit
  ) {
    return withdrawDecision(policy, rule, 'insufficient-reserve');
  }

  return {
    action: 'defend',
    committedInfluence,
    tactic: rule?.tactic ?? policy.defaultTactic,
    priority: rule?.priority ?? 0,
    reason: 'defend',
  };
}

export function rankOfflineDefenseTargets(
  territorySlugs: string[],
  policy: GridOfflineDefensePolicy,
): string[] {
  validateOfflineDefensePolicy(policy);
  const priorities = new Map(
    policy.priorityRules.map((rule) => [rule.territorySlug, rule.priority]),
  );

  return [...territorySlugs].sort((a, b) => {
    const delta = (priorities.get(b) ?? 0) - (priorities.get(a) ?? 0);
    return delta || a.localeCompare(b);
  });
}

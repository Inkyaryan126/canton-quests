import type {
  GridVisitorAction,
  GridVisitorActionReason,
  GridVisitorStanding,
} from '../core/visitor-economy-types';
import { evaluateGridVisitorActionReadiness } from './visitor-economy-service';
import type {
  GridVisitorEconomyAuthoritativeEvidencePort,
  GridVisitorEconomyPolicyPort,
} from './visitor-economy-policy-port';

export interface GridVisitorEconomyAuthorizationRequest {
  playerId: string;
  targetCitySlug: string;
  action: GridVisitorAction;
}

export type GridVisitorEconomyAuthorizationReason =
  | 'resident-allowed'
  | 'visitor-allowed'
  | 'policy-denied'
  | 'missing-policy'
  | 'contradictory-policy'
  | 'missing-evidence'
  | 'contradictory-evidence';

export type GridVisitorEconomyAuthorizationResult =
  | {
      allowed: true;
      reason: 'resident-allowed' | 'visitor-allowed';
      standing: GridVisitorStanding;
      coreReason: 'allowed';
    }
  | {
      allowed: false;
      reason: 'policy-denied';
      standing: GridVisitorStanding;
      coreReason: Exclude<GridVisitorActionReason, 'allowed'>;
    }
  | {
      allowed: false;
      reason: 'missing-policy';
    }
  | {
      allowed: false;
      reason: 'contradictory-policy';
      detail: 'policy-resolution-failed' | 'target-city-mismatch';
    }
  | {
      allowed: false;
      reason: 'missing-evidence';
      standing: GridVisitorStanding;
      missingFacts: string[];
    }
  | {
      allowed: false;
      reason: 'contradictory-evidence';
      detail: 'target-city-mismatch' | 'invalid-authoritative-evidence';
    };

export interface GridVisitorEconomyAuthorizationPorts {
  policy: GridVisitorEconomyPolicyPort;
  evidence: GridVisitorEconomyAuthoritativeEvidencePort;
}

function normalized(value: string): string {
  return value.trim();
}

function standingFromEvidence(
  targetCitySlug: string,
  homeCitySlug: string | null,
): GridVisitorStanding {
  if (homeCitySlug === null) return 'unassigned';
  return normalized(homeCitySlug) === normalized(targetCitySlug)
    ? 'home'
    : 'visitor';
}

export async function authorizeGridVisitorAction(
  ports: GridVisitorEconomyAuthorizationPorts,
  request: GridVisitorEconomyAuthorizationRequest,
): Promise<GridVisitorEconomyAuthorizationResult> {
  const targetCitySlug = normalized(request.targetCitySlug);
  let resolvedPolicy;
  try {
    resolvedPolicy = await ports.policy.resolvePolicy(targetCitySlug);
  } catch {
    return {
      allowed: false,
      reason: 'contradictory-policy',
      detail: 'policy-resolution-failed',
    };
  }
  if (!resolvedPolicy) return { allowed: false, reason: 'missing-policy' };

  if (normalized(resolvedPolicy.citySlug) !== targetCitySlug) {
    return {
      allowed: false,
      reason: 'contradictory-policy',
      detail: 'target-city-mismatch',
    };
  }

  let evidence;
  try {
    evidence = await ports.evidence.readEvidence(
      normalized(request.playerId),
      targetCitySlug,
    );
  } catch {
    return {
      allowed: false,
      reason: 'contradictory-evidence',
      detail: 'invalid-authoritative-evidence',
    };
  }

  if (normalized(evidence.targetCitySlug) !== targetCitySlug) {
    return {
      allowed: false,
      reason: 'contradictory-evidence',
      detail: 'target-city-mismatch',
    };
  }

  const standing = standingFromEvidence(targetCitySlug, evidence.homeCitySlug);
  try {
    const readiness = await evaluateGridVisitorActionReadiness(
      { readEvidence: async () => evidence },
      normalized(request.playerId),
      targetCitySlug,
      resolvedPolicy.policy,
      request.action,
    );

    if (readiness.status === 'incomplete') {
      return {
        allowed: false,
        reason: 'missing-evidence',
        standing,
        missingFacts: [...readiness.missingFacts],
      };
    }

    if (readiness.decision.allowed) {
      return {
        allowed: true,
        reason: standing === 'home' ? 'resident-allowed' : 'visitor-allowed',
        standing,
        coreReason: 'allowed',
      };
    }

    return {
      allowed: false,
      reason: 'policy-denied',
      standing,
      coreReason: readiness.decision.reason as Exclude<GridVisitorActionReason, 'allowed'>,
    };
  } catch {
    return {
      allowed: false,
      reason: 'contradictory-evidence',
      detail: 'invalid-authoritative-evidence',
    };
  }
}

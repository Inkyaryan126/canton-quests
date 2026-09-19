import {
  evaluateGridVisitorAction,
  projectGridVisitorEconomy,
  validateGridVisitorEconomyPolicy,
} from '../core/visitor-economy';
import type {
  GridVisitorAction,
  GridVisitorActionDecision,
  GridVisitorEconomyFacts,
  GridVisitorEconomyPolicy,
  GridVisitorEconomyProjection,
} from '../core/visitor-economy-types';
import type {
  GridVisitorEconomyEvidenceFact,
  GridVisitorEconomyEvidencePort,
} from './visitor-economy-port';

export type GridVisitorEconomyReadiness =
  | {
      status: 'ready';
      missingFacts: [];
      projection: GridVisitorEconomyProjection;
    }
  | {
      status: 'incomplete';
      missingFacts: GridVisitorEconomyEvidenceFact[];
      projection: null;
    };

export type GridVisitorActionReadiness =
  | {
      status: 'ready';
      missingFacts: [];
      decision: GridVisitorActionDecision;
    }
  | {
      status: 'incomplete';
      missingFacts: GridVisitorEconomyEvidenceFact[];
      decision: null;
    };

const NUMERIC_FACTS: GridVisitorEconomyEvidenceFact[] = [
  'localInvestmentCredits',
  'ownedPropertyCount',
  'deploymentsUsed',
  'residencyPoints',
];

function requireValue(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`Grid visitor economy requires ${field}`);
  return normalized;
}

function validateKnownFact(value: number | null, field: string): void {
  if (value === null) return;
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Grid visitor economy evidence ${field} must be a non-negative safe integer`);
  }
}

export async function readGridVisitorEconomyReadiness(
  port: GridVisitorEconomyEvidencePort,
  playerId: string,
  targetCitySlug: string,
  policy: GridVisitorEconomyPolicy,
): Promise<GridVisitorEconomyReadiness> {
  const normalizedPlayerId = requireValue(playerId, 'playerId');
  const normalizedTargetCitySlug = requireValue(targetCitySlug, 'targetCitySlug');
  validateGridVisitorEconomyPolicy(policy);

  const evidence = await port.readEvidence(
    normalizedPlayerId,
    normalizedTargetCitySlug,
  );
  if (evidence.targetCitySlug.trim() !== normalizedTargetCitySlug) {
    throw new Error('Grid visitor economy evidence target city mismatch');
  }
  if (evidence.homeCitySlug !== null && !evidence.homeCitySlug.trim()) {
    throw new Error('Grid visitor economy evidence Home City must be null or non-empty');
  }

  for (const fact of NUMERIC_FACTS) validateKnownFact(evidence[fact], fact);
  const missingFacts = NUMERIC_FACTS.filter((fact) => evidence[fact] === null);
  if (missingFacts.length > 0) {
    return { status: 'incomplete', missingFacts, projection: null };
  }

  const facts: GridVisitorEconomyFacts = {
    targetCitySlug: normalizedTargetCitySlug,
    homeCitySlug: evidence.homeCitySlug,
    localInvestmentCredits: evidence.localInvestmentCredits as number,
    ownedPropertyCount: evidence.ownedPropertyCount as number,
    deploymentsUsed: evidence.deploymentsUsed as number,
    residencyPoints: evidence.residencyPoints as number,
  };

  return {
    status: 'ready',
    missingFacts: [],
    projection: projectGridVisitorEconomy(policy, facts),
  };
}

const ACTION_EVIDENCE_FACT: Record<
  GridVisitorAction['type'],
  GridVisitorEconomyEvidenceFact
> = {
  invest: 'localInvestmentCredits',
  'acquire-property': 'ownedPropertyCount',
  deploy: 'deploymentsUsed',
};

export async function evaluateGridVisitorActionReadiness(
  port: GridVisitorEconomyEvidencePort,
  playerId: string,
  targetCitySlug: string,
  policy: GridVisitorEconomyPolicy,
  action: GridVisitorAction,
): Promise<GridVisitorActionReadiness> {
  const normalizedPlayerId = requireValue(playerId, 'playerId');
  const normalizedTargetCitySlug = requireValue(targetCitySlug, 'targetCitySlug');
  validateGridVisitorEconomyPolicy(policy);

  const evidence = await port.readEvidence(
    normalizedPlayerId,
    normalizedTargetCitySlug,
  );
  if (evidence.targetCitySlug.trim() !== normalizedTargetCitySlug) {
    throw new Error('Grid visitor economy evidence target city mismatch');
  }
  if (evidence.homeCitySlug !== null && !evidence.homeCitySlug.trim()) {
    throw new Error('Grid visitor economy evidence Home City must be null or non-empty');
  }

  const normalizedHomeCitySlug = evidence.homeCitySlug?.trim() ?? null;
  const isHomeCity = normalizedHomeCitySlug === normalizedTargetCitySlug;

  // Home City actions are never visitor-restricted, so visitor-only counters
  // must not become an availability dependency for those actions.
  if (isHomeCity) {
    const projection = projectGridVisitorEconomy(policy, {
      targetCitySlug: normalizedTargetCitySlug,
      homeCitySlug: normalizedHomeCitySlug,
      localInvestmentCredits: 0,
      ownedPropertyCount: 0,
      deploymentsUsed: 0,
      residencyPoints: 0,
    });
    return {
      status: 'ready',
      missingFacts: [],
      decision: evaluateGridVisitorAction(projection, action),
    };
  }

  const requiredFact = ACTION_EVIDENCE_FACT[action.type];
  const requiredValue = evidence[requiredFact];
  validateKnownFact(requiredValue, requiredFact);
  if (requiredValue === null) {
    return {
      status: 'incomplete',
      missingFacts: [requiredFact],
      decision: null,
    };
  }

  // Project with neutral placeholders only for counters the requested action
  // cannot observe. The relevant counter remains authoritative and Core still
  // owns the actual cap/limit decision.
  const facts: GridVisitorEconomyFacts = {
    targetCitySlug: normalizedTargetCitySlug,
    homeCitySlug: normalizedHomeCitySlug,
    localInvestmentCredits:
      action.type === 'invest' ? requiredValue : 0,
    ownedPropertyCount:
      action.type === 'acquire-property' ? requiredValue : 0,
    deploymentsUsed:
      action.type === 'deploy' ? requiredValue : 0,
    residencyPoints: 0,
  };

  return {
    status: 'ready',
    missingFacts: [],
    decision: evaluateGridVisitorAction(
      projectGridVisitorEconomy(policy, facts),
      action,
    ),
  };
}

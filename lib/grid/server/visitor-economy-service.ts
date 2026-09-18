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

export async function evaluateGridVisitorActionReadiness(
  port: GridVisitorEconomyEvidencePort,
  playerId: string,
  targetCitySlug: string,
  policy: GridVisitorEconomyPolicy,
  action: GridVisitorAction,
): Promise<GridVisitorActionReadiness> {
  const readiness = await readGridVisitorEconomyReadiness(
    port,
    playerId,
    targetCitySlug,
    policy,
  );
  if (readiness.status === 'incomplete') {
    return {
      status: 'incomplete',
      missingFacts: readiness.missingFacts,
      decision: null,
    };
  }

  return {
    status: 'ready',
    missingFacts: [],
    decision: evaluateGridVisitorAction(readiness.projection, action),
  };
}

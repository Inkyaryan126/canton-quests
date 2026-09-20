import { describe, expect, it, vi } from 'vitest';
import type { GridVisitorEconomyPolicy } from '../lib/grid/core/visitor-economy-types';
import type {
  GridVisitorEconomyAuthoritativeEvidencePort,
  GridVisitorEconomyPolicyPort,
} from '../lib/grid/server/visitor-economy-policy-port';
import { authorizeGridVisitorAction } from '../lib/grid/server/visitor-economy-authorization-service';

const POLICY: GridVisitorEconomyPolicy = {
  visitorInvestmentCapCredits: 1000,
  visitorPropertyLimit: 2,
  visitorDeploymentAllowance: 1,
  residencyThresholdPoints: 100,
};

function ports(
  evidence: Awaited<ReturnType<GridVisitorEconomyAuthoritativeEvidencePort['readEvidence']>>,
  policy: GridVisitorEconomyPolicy | null = POLICY,
) {
  const policyPort: GridVisitorEconomyPolicyPort = {
    resolvePolicy: vi.fn().mockResolvedValue(policy && {
      cityId: 'city-1',
      citySlug: 'city-002',
      seasonId: 'season-1',
      policy,
    }),
  };
  const evidencePort: GridVisitorEconomyAuthoritativeEvidencePort = {
    readEvidence: vi.fn().mockResolvedValue(evidence),
  };
  return { policyPort, evidencePort };
}

function evidence(overrides: Partial<Awaited<ReturnType<GridVisitorEconomyAuthoritativeEvidencePort['readEvidence']>>> = {}) {
  return {
    targetCitySlug: 'city-002',
    homeCitySlug: 'canton-oh',
    localInvestmentCredits: 100,
    ownedPropertyCount: 0,
    deploymentsUsed: 0,
    residencyPoints: 20,
    ...overrides,
  };
}

describe('Grid visitor economy authorization boundary', () => {
  it('allows a resident through the Core action decision semantics', async () => {
    const { policyPort, evidencePort } = ports(evidence({
      homeCitySlug: 'city-002',
      localInvestmentCredits: null,
    }));

    await expect(authorizeGridVisitorAction({ policy: policyPort, evidence: evidencePort }, {
      playerId: 'player-1',
      targetCitySlug: 'city-002',
      action: { type: 'invest', credits: 5000 },
    })).resolves.toEqual({
      allowed: true,
      reason: 'resident-allowed',
      standing: 'home',
      coreReason: 'allowed',
    });
  });

  it('allows a visitor when the authoritative counter is within policy', async () => {
    const { policyPort, evidencePort } = ports(evidence({ localInvestmentCredits: 100 }));

    await expect(authorizeGridVisitorAction({ policy: policyPort, evidence: evidencePort }, {
      playerId: 'player-1',
      targetCitySlug: 'city-002',
      action: { type: 'invest', credits: 500 },
    })).resolves.toEqual({
      allowed: true,
      reason: 'visitor-allowed',
      standing: 'visitor',
      coreReason: 'allowed',
    });
  });

  it('returns the Core denial reason when visitor policy denies the action', async () => {
    const { policyPort, evidencePort } = ports(evidence({ localInvestmentCredits: 900 }));

    await expect(authorizeGridVisitorAction({ policy: policyPort, evidence: evidencePort }, {
      playerId: 'player-1',
      targetCitySlug: 'city-002',
      action: { type: 'invest', credits: 200 },
    })).resolves.toEqual({
      allowed: false,
      reason: 'policy-denied',
      standing: 'visitor',
      coreReason: 'investment-cap',
    });
  });

  it('fails closed with a stable missing-policy reason', async () => {
    const { policyPort, evidencePort } = ports(evidence(), null);

    await expect(authorizeGridVisitorAction({ policy: policyPort, evidence: evidencePort }, {
      playerId: 'player-1',
      targetCitySlug: 'city-002',
      action: { type: 'deploy' },
    })).resolves.toEqual({
      allowed: false,
      reason: 'missing-policy',
    });
  });

  it('fails closed with the required missing evidence facts', async () => {
    const { policyPort, evidencePort } = ports(evidence({ deploymentsUsed: null }));

    await expect(authorizeGridVisitorAction({ policy: policyPort, evidence: evidencePort }, {
      playerId: 'player-1',
      targetCitySlug: 'city-002',
      action: { type: 'deploy' },
    })).resolves.toEqual({
      allowed: false,
      reason: 'missing-evidence',
      standing: 'visitor',
      missingFacts: ['deploymentsUsed'],
    });
  });

  it('fails closed with a deterministic contradiction reason', async () => {
    const { policyPort, evidencePort } = ports(evidence({ targetCitySlug: 'other-city' }));

    const request = {
      playerId: 'player-1',
      targetCitySlug: 'city-002',
      action: { type: 'deploy' as const },
    };
    const first = await authorizeGridVisitorAction({ policy: policyPort, evidence: evidencePort }, request);
    const second = await authorizeGridVisitorAction({ policy: policyPort, evidence: evidencePort }, request);

    expect(first).toEqual({
      allowed: false,
      reason: 'contradictory-evidence',
      detail: 'target-city-mismatch',
    });
    expect(second).toEqual(first);
  });
});

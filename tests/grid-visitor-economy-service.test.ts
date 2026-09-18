import { describe, expect, it, vi } from 'vitest';
import type { GridVisitorEconomyPolicy } from '../lib/grid/core/visitor-economy-types';
import type { GridVisitorEconomyEvidencePort } from '../lib/grid/server/visitor-economy-port';
import {
  evaluateGridVisitorActionReadiness,
  readGridVisitorEconomyReadiness,
} from '../lib/grid/server/visitor-economy-service';

const POLICY: GridVisitorEconomyPolicy = {
  visitorInvestmentCapCredits: 1000,
  visitorPropertyLimit: 3,
  visitorDeploymentAllowance: 2,
  residencyThresholdPoints: 100,
};

function port(overrides: Partial<Awaited<ReturnType<GridVisitorEconomyEvidencePort['readEvidence']>>> = {}): GridVisitorEconomyEvidencePort {
  return {
    readEvidence: vi.fn().mockResolvedValue({
      targetCitySlug: 'city-002',
      homeCitySlug: 'canton-oh',
      localInvestmentCredits: 400,
      ownedPropertyCount: 1,
      deploymentsUsed: 1,
      residencyPoints: 40,
      ...overrides,
    }),
  };
}

describe('Grid visitor economy server readiness', () => {
  it('projects visitor restrictions only when every authoritative fact is available', async () => {
    const result = await readGridVisitorEconomyReadiness(
      port(), 'player-1', 'city-002', POLICY,
    );
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') throw new Error('expected ready visitor evidence');
    expect(result.projection.standing).toBe('visitor');
    expect(result.projection.investmentRemainingCredits).toBe(600);
    expect(result.projection.propertySlotsRemaining).toBe(2);
    expect(result.projection.deploymentsRemaining).toBe(1);
    expect(result.projection.residency.eligible).toBe(false);
  });

  it('reports missing evidence instead of silently substituting zeroes', async () => {
    await expect(readGridVisitorEconomyReadiness(
      port({ deploymentsUsed: null, residencyPoints: null }),
      'player-1', 'city-002', POLICY,
    )).resolves.toEqual({
      status: 'incomplete',
      missingFacts: ['deploymentsUsed', 'residencyPoints'],
      projection: null,
    });
  });

  it('returns no action decision while evidence is incomplete', async () => {
    await expect(evaluateGridVisitorActionReadiness(
      port({ deploymentsUsed: null }),
      'player-1', 'city-002', POLICY,
      { type: 'acquire-property' },
    )).resolves.toEqual({
      status: 'incomplete',
      missingFacts: ['deploymentsUsed'],
      decision: null,
    });
  });

  it('delegates to Core only after evidence becomes ready', async () => {
    const result = await evaluateGridVisitorActionReadiness(
      port({ localInvestmentCredits: 950 }),
      'player-1', 'city-002', POLICY,
      { type: 'invest', credits: 75 },
    );
    expect(result).toEqual({
      status: 'ready',
      missingFacts: [],
      decision: { allowed: false, reason: 'investment-cap' },
    });
  });

  it('treats missing Home City as legitimate unassigned standing, not missing evidence', async () => {
    const result = await readGridVisitorEconomyReadiness(
      port({ homeCitySlug: null }), 'player-1', 'city-002', POLICY,
    );
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') throw new Error('expected ready unassigned evidence');
    expect(result.projection.standing).toBe('unassigned');
    expect(result.projection.restrictionsApply).toBe(true);
  });

  it('validates known evidence even when some other fact is unavailable', async () => {
    await expect(readGridVisitorEconomyReadiness(
      port({ localInvestmentCredits: -1, deploymentsUsed: null }),
      'player-1', 'city-002', POLICY,
    )).rejects.toThrow('localInvestmentCredits must be a non-negative safe integer');
  });

  it('rejects mismatched target evidence and malformed identity before projecting', async () => {
    await expect(readGridVisitorEconomyReadiness(
      port({ targetCitySlug: 'wrong-city' }), 'player-1', 'city-002', POLICY,
    )).rejects.toThrow('target city mismatch');

    const p = port();
    await expect(readGridVisitorEconomyReadiness(
      p, ' ', 'city-002', POLICY,
    )).rejects.toThrow('requires playerId');
    expect(p.readEvidence).not.toHaveBeenCalled();
  });
});

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  evaluateGridCityWealthTransfer,
  evaluateGridVisitorAction,
  projectGridVisitorEconomy,
  validateGridVisitorEconomyPolicy,
} from '../lib/grid/core/visitor-economy';

const policy = {
  visitorInvestmentCapCredits: 500,
  visitorPropertyLimit: 2,
  visitorDeploymentAllowance: 3,
  residencyThresholdPoints: 100,
};

describe('Grid visitor economy core', () => {
  it('does not apply visitor caps inside the player home city', () => {
    const projection = projectGridVisitorEconomy(policy, {
      targetCitySlug: 'city-a',
      homeCitySlug: 'city-a',
      localInvestmentCredits: 900,
      ownedPropertyCount: 7,
      deploymentsUsed: 8,
      residencyPoints: 0,
    });

    expect(projection.standing).toBe('home');
    expect(projection.restrictionsApply).toBe(false);
    expect(projection.investmentCapCredits).toBeNull();
    expect(projection.propertyLimit).toBeNull();
    expect(projection.deploymentAllowance).toBeNull();
    expect(
      evaluateGridVisitorAction(projection, {
        type: 'invest',
        credits: 50_000,
      }),
    ).toEqual({ allowed: true, reason: 'allowed' });
  });

  it('projects visitor investment, property, and deployment limits from local city state', () => {
    const projection = projectGridVisitorEconomy(policy, {
      targetCitySlug: 'city-b',
      homeCitySlug: 'city-a',
      localInvestmentCredits: 425,
      ownedPropertyCount: 1,
      deploymentsUsed: 2,
      residencyPoints: 40,
    });

    expect(projection.standing).toBe('visitor');
    expect(projection.investmentRemainingCredits).toBe(75);
    expect(projection.propertySlotsRemaining).toBe(1);
    expect(projection.deploymentsRemaining).toBe(1);

    expect(
      evaluateGridVisitorAction(projection, {
        type: 'invest',
        credits: 75,
      }),
    ).toEqual({ allowed: true, reason: 'allowed' });
    expect(
      evaluateGridVisitorAction(projection, {
        type: 'invest',
        credits: 76,
      }),
    ).toEqual({ allowed: false, reason: 'investment-cap' });
  });

  it('treats an unassigned Home City as visitor-restricted so missing profile state cannot bypass caps', () => {
    const projection = projectGridVisitorEconomy(policy, {
      targetCitySlug: 'city-b',
      homeCitySlug: null,
      localInvestmentCredits: 500,
      ownedPropertyCount: 2,
      deploymentsUsed: 3,
      residencyPoints: 0,
    });

    expect(projection.standing).toBe('unassigned');
    expect(projection.restrictionsApply).toBe(true);
    expect(
      evaluateGridVisitorAction(projection, {
        type: 'acquire-property',
      }),
    ).toEqual({ allowed: false, reason: 'property-limit' });
    expect(
      evaluateGridVisitorAction(projection, { type: 'deploy' }),
    ).toEqual({ allowed: false, reason: 'deployment-limit' });
  });

  it('reports residency eligibility without silently lifting visitor caps', () => {
    const projection = projectGridVisitorEconomy(policy, {
      targetCitySlug: 'city-b',
      homeCitySlug: 'city-a',
      localInvestmentCredits: 500,
      ownedPropertyCount: 2,
      deploymentsUsed: 3,
      residencyPoints: 100,
    });

    expect(projection.residency).toEqual({
      points: 100,
      threshold: 100,
      eligible: true,
    });
    expect(projection.restrictionsApply).toBe(true);
    expect(projection.investmentRemainingCredits).toBe(0);
    expect(projection.propertySlotsRemaining).toBe(0);
  });

  it('hard-blocks local wealth movement between different city economies', () => {
    expect(
      evaluateGridCityWealthTransfer({
        sourceCitySlug: 'city-a',
        targetCitySlug: 'city-b',
        credits: 1,
        influence: 0,
        commandPoints: 0,
      }),
    ).toEqual({
      allowed: false,
      reason: 'cross-city-wealth-disabled',
    });

    expect(
      evaluateGridCityWealthTransfer({
        sourceCitySlug: 'city-a',
        targetCitySlug: 'city-a',
        credits: 100,
        influence: 20,
        commandPoints: 3,
      }),
    ).toEqual({ allowed: true, reason: 'same-city' });
  });

  it('allows an empty cross-city request because no local wealth actually moves', () => {
    expect(
      evaluateGridCityWealthTransfer({
        sourceCitySlug: 'city-a',
        targetCitySlug: 'city-b',
        credits: 0,
        influence: 0,
        commandPoints: 0,
      }),
    ).toEqual({ allowed: true, reason: 'no-local-wealth' });
  });

  it('fails closed on malformed tuning or negative local state', () => {
    expect(() =>
      validateGridVisitorEconomyPolicy({
        ...policy,
        visitorPropertyLimit: -1,
      }),
    ).toThrow(/property limit/);

    expect(() =>
      projectGridVisitorEconomy(policy, {
        targetCitySlug: 'city-b',
        homeCitySlug: 'city-a',
        localInvestmentCredits: -1,
        ownedPropertyCount: 0,
        deploymentsUsed: 0,
        residencyPoints: 0,
      }),
    ).toThrow(/local investment credits/);
  });

  it('remains city-agnostic with no launch-city names in universal Core', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'lib/grid/core/visitor-economy.ts'),
      'utf8',
    );
    expect(source.toLowerCase()).not.toContain('canton');
    expect(source.toLowerCase()).not.toContain('akron');
  });
});

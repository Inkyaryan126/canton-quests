import { describe, expect, it } from 'vitest';
import {
  projectGridNpcStronghold,
  validateGridNpcStrongholdConfig,
} from '../lib/grid/core/npc-strongholds';
import type {
  GridNpcStrongholdConfig,
  GridNpcStrongholdContext,
} from '../lib/grid/core/npc-stronghold-types';

const config: GridNpcStrongholdConfig = {
  strongholdId: 'guardian-mckinley',
  factionId: 'neutral-guardians',
  territorySlug: 'monument-core',
  landmarkSlug: 'mckinley-monument',
  activation: 'season',
  baseGarrisonInfluence: 100,
  maxGarrisonInfluence: 200,
  pressureReinforcementBps: 5_000,
  surgeReinforcementBps: 4_000,
};

const context: GridNpcStrongholdContext = {
  seasonActive: true,
  eventActive: false,
  surgeIntensityBps: 5_000,
  factionPressureBps: 6_000,
  captured: false,
};

describe('Grid NPC strongholds', () => {
  it('activates a season stronghold and scales garrison from pressure plus Surge', () => {
    const projection = projectGridNpcStronghold(config, context);

    expect(projection).toEqual({
      strongholdId: 'guardian-mckinley',
      status: 'active',
      activationReason: 'season',
      contestable: true,
      baseGarrisonInfluence: 100,
      reinforcementInfluence: 50,
      garrisonInfluence: 150,
      objective: {
        kind: 'pve-landmark',
        factionId: 'neutral-guardians',
        territorySlug: 'monument-core',
        landmarkSlug: 'mckinley-monument',
      },
    });
  });

  it('keeps an event-gated stronghold dormant until the event is active', () => {
    const eventConfig = { ...config, activation: 'event' as const };
    const dormant = projectGridNpcStronghold(eventConfig, context);
    const active = projectGridNpcStronghold(eventConfig, {
      ...context,
      eventActive: true,
    });

    expect(dormant.status).toBe('dormant');
    expect(dormant.contestable).toBe(false);
    expect(dormant.garrisonInfluence).toBe(0);
    expect(active.status).toBe('active');
    expect(active.activationReason).toBe('event');
  });

  it('uses Surge presence to activate surge-gated strongholds', () => {
    const surgeConfig = { ...config, activation: 'surge' as const };

    expect(
      projectGridNpcStronghold(surgeConfig, {
        ...context,
        surgeIntensityBps: 0,
      }).status,
    ).toBe('dormant');
    expect(projectGridNpcStronghold(surgeConfig, context).status).toBe('active');
    expect(
      projectGridNpcStronghold(surgeConfig, context).activationReason,
    ).toBe('surge');
  });

  it('marks captured strongholds non-contestable with no remaining garrison', () => {
    const projection = projectGridNpcStronghold(config, {
      ...context,
      captured: true,
    });

    expect(projection.status).toBe('captured');
    expect(projection.contestable).toBe(false);
    expect(projection.reinforcementInfluence).toBe(0);
    expect(projection.garrisonInfluence).toBe(0);
    expect(projection.activationReason).toBeNull();
  });

  it('applies full pressure and Surge reinforcement within the garrison ceiling', () => {
    const projection = projectGridNpcStronghold(config, {
      ...context,
      factionPressureBps: 10_000,
      surgeIntensityBps: 10_000,
    });

    expect(projection.reinforcementInfluence).toBe(90);
    expect(projection.garrisonInfluence).toBe(190);
  });

  it('creates territory PvE objectives when no landmark is configured', () => {
    const projection = projectGridNpcStronghold(
      { ...config, landmarkSlug: undefined },
      context,
    );

    expect(projection.objective).toEqual({
      kind: 'pve-territory',
      factionId: 'neutral-guardians',
      territorySlug: 'monument-core',
    });
  });

  it('caps combined reinforcement at the configured garrison ceiling', () => {
    const projection = projectGridNpcStronghold(
      {
        ...config,
        pressureReinforcementBps: 10_000,
        surgeReinforcementBps: 10_000,
      },
      {
        ...context,
        factionPressureBps: 10_000,
        surgeIntensityBps: 10_000,
      },
    );

    expect(projection.reinforcementInfluence).toBe(100);
    expect(projection.garrisonInfluence).toBe(200);
  });

  it('rejects malformed stronghold tuning', () => {
    expect(() =>
      validateGridNpcStrongholdConfig({
        ...config,
        strongholdId: ' ',
      }),
    ).toThrow(/stronghold id cannot be blank/);

    expect(() =>
      validateGridNpcStrongholdConfig({
        ...config,
        maxGarrisonInfluence: 99,
      }),
    ).toThrow(/maxGarrisonInfluence cannot be below baseGarrisonInfluence/);

    expect(() =>
      validateGridNpcStrongholdConfig({
        ...config,
        pressureReinforcementBps: 10_001,
      }),
    ).toThrow(/pressureReinforcementBps/);
  });

  it('rejects event and Surge state outside an active season', () => {
    expect(() =>
      projectGridNpcStronghold(config, {
        ...context,
        seasonActive: false,
        eventActive: true,
        surgeIntensityBps: 0,
      }),
    ).toThrow(/eventActive requires an active season/);

    expect(() =>
      projectGridNpcStronghold(config, {
        ...context,
        seasonActive: false,
        eventActive: false,
        surgeIntensityBps: 1,
      }),
    ).toThrow(/surgeIntensityBps requires an active season/);
  });
});

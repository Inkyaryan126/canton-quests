import { describe, expect, it } from 'vitest';
import { resolveGridTakeoverDamage } from '../lib/grid/core/takeover-damage';

describe('Grid takeover damage', () => {
  it('retains configured development and applies deterministic condition damage', () => {
    expect(
      resolveGridTakeoverDamage(
        { developmentLevel: 3, conditionBps: 10_000 },
        {
          developmentRetentionBps: 5_000,
          conditionDamageBps: 3_000,
          conditionFloorBps: 4_000,
        },
      ),
    ).toEqual({
      retainedDevelopmentLevel: 1,
      developmentLevelsLost: 2,
      conditionBps: 7_000,
      conditionLostBps: 3_000,
      repairRequiredBps: 3_000,
    });
  });

  it('floors fractional retained levels using integer arithmetic', () => {
    const result = resolveGridTakeoverDamage(
      { developmentLevel: 3, conditionBps: 10_000 },
      {
        developmentRetentionBps: 6_667,
        conditionDamageBps: 0,
        conditionFloorBps: 0,
      },
    );

    expect(result.retainedDevelopmentLevel).toBe(2);
    expect(result.developmentLevelsLost).toBe(1);
  });

  it('respects the configured condition floor without repairing prior damage', () => {
    const healthy = resolveGridTakeoverDamage(
      { developmentLevel: 2, conditionBps: 8_000 },
      {
        developmentRetentionBps: 10_000,
        conditionDamageBps: 5_000,
        conditionFloorBps: 5_000,
      },
    );
    expect(healthy.conditionBps).toBe(5_000);

    const alreadyDamaged = resolveGridTakeoverDamage(
      { developmentLevel: 2, conditionBps: 3_000 },
      {
        developmentRetentionBps: 10_000,
        conditionDamageBps: 1_000,
        conditionFloorBps: 5_000,
      },
    );

    expect(alreadyDamaged.conditionBps).toBe(3_000);
    expect(alreadyDamaged.conditionLostBps).toBe(0);
    expect(alreadyDamaged.repairRequiredBps).toBe(7_000);
  });

  it('supports explicit no-damage and total-development-loss policies', () => {
    const unchanged = resolveGridTakeoverDamage(
      { developmentLevel: 4, conditionBps: 9_000 },
      {
        developmentRetentionBps: 10_000,
        conditionDamageBps: 0,
        conditionFloorBps: 0,
      },
    );
    expect(unchanged.retainedDevelopmentLevel).toBe(4);
    expect(unchanged.conditionBps).toBe(9_000);

    const wiped = resolveGridTakeoverDamage(
      { developmentLevel: 4, conditionBps: 9_000 },
      {
        developmentRetentionBps: 0,
        conditionDamageBps: 9_000,
        conditionFloorBps: 0,
      },
    );
    expect(wiped.retainedDevelopmentLevel).toBe(0);
    expect(wiped.conditionBps).toBe(0);
    expect(wiped.repairRequiredBps).toBe(10_000);
  });

  it('rejects malformed levels and basis-point values', () => {
    expect(() =>
      resolveGridTakeoverDamage(
        { developmentLevel: -1, conditionBps: 10_000 },
        {
          developmentRetentionBps: 5_000,
          conditionDamageBps: 1_000,
          conditionFloorBps: 0,
        },
      ),
    ).toThrow(/developmentLevel/);

    expect(() =>
      resolveGridTakeoverDamage(
        { developmentLevel: 1, conditionBps: 10_001 },
        {
          developmentRetentionBps: 5_000,
          conditionDamageBps: 1_000,
          conditionFloorBps: 0,
        },
      ),
    ).toThrow(/conditionBps/);

    expect(() =>
      resolveGridTakeoverDamage(
        { developmentLevel: 1, conditionBps: 10_000 },
        {
          developmentRetentionBps: 10_001,
          conditionDamageBps: 1_000,
          conditionFloorBps: 0,
        },
      ),
    ).toThrow(/developmentRetentionBps/);
  });
});

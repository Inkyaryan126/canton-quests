import { describe, expect, it } from 'vitest';
import {
  projectGridCityPower,
  validateGridCityPowerConfig,
} from '../lib/grid/core/city-power';
import type {
  GridCityPowerComponentConfig,
  GridCityPowerConfig,
} from '../lib/grid/core/city-power-types';

const component = (
  id: string,
  weightBps: number,
): GridCityPowerComponentConfig => ({
  id,
  weightBps,
  rawCap: 100,
  curve: [
    { rawValue: 50, attainmentBps: 6_000 },
    { rawValue: 100, attainmentBps: 10_000 },
  ],
});

const config: GridCityPowerConfig = {
  maxSingleComponentWeightBps: 3_000,
  components: [
    component('territory-control', 2_500),
    component('economic-strength', 2_500),
    component('contest-performance', 2_500),
    component('prestige', 2_500),
  ],
};

describe('Grid City Power', () => {
  it('projects zero power when no configured metric has progress', () => {
    const projection = projectGridCityPower({}, config);

    expect(projection.cityPowerBps).toBe(0);
    expect(projection.breakdown).toHaveLength(4);
    expect(projection.breakdown.every((item) => item.rawValue === 0)).toBe(true);
    expect(projection.ignoredMetricIds).toEqual([]);
  });

  it('uses the configured piecewise curve and weights deterministically', () => {
    const projection = projectGridCityPower(
      {
        'territory-control': 25,
        'economic-strength': 50,
        'contest-performance': 100,
      },
      config,
    );

    expect(projection.cityPowerBps).toBe(4_750);
    expect(
      projection.breakdown.map((item) => [
        item.id,
        item.attainmentBps,
        item.contributedPowerBps,
      ]),
    ).toEqual([
      ['territory-control', 3_000, 750],
      ['economic-strength', 6_000, 1_500],
      ['contest-performance', 10_000, 2_500],
      ['prestige', 0, 0],
    ]);
  });

  it('caps oversized metrics so one strategy cannot exceed its configured weight', () => {
    const projection = projectGridCityPower(
      { 'territory-control': 99_999 },
      config,
    );
    const territory = projection.breakdown[0];

    expect(territory.capped).toBe(true);
    expect(territory.cappedRawValue).toBe(100);
    expect(territory.attainmentBps).toBe(10_000);
    expect(territory.contributedPowerBps).toBe(2_500);
    expect(projection.cityPowerBps).toBe(2_500);
  });
  it('reports unconfigured metrics instead of silently scoring them', () => {
    const projection = projectGridCityPower(
      {
        prestige: 10,
        'mystery-score': 999,
        'alpha-score': 1,
      },
      config,
    );

    expect(projection.ignoredMetricIds).toEqual([
      'alpha-score',
      'mystery-score',
    ]);
    expect(
      projection.breakdown.find((item) => item.id === 'prestige')
        ?.contributedPowerBps,
    ).toBe(300);
  });

  it('requires weights to total exactly 10000 and respect the per-component ceiling', () => {
    expect(() =>
      validateGridCityPowerConfig({
        ...config,
        components: config.components.slice(0, 3),
      }),
    ).toThrow(/must total exactly 10000/);

    expect(() =>
      validateGridCityPowerConfig({
        ...config,
        components: [
          component('territory-control', 3_500),
          component('economic-strength', 2_500),
          component('contest-performance', 2_000),
          component('prestige', 2_000),
        ],
      }),
    ).toThrow(/exceeds maxSingleComponentWeightBps/);
  });

  it('rejects duplicate ids and malformed curves', () => {
    expect(() =>
      validateGridCityPowerConfig({
        ...config,
        components: [
          component('duplicate', 2_500),
          component('duplicate', 2_500),
          component('contest-performance', 2_500),
          component('prestige', 2_500),
        ],
      }),
    ).toThrow(/Duplicate City Power component id/);

    const malformed = component('bad-curve', 2_500);
    malformed.curve = [
      { rawValue: 60, attainmentBps: 6_000 },
      { rawValue: 50, attainmentBps: 10_000 },
    ];
    expect(() =>
      validateGridCityPowerConfig({
        ...config,
        components: [
          malformed,
          component('economic-strength', 2_500),
          component('contest-performance', 2_500),
          component('prestige', 2_500),
        ],
      }),
    ).toThrow(/curve rawValue must increase/);
  });

  it('requires every curve to finish at rawCap and full attainment', () => {
    const wrongCap = component('wrong-cap', 2_500);
    wrongCap.curve = [
      { rawValue: 50, attainmentBps: 6_000 },
      { rawValue: 90, attainmentBps: 10_000 },
    ];

    expect(() =>
      validateGridCityPowerConfig({
        ...config,
        components: [
          wrongCap,
          component('economic-strength', 2_500),
          component('contest-performance', 2_500),
          component('prestige', 2_500),
        ],
      }),
    ).toThrow(/curve must end at rawCap/);
    const wrongAttainment = component('wrong-attainment', 2_500);
    wrongAttainment.curve = [
      { rawValue: 50, attainmentBps: 6_000 },
      { rawValue: 100, attainmentBps: 9_999 },
    ];

    expect(() =>
      validateGridCityPowerConfig({
        ...config,
        components: [
          wrongAttainment,
          component('economic-strength', 2_500),
          component('contest-performance', 2_500),
          component('prestige', 2_500),
        ],
      }),
    ).toThrow(/curve must end at 10000 attainmentBps/);
  });

  it('rejects negative or unsafe metric values before scoring', () => {
    expect(() =>
      projectGridCityPower(
        { 'territory-control': -1 },
        config,
      ),
    ).toThrow(/must be a non-negative safe integer/);

    expect(() =>
      projectGridCityPower(
        { 'territory-control': Number.MAX_SAFE_INTEGER + 1 },
        config,
      ),
    ).toThrow(/must be a non-negative safe integer/);
  });
});

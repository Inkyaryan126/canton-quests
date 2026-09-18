import type {
  GridCityPowerComponentConfig,
  GridCityPowerConfig,
} from '../../core/city-power-types';

function diminishingCurve(rawCap: number): GridCityPowerComponentConfig['curve'] {
  return [
    { rawValue: Math.floor(rawCap / 4), attainmentBps: 3500 },
    { rawValue: Math.floor(rawCap / 2), attainmentBps: 6800 },
    { rawValue: rawCap, attainmentBps: 10000 },
  ];
}

export const cantonFoundingSeasonCityPower: GridCityPowerConfig = {
  maxSingleComponentWeightBps: 2500,
  components: [
    {
      id: 'territoryControl',
      weightBps: 2200,
      rawCap: 10000,
      curve: diminishingCurve(10000),
    },
    {
      id: 'propertyValue',
      weightBps: 1800,
      rawCap: 250000,
      curve: diminishingCurve(250000),
    },
    {
      id: 'influence',
      weightBps: 1400,
      rawCap: 10000,
      curve: diminishingCurve(10000),
    },
    {
      id: 'challengeRating',
      weightBps: 1600,
      rawCap: 2000,
      curve: diminishingCurve(2000),
    },
    {
      id: 'seasonScore',
      weightBps: 1600,
      rawCap: 10000,
      curve: diminishingCurve(10000),
    },
    {
      id: 'cityMastery',
      weightBps: 1400,
      rawCap: 100,
      curve: diminishingCurve(100),
    },
  ],
};

import type { GridEconomyConfig } from '../../core/economy-types';

const cost = (credits: number, commandPoints: number) => ({
  credits,
  commandPoints,
});

const level = (
  levelNumber: number,
  credits: number,
  commandPoints: number,
  bonuses: GridEconomyConfig['development']['commerce']['levels'][number]['bonuses'],
) => ({
  level: levelNumber,
  cost: cost(credits, commandPoints),
  bonuses,
});

/**
 * Initial Founding Season balance seed.
 * These values are intentionally tunable and must stay supported by
 * deterministic simulation output before any production activation.
 */
export const cantonFoundingSeasonEconomy: GridEconomyConfig = {
  offlineAccrualCapMinutes: 12 * 60,
  neutralClaims: {
    defaultCost: cost(900, 2),
    starterTerritorySlugs: [
      'census-block-391517001002029',
      'census-block-391517001002040',
      'census-block-391517001002041',
      'census-block-391517001002048',
      'census-block-391517001002028',
      'census-block-391517001002042',
    ],
  },
  income: {
    territories: {
      defaultRate: { creditsPerHour: 2, influencePerHour: 1 },
    },
    properties: {
      defaultRate: { creditsPerHour: 4, influencePerHour: 1 },
    },
  },
  propertyAcquisition: {
    requireTerritoryControl: true,
    defaultCost: cost(1500, 2),
  },
  development: {
    commerce: {
      levels: [
        level(1, 900, 1, { creditsPerHour: 3 }),
        level(2, 1800, 2, { creditsPerHour: 5 }),
        level(3, 3200, 3, { creditsPerHour: 8 }),
      ],
    },
    influence: {
      levels: [
        level(1, 900, 1, { influencePerHour: 2 }),
        level(2, 1800, 2, { influencePerHour: 4 }),
        level(3, 3200, 3, { influencePerHour: 7 }),
      ],
    },
    fortress: {
      levels: [
        level(1, 900, 1, { defenseBps: 750 }),
        level(2, 1800, 2, { defenseBps: 1000 }),
        level(3, 3200, 3, { defenseBps: 1500 }),
      ],
    },
    intel: {
      levels: [
        level(1, 900, 1, { intelBps: 750 }),
        level(2, 1800, 2, { intelBps: 1000 }),
        level(3, 3200, 3, { intelBps: 1500 }),
      ],
    },
    prestige: {
      levels: [
        level(1, 900, 1, { influencePerHour: 1, prestigeBps: 750 }),
        level(2, 1800, 2, { influencePerHour: 2, prestigeBps: 1000 }),
        level(3, 3200, 3, { influencePerHour: 3, prestigeBps: 1500 }),
      ],
    },
  },
  skyline: {
    rules: [
      {
        id: 'connected-pair',
        minDevelopedProperties: 2,
        branchMode: 'any',
        bonuses: { creditsPerHour: 3 },
      },
      {
        id: 'mixed-three',
        minDevelopedProperties: 3,
        branchMode: 'mixed',
        bonuses: { creditsPerHour: 2, influencePerHour: 2 },
      },
      {
        id: 'focused-three',
        minDevelopedProperties: 3,
        branchMode: 'single-branch',
        bonuses: { creditsPerHour: 5, prestigeBps: 250 },
      },
    ],
  },
};

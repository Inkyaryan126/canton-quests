import { describe, expect, it } from 'vitest';
import type { GridDevelopmentConfig } from '../lib/grid/core/economy-types';
import {
  getDevelopmentBonusesThroughLevel,
  getNextDevelopmentLevel,
} from '../lib/grid/core/development';

function development(): GridDevelopmentConfig {
  const one = { levels: [{ level: 1, cost: { credits: 10, commandPoints: 0 }, bonuses: {} }] };
  return {
    commerce: {
      levels: [
        { level: 1, cost: { credits: 13, commandPoints: 1 }, bonuses: { creditsPerHour: 2 } },
        { level: 2, cost: { credits: 777, commandPoints: 3 }, bonuses: { creditsPerHour: 5, prestigeBps: 50 } },
      ],
    },
    influence: {
      levels: [
        { level: 1, cost: { credits: 21, commandPoints: 0 }, bonuses: { influencePerHour: 3 } },
      ],
    },
    fortress: one,
    intel: one,
    prestige: one,
  };
}

describe('development configuration primitives', () => {
  it('returns the exact configured next level instead of applying a cost formula', () => {
    const config = development();

    expect(getNextDevelopmentLevel(config, 'commerce', 0)).toEqual(config.commerce.levels[0]);
    expect(getNextDevelopmentLevel(config, 'commerce', 1)).toEqual(config.commerce.levels[1]);
    expect(getNextDevelopmentLevel(config, 'commerce', 2)).toBeNull();
  });

  it('aggregates only explicitly configured bonuses through the current level', () => {
    expect(getDevelopmentBonusesThroughLevel(development(), 'commerce', 2)).toEqual({
      creditsPerHour: 7,
      influencePerHour: 0,
      defenseBps: 0,
      intelBps: 0,
      prestigeBps: 50,
    });
  });

  it('keeps branches independent', () => {
    expect(getDevelopmentBonusesThroughLevel(development(), 'influence', 1)).toEqual({
      creditsPerHour: 0,
      influencePerHour: 3,
      defenseBps: 0,
      intelBps: 0,
      prestigeBps: 0,
    });
  });
});

import { describe, expect, it } from 'vitest';
import {
  applyGridContractProgress,
  createGridContractInstance,
  expireGridContractInstance,
} from '../lib/grid/core/contracts';
import type { GridContractDefinition } from '../lib/grid/core/contract-types';

const definition: GridContractDefinition = {
  id: 'contract-alpha',
  kind: 'seasonal',
  objectives: [
    { id: 'claim-territories', target: 2 },
    { id: 'win-contest', target: 1 },
  ],
  reward: { credits: 500, influence: 25, commandPoints: 1 },
  locationEnhancement: {
    bonusReward: { credits: 100, influence: 0, commandPoints: 0 },
  },
};

describe('GRID contract core', () => {
  it('creates deterministic active progress for every objective', () => {
    const instance = createGridContractInstance(definition, {
      playerId: 'player-1',
      acceptedAtMs: 1_000,
      expiresAtMs: 10_000,
    });    expect(instance).toEqual({
      contractId: 'contract-alpha',
      playerId: 'player-1',
      status: 'active',
      acceptedAtMs: 1_000,
      expiresAtMs: 10_000,
      completedAtMs: null,
      locationEnhanced: false,
      progress: { 'claim-territories': 0, 'win-contest': 0 },
    });
  });

  it('caps progress and emits rewards only when every objective completes', () => {
    const initial = createGridContractInstance(definition, {
      playerId: 'player-1', acceptedAtMs: 1_000, expiresAtMs: 10_000,
    });
    const first = applyGridContractProgress(definition, initial, {
      objectiveId: 'claim-territories', amount: 99, nowMs: 2_000,
    });
    expect(first.instance.progress['claim-territories']).toBe(2);
    expect(first.instance.status).toBe('active');
    expect(first.rewardIntent).toBeNull();
    expect(initial.progress['claim-territories']).toBe(0);

    const completed = applyGridContractProgress(definition, first.instance, {
      objectiveId: 'win-contest', amount: 1, nowMs: 3_000,
    });    expect(completed.completedNow).toBe(true);
    expect(completed.instance.status).toBe('completed');
    expect(completed.instance.completedAtMs).toBe(3_000);
    expect(completed.rewardIntent).toEqual(definition.reward);
    expect(completed.locationBonusIntent).toBeNull();
  });

  it('keeps location enhancement optional and only adds a completion bonus', () => {
    const initial = createGridContractInstance(definition, {
      playerId: 'player-2', acceptedAtMs: 1_000, expiresAtMs: null,
    });
    const first = applyGridContractProgress(definition, initial, {
      objectiveId: 'claim-territories', amount: 2, nowMs: 2_000, locationEnhanced: true,
    });
    expect(first.instance.locationEnhanced).toBe(true);
    expect(first.instance.status).toBe('active');

    const completed = applyGridContractProgress(definition, first.instance, {
      objectiveId: 'win-contest', amount: 1, nowMs: 3_000,
    });
    expect(completed.instance.status).toBe('completed');
    expect(completed.rewardIntent).toEqual(definition.reward);
    expect(completed.locationBonusIntent).toEqual(definition.locationEnhancement?.bonusReward);
  });

  it('expires before applying late progress', () => {
    const initial = createGridContractInstance(definition, {
      playerId: 'player-3', acceptedAtMs: 1_000, expiresAtMs: 2_000,
    });    const expired = applyGridContractProgress(definition, initial, {
      objectiveId: 'claim-territories', amount: 2, nowMs: 2_000,
    });
    expect(expired.instance.status).toBe('expired');
    expect(expired.instance.progress['claim-territories']).toBe(0);
    expect(expired.rewardIntent).toBeNull();
    expect(expired.completedNow).toBe(false);
    expect(expireGridContractInstance(definition, initial, 2_000).status).toBe('expired');
  });

  it('rejects malformed definitions and impossible progress updates', () => {
    expect(() => createGridContractInstance({
      ...definition,
      objectives: [{ id: 'same', target: 1 }, { id: 'same', target: 2 }],
    }, { playerId: 'player-4', acceptedAtMs: 1_000, expiresAtMs: null })).toThrow(/duplicate objective/i);

    expect(() => createGridContractInstance({
      ...definition, objectives: [{ id: 'bad', target: 0 }],
    }, { playerId: 'player-4', acceptedAtMs: 1_000, expiresAtMs: null })).toThrow(/target/i);

    const instance = createGridContractInstance(definition, {
      playerId: 'player-4', acceptedAtMs: 1_000, expiresAtMs: null,
    });
    expect(() => applyGridContractProgress(definition, instance, {
      objectiveId: 'unknown', amount: 1, nowMs: 2_000,
    })).toThrow(/unknown objective/i);
    expect(() => applyGridContractProgress(definition, instance, {
      objectiveId: 'win-contest', amount: 0, nowMs: 2_000,
    })).toThrow(/amount/i);
  });
});
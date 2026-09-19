import type { GridDominanceHeatConfig } from '../../core/dominance-heat-types';

/**
 * Canton Founding Season anti-snowball pressure thresholds.
 *
 * This config is intentionally standalone while shared season-package contracts
 * are being reconciled by another lane. Live projection consumes this exact
 * config; package attachment can happen later without changing the thresholds.
 */
export const cantonDominanceHeatConfig: GridDominanceHeatConfig = {
  bands: [
    {
      id: 'warm',
      minDominanceBps: 3_500,
      effects: {
        neutralFactionPressureBps: 500,
        borderRewardBonusBps: 250,
        upkeepSurchargeBps: 200,
        rivalObjectiveBonusBps: 400,
        antiMonopolyContractSlots: 1,
      },
    },
    {
      id: 'hot',
      minDominanceBps: 5_000,
      effects: {
        neutralFactionPressureBps: 1_200,
        borderRewardBonusBps: 700,
        upkeepSurchargeBps: 800,
        rivalObjectiveBonusBps: 1_000,
        antiMonopolyContractSlots: 2,
      },
    },
    {
      id: 'critical',
      minDominanceBps: 7_500,
      effects: {
        neutralFactionPressureBps: 2_500,
        borderRewardBonusBps: 1_500,
        upkeepSurchargeBps: 1_800,
        rivalObjectiveBonusBps: 2_000,
        antiMonopolyContractSlots: 4,
      },
    },
  ],
};

import type {
  GridDominanceExposureSource,
  GridDominanceHeatBand,
  GridDominanceHeatConfig,
  GridDominanceHeatEffects,
  GridDominanceHeatInput,
  GridDominanceHeatProjection,
} from './dominance-heat-types';

const BASIS_POINTS = 10_000;

const ZERO_EFFECTS: GridDominanceHeatEffects = {
  neutralFactionPressureBps: 0,
  borderRewardBonusBps: 0,
  upkeepSurchargeBps: 0,
  rivalObjectiveBonusBps: 0,
  antiMonopolyContractSlots: 0,
};

function requireNonNegativeSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
}
function requireShareBps(value: number, label: string): void {
  requireNonNegativeSafeInteger(value, label);
  if (value > BASIS_POINTS) {
    throw new Error(`${label} cannot exceed 10000 basis points`);
  }
}

function validateEffects(
  effects: GridDominanceHeatEffects,
  bandId: string,
): void {
  for (const [key, value] of Object.entries(effects)) {
    requireNonNegativeSafeInteger(
      value,
      `Dominance Heat band ${bandId} effect ${key}`,
    );
  }
}

export function validateGridDominanceHeatConfig(
  config: GridDominanceHeatConfig,
): void {
  const ids = new Set<string>();
  let previousThreshold = -1;

  for (const band of config.bands) {
    if (!band.id.trim()) {
      throw new Error('Dominance Heat band id cannot be blank');
    }
    if (ids.has(band.id)) {
      throw new Error(`Duplicate Dominance Heat band id: ${band.id}`);
    }
    ids.add(band.id);

    requireShareBps(band.minDominanceBps, `Dominance Heat band ${band.id} threshold`);
    if (band.minDominanceBps <= previousThreshold) {
      throw new Error('Dominance Heat bands must be ordered by increasing threshold');
    }
    previousThreshold = band.minDominanceBps;
    validateEffects(band.effects, band.id);
  }
}

function ratioBps(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Number(
    (BigInt(numerator) * BigInt(BASIS_POINTS)) / BigInt(denominator),
  );
}
function validateInput(input: GridDominanceHeatInput): void {
  if (!input.actorId.trim()) {
    throw new Error('Dominance Heat requires actorId');
  }

  requireNonNegativeSafeInteger(
    input.controlledTerritories,
    'controlledTerritories',
  );
  requireNonNegativeSafeInteger(input.eligibleTerritories, 'eligibleTerritories');

  if (input.eligibleTerritories === 0) {
    throw new Error('eligibleTerritories must be greater than zero');
  }
  if (input.controlledTerritories > input.eligibleTerritories) {
    throw new Error('controlledTerritories cannot exceed eligibleTerritories');
  }

  const hasControlledValue = input.controlledStrategicValue !== undefined;
  const hasTotalValue = input.totalStrategicValue !== undefined;
  if (hasControlledValue !== hasTotalValue) {
    throw new Error(
      'controlledStrategicValue and totalStrategicValue must be provided together',
    );
  }
  if (hasControlledValue && hasTotalValue) {
    requireNonNegativeSafeInteger(
      input.controlledStrategicValue!,
      'controlledStrategicValue',
    );
    requireNonNegativeSafeInteger(
      input.totalStrategicValue!,
      'totalStrategicValue',
    );
    if (input.controlledStrategicValue! > input.totalStrategicValue!) {
      throw new Error(
        'controlledStrategicValue cannot exceed totalStrategicValue',
      );
    }
  }
}

function exposureSource(
  territoryShareBps: number,
  strategicValueShareBps: number,
  hasStrategicValue: boolean,
): GridDominanceExposureSource {
  if (territoryShareBps === 0 && strategicValueShareBps === 0) return 'none';
  if (hasStrategicValue && territoryShareBps === strategicValueShareBps) {
    return 'both';
  }
  return territoryShareBps > strategicValueShareBps
    ? 'territory-share'
    : 'strategic-value-share';
}

function currentBand(
  bands: GridDominanceHeatBand[],
  scoreBps: number,
): GridDominanceHeatBand | null {
  return [...bands]
    .reverse()
    .find((band) => scoreBps >= band.minDominanceBps) ?? null;
}

function nextBand(
  bands: GridDominanceHeatBand[],
  scoreBps: number,
): GridDominanceHeatBand | null {
  return bands.find((band) => band.minDominanceBps > scoreBps) ?? null;
}

export function projectGridDominanceHeat(
  input: GridDominanceHeatInput,
  config: GridDominanceHeatConfig,
): GridDominanceHeatProjection {
  validateGridDominanceHeatConfig(config);
  validateInput(input);
  const territoryShareBps = ratioBps(
    input.controlledTerritories,
    input.eligibleTerritories,
  );
  const hasStrategicValue =
    input.controlledStrategicValue !== undefined &&
    input.totalStrategicValue !== undefined;
  const strategicValueShareBps = hasStrategicValue
    ? ratioBps(input.controlledStrategicValue!, input.totalStrategicValue!)
    : 0;
  const dominanceScoreBps = Math.max(
    territoryShareBps,
    strategicValueShareBps,
  );

  const activeBand = currentBand(config.bands, dominanceScoreBps);
  const upcomingBand = nextBand(config.bands, dominanceScoreBps);

  return {
    actorId: input.actorId,
    actorKind: input.actorKind,
    territoryShareBps,
    strategicValueShareBps,
    dominanceScoreBps,
    exposureSource: exposureSource(
      territoryShareBps,
      strategicValueShareBps,
      hasStrategicValue,
    ),
    active: activeBand !== null,
    bandId: activeBand?.id ?? null,
    effects: activeBand ? { ...activeBand.effects } : { ...ZERO_EFFECTS },
    nextBandId: upcomingBand?.id ?? null,
    bpsToNextBand: upcomingBand
      ? upcomingBand.minDominanceBps - dominanceScoreBps
      : null,
  };
}

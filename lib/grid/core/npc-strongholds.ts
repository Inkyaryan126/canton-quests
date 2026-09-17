import type {
  GridNpcStrongholdActivation,
  GridNpcStrongholdConfig,
  GridNpcStrongholdContext,
  GridNpcStrongholdProjection,
} from './npc-stronghold-types';

const BASIS_POINTS = 10_000;

function requireNonBlank(value: string, label: string): void {
  if (!value.trim()) throw new Error(`${label} cannot be blank`);
}

function requirePositiveSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive safe integer`);
  }
}

function requireBps(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > BASIS_POINTS) {
    throw new Error(`${label} must be an integer from 0..10000 basis points`);
  }
}

function mulDivFloor(left: number, right: number, denominator: number): number {
  return Number((BigInt(left) * BigInt(right)) / BigInt(denominator));
}
export function validateGridNpcStrongholdConfig(
  config: GridNpcStrongholdConfig,
): void {
  requireNonBlank(config.strongholdId, 'NPC stronghold id');
  requireNonBlank(config.factionId, 'NPC stronghold faction id');
  requireNonBlank(config.territorySlug, 'NPC stronghold territory slug');
  if (config.landmarkSlug !== undefined) {
    requireNonBlank(config.landmarkSlug, 'NPC stronghold landmark slug');
  }

  requirePositiveSafeInteger(
    config.baseGarrisonInfluence,
    'baseGarrisonInfluence',
  );
  requirePositiveSafeInteger(
    config.maxGarrisonInfluence,
    'maxGarrisonInfluence',
  );
  if (config.maxGarrisonInfluence < config.baseGarrisonInfluence) {
    throw new Error(
      'maxGarrisonInfluence cannot be below baseGarrisonInfluence',
    );
  }

  requireBps(
    config.pressureReinforcementBps,
    'pressureReinforcementBps',
  );
  requireBps(
    config.surgeReinforcementBps,
    'surgeReinforcementBps',
  );
}
function validateContext(context: GridNpcStrongholdContext): void {
  requireBps(context.surgeIntensityBps, 'surgeIntensityBps');
  requireBps(context.factionPressureBps, 'factionPressureBps');

  if (!context.seasonActive && context.eventActive) {
    throw new Error('eventActive requires an active season');
  }
  if (!context.seasonActive && context.surgeIntensityBps > 0) {
    throw new Error('surgeIntensityBps requires an active season');
  }
}

function activationReason(
  activation: GridNpcStrongholdActivation,
  context: GridNpcStrongholdContext,
): GridNpcStrongholdActivation | null {
  if (activation === 'season') {
    return context.seasonActive ? 'season' : null;
  }
  if (activation === 'event') {
    return context.eventActive ? 'event' : null;
  }
  return context.surgeIntensityBps > 0 ? 'surge' : null;
}

function reinforcementInfluence(
  config: GridNpcStrongholdConfig,
  context: GridNpcStrongholdContext,
): number {
  const headroom =
    config.maxGarrisonInfluence - config.baseGarrisonInfluence;
  if (headroom === 0) return 0;
  const pressureSignalBps = mulDivFloor(
    context.factionPressureBps,
    config.pressureReinforcementBps,
    BASIS_POINTS,
  );
  const surgeSignalBps = mulDivFloor(
    context.surgeIntensityBps,
    config.surgeReinforcementBps,
    BASIS_POINTS,
  );
  const reinforcementBps = Math.min(
    BASIS_POINTS,
    pressureSignalBps + surgeSignalBps,
  );

  return mulDivFloor(
    headroom,
    reinforcementBps,
    BASIS_POINTS,
  );
}

export function projectGridNpcStronghold(
  config: GridNpcStrongholdConfig,
  context: GridNpcStrongholdContext,
): GridNpcStrongholdProjection {
  validateGridNpcStrongholdConfig(config);
  validateContext(context);

  const objective = {
    kind: config.landmarkSlug
      ? 'pve-landmark'
      : 'pve-territory',
    factionId: config.factionId,
    territorySlug: config.territorySlug,
    ...(config.landmarkSlug
      ? { landmarkSlug: config.landmarkSlug }
      : {}),
  } as const;

  if (context.captured) {
    return {
      strongholdId: config.strongholdId,
      status: 'captured',
      activationReason: null,
      contestable: false,
      baseGarrisonInfluence: config.baseGarrisonInfluence,
      reinforcementInfluence: 0,
      garrisonInfluence: 0,
      objective,
    };
  }

  const reason = activationReason(config.activation, context);
  if (!reason) {
    return {
      strongholdId: config.strongholdId,
      status: 'dormant',
      activationReason: null,
      contestable: false,
      baseGarrisonInfluence: config.baseGarrisonInfluence,
      reinforcementInfluence: 0,
      garrisonInfluence: 0,
      objective,
    };
  }

  const reinforcement = reinforcementInfluence(config, context);

  return {
    strongholdId: config.strongholdId,
    status: 'active',
    activationReason: reason,
    contestable: true,
    baseGarrisonInfluence: config.baseGarrisonInfluence,
    reinforcementInfluence: reinforcement,
    garrisonInfluence:
      config.baseGarrisonInfluence + reinforcement,
    objective,
  };
}

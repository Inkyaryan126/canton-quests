const BASIS_POINTS = 10_000;

export interface GridTakeoverDamagePolicy {
  /**
   * Percentage of development levels retained after a successful takeover.
   * 10_000 keeps every level; 0 destroys all levels.
   */
  developmentRetentionBps: number;
  /**
   * Absolute condition damage applied on takeover.
   * Condition is always stored in basis points from 0..10_000.
   */
  conditionDamageBps: number;
  /**
   * Damage from this takeover cannot push a healthier property below this floor.
   * It never repairs a property that was already below the floor.
   */
  conditionFloorBps: number;
}

export interface GridTakeoverDamageInput {
  developmentLevel: number;
  conditionBps: number;
}

export interface GridTakeoverDamageResult {
  retainedDevelopmentLevel: number;
  developmentLevelsLost: number;
  conditionBps: number;
  conditionLostBps: number;
  repairRequiredBps: number;
}

function requireBps(value: number, label: string): void {
  if (
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value > BASIS_POINTS
  ) {
    throw new Error(`${label} must be an integer from 0..10000 basis points`);
  }
}

function requireDevelopmentLevel(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error('developmentLevel must be a non-negative safe integer');
  }
}

export function resolveGridTakeoverDamage(
  input: GridTakeoverDamageInput,
  policy: GridTakeoverDamagePolicy,
): GridTakeoverDamageResult {
  requireDevelopmentLevel(input.developmentLevel);
  requireBps(input.conditionBps, 'conditionBps');
  requireBps(policy.developmentRetentionBps, 'developmentRetentionBps');
  requireBps(policy.conditionDamageBps, 'conditionDamageBps');
  requireBps(policy.conditionFloorBps, 'conditionFloorBps');

  const retainedDevelopmentLevel = Math.floor(
    (input.developmentLevel * policy.developmentRetentionBps) /
      BASIS_POINTS,
  );

  const damagedCondition = Math.max(
    policy.conditionFloorBps,
    input.conditionBps - policy.conditionDamageBps,
  );
  const conditionBps = Math.min(input.conditionBps, damagedCondition);

  return {
    retainedDevelopmentLevel,
    developmentLevelsLost:
      input.developmentLevel - retainedDevelopmentLevel,
    conditionBps,
    conditionLostBps: input.conditionBps - conditionBps,
    repairRequiredBps: BASIS_POINTS - conditionBps,
  };
}

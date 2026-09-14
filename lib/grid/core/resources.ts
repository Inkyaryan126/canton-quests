import type {
  GridEconomyConfig,
  GridEconomyCost,
  GridIncomeRate,
} from './economy-types';

const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

export interface GridCommandPointSettlementInput {
  current: number;
  max: number;
  regenIntervalMinutes: number;
  updatedAtMs: number;
  nowMs: number;
}

export interface GridCommandPointSettlement {
  commandPoints: number;
  regenerated: number;
  updatedAtMs: number;
}

export interface GridResourceRemainders {
  /** Fractional resource numerators using HOUR_MS as the fixed denominator. */
  credits: number;
  influence: number;
}

export interface GridResourceSettlementInput {
  credits: number;
  influence: number;
  creditsPerHour: number;
  influencePerHour: number;
  remainders: GridResourceRemainders;
  lastSettledAtMs: number;
  nowMs: number;
  offlineAccrualCapMinutes: number;
}

export interface GridResourceSettlement {
  credits: number;
  influence: number;
  creditsEarned: number;
  influenceEarned: number;
  remainders: GridResourceRemainders;
  billableMs: number;
  settledAtMs: number;
}

function assertSafeInteger(value: number, name: string, minimum = 0): void {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${name} must be a safe integer >= ${minimum}`);
  }
}

function bigintToSafeNumber(value: bigint, name: string): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result)) {
    throw new Error(`${name} exceeds JavaScript safe integer range`);
  }
  return result;
}

export function settleCommandPoints(
  input: GridCommandPointSettlementInput
): GridCommandPointSettlement {
  assertSafeInteger(input.current, 'current command points');
  assertSafeInteger(input.max, 'max command points', 1);
  assertSafeInteger(input.regenIntervalMinutes, 'command point regen interval minutes', 1);
  assertSafeInteger(input.updatedAtMs, 'command points updatedAtMs');
  assertSafeInteger(input.nowMs, 'command points nowMs');

  if (input.current > input.max) {
    throw new Error('current command points cannot exceed max command points');
  }
  if (input.nowMs < input.updatedAtMs) {
    throw new Error('command point settlement time cannot move backward');
  }

  if (input.current === input.max) {
    return {
      commandPoints: input.current,
      regenerated: 0,
      updatedAtMs: input.nowMs,
    };
  }

  const intervalMs = input.regenIntervalMinutes * MINUTE_MS;
  const elapsedMs = input.nowMs - input.updatedAtMs;
  const wholeIntervals = Math.floor(elapsedMs / intervalMs);
  if (wholeIntervals === 0) {
    return {
      commandPoints: input.current,
      regenerated: 0,
      updatedAtMs: input.updatedAtMs,
    };
  }

  const regenerated = Math.min(wholeIntervals, input.max - input.current);
  const commandPoints = input.current + regenerated;

  return {
    commandPoints,
    regenerated,
    // Reaching cap burns any extra/partial accumulated time so full players
    // cannot bank invisible regeneration and instantly refill after spending.
    updatedAtMs:
      commandPoints === input.max
        ? input.nowMs
        : input.updatedAtMs + wholeIntervals * intervalMs,
  };
}

function settleOneResource(
  current: number,
  ratePerHour: number,
  remainder: number,
  billableMs: number,
  name: string
): { value: number; earned: number; remainder: number } {
  assertSafeInteger(current, name);
  assertSafeInteger(ratePerHour, `${name} rate per hour`);
  assertSafeInteger(remainder, `${name} accrual remainder`);
  if (remainder >= HOUR_MS) {
    throw new Error(`${name} accrual remainder must be < ${HOUR_MS}`);
  }

  const numerator = BigInt(remainder) + BigInt(ratePerHour) * BigInt(billableMs);
  const earnedBig = numerator / BigInt(HOUR_MS);
  const remainderBig = numerator % BigInt(HOUR_MS);
  const earned = bigintToSafeNumber(earnedBig, `${name} earned`);
  const value = current + earned;
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${name} total exceeds JavaScript safe integer range`);
  }

  return {
    value,
    earned,
    remainder: bigintToSafeNumber(remainderBig, `${name} accrual remainder`),
  };
}

export function settleGridResources(
  input: GridResourceSettlementInput
): GridResourceSettlement {
  assertSafeInteger(input.lastSettledAtMs, 'resource lastSettledAtMs');
  assertSafeInteger(input.nowMs, 'resource nowMs');
  assertSafeInteger(input.offlineAccrualCapMinutes, 'offline accrual cap minutes', 1);
  if (input.nowMs < input.lastSettledAtMs) {
    throw new Error('resource settlement time cannot move backward');
  }

  const elapsedMs = input.nowMs - input.lastSettledAtMs;
  const capMs = input.offlineAccrualCapMinutes * MINUTE_MS;
  const billableMs = Math.min(elapsedMs, capMs);

  const credits = settleOneResource(
    input.credits,
    input.creditsPerHour,
    input.remainders.credits,
    billableMs,
    'credits'
  );
  const influence = settleOneResource(
    input.influence,
    input.influencePerHour,
    input.remainders.influence,
    billableMs,
    'influence'
  );

  return {
    credits: credits.value,
    influence: influence.value,
    creditsEarned: credits.earned,
    influenceEarned: influence.earned,
    remainders: {
      credits: credits.remainder,
      influence: influence.remainder,
    },
    billableMs,
    // Time beyond the configured offline cap is intentionally discarded.
    settledAtMs: input.nowMs,
  };
}

export function resolveTerritoryClaimCost(
  config: GridEconomyConfig,
  territorySlug: string
): GridEconomyCost {
  return {
    ...(config.neutralClaims.costByTerritorySlug?.[territorySlug] ??
      config.neutralClaims.defaultCost),
  };
}

export function resolvePropertyAcquisitionCost(
  config: GridEconomyConfig,
  propertySlug: string
): GridEconomyCost {
  return {
    ...(config.propertyAcquisition.costByPropertySlug?.[propertySlug] ??
      config.propertyAcquisition.defaultCost),
  };
}

export function resolveTerritoryIncomeRate(
  config: GridEconomyConfig,
  territorySlug: string
): GridIncomeRate {
  return {
    ...(config.income.territories.rateBySlug?.[territorySlug] ??
      config.income.territories.defaultRate),
  };
}

export function resolvePropertyIncomeRate(
  config: GridEconomyConfig,
  propertySlug: string
): GridIncomeRate {
  return {
    ...(config.income.properties.rateBySlug?.[propertySlug] ??
      config.income.properties.defaultRate),
  };
}

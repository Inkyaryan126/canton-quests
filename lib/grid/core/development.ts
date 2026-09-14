import type {
  GridDevelopmentBonuses,
  GridDevelopmentBranch,
  GridDevelopmentConfig,
  GridDevelopmentLevelConfig,
} from './economy-types';

export interface GridResolvedDevelopmentBonuses {
  creditsPerHour: number;
  influencePerHour: number;
  defenseBps: number;
  intelBps: number;
  prestigeBps: number;
}

const ZERO_BONUSES: GridResolvedDevelopmentBonuses = {
  creditsPerHour: 0,
  influencePerHour: 0,
  defenseBps: 0,
  intelBps: 0,
  prestigeBps: 0,
};

function assertLevel(level: number): void {
  if (!Number.isSafeInteger(level) || level < 0) {
    throw new Error('development level must be a non-negative safe integer');
  }
}

export function getNextDevelopmentLevel(
  config: GridDevelopmentConfig,
  branch: GridDevelopmentBranch,
  currentLevel: number
): GridDevelopmentLevelConfig | null {
  assertLevel(currentLevel);
  const nextLevel = currentLevel + 1;
  return config[branch].levels.find((level) => level.level === nextLevel) ?? null;
}

function addBonuses(
  total: GridResolvedDevelopmentBonuses,
  bonuses: GridDevelopmentBonuses
): void {
  total.creditsPerHour += bonuses.creditsPerHour ?? 0;
  total.influencePerHour += bonuses.influencePerHour ?? 0;
  total.defenseBps += bonuses.defenseBps ?? 0;
  total.intelBps += bonuses.intelBps ?? 0;
  total.prestigeBps += bonuses.prestigeBps ?? 0;

  for (const [key, value] of Object.entries(total)) {
    if (!Number.isSafeInteger(value)) {
      throw new Error(`development bonus ${key} exceeds JavaScript safe integer range`);
    }
  }
}

export function getDevelopmentBonusesThroughLevel(
  config: GridDevelopmentConfig,
  branch: GridDevelopmentBranch,
  currentLevel: number
): GridResolvedDevelopmentBonuses {
  assertLevel(currentLevel);
  if (currentLevel === 0) return { ...ZERO_BONUSES };

  const configured = config[branch].levels.filter((level) => level.level <= currentLevel);
  if (configured.length !== currentLevel) {
    throw new Error(`development level ${currentLevel} is not configured for branch ${branch}`);
  }

  const total = { ...ZERO_BONUSES };
  for (const level of configured) addBonuses(total, level.bonuses);
  return total;
}

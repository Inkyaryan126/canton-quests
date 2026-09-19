import type { GridMasterBoard } from '../master-board/types';

export const GRID_PRODUCTION_REQUIRED_ON_FLAGS = [
  'GRID_FOUNDATION_ENABLED',
  'GRID_WORLD_READ_ENABLED',
  'GRID_ONBOARDING_WRITE_ENABLED',
  'GRID_ECONOMY_WRITE_ENABLED',
  'GRID_CONTEST_WRITE_ENABLED',
  'GRID_ALLIANCE_ENABLED',
  'GRID_CHAT_ENABLED',
  'GRID_MARKET_LISTING_READ_ENABLED',
  'GRID_MARKET_LISTING_WRITE_ENABLED',
  'GRID_DIRECT_DEAL_READ_ENABLED',
  'GRID_DIRECT_DEAL_WRITE_ENABLED',
  'GRID_AUCTION_READ_ENABLED',
  'GRID_AUCTION_WRITE_ENABLED',
] as const;

/**
 * Maintenance/admin switches that should be deliberately disabled at the
 * initial player launch. They may be enabled later for a controlled operation.
 */
export const GRID_PRODUCTION_REQUIRED_OFF_FLAGS = [
  'GRID_PROGRESSION_REBUILD_ENABLED',
  'GRID_SEASON_ARCHIVE_ENABLED',
] as const;

export const GRID_PRODUCTION_REQUIRED_SECRETS = [
  'GRID_LOCATION_ATTESTATION_SECRET',
] as const;

export const GRID_PRODUCTION_RELEASE_GATE_COMMAND = 'npm run grid:release-gate';

export type GridProductionActivationBlockerKind =
  | 'worktree-dirty'
  | 'integration-ref-missing'
  | 'live-claims'
  | 'coordination-warning'
  | 'milestone-not-integrated'
  | 'flag-not-enabled'
  | 'maintenance-flag-not-disabled'
  | 'secret-invalid';

export interface GridProductionActivationBlocker {
  kind: GridProductionActivationBlockerKind;
  key: string;
  detail: string;
}

export interface GridProductionActivationInput {
  board: GridMasterBoard;
  env: Record<string, string | undefined>;
  cleanWorktree: boolean;
}

export interface GridProductionActivationReport {
  status: 'BLOCKED' | 'READY_FOR_RELEASE_GATE';
  readyForReleaseGate: boolean;
  integrationRef: string | null;
  integrationCommit: string | null;
  blockers: GridProductionActivationBlocker[];
  requiredOnFlags: readonly string[];
  requiredOffFlags: readonly string[];
  requiredSecrets: readonly string[];
  releaseGateCommand: typeof GRID_PRODUCTION_RELEASE_GATE_COMMAND;
}

function blocker(
  kind: GridProductionActivationBlockerKind,
  key: string,
  detail: string,
): GridProductionActivationBlocker {
  return { kind, key, detail };
}

function secretIsStrongEnough(value: string | undefined): boolean {
  return typeof value === 'string' && Buffer.byteLength(value, 'utf8') >= 32;
}

export function evaluateGridProductionActivation(
  input: GridProductionActivationInput,
): GridProductionActivationReport {
  const blockers: GridProductionActivationBlocker[] = [];
  const { board, env } = input;

  if (!input.cleanWorktree) {
    blockers.push(
      blocker(
        'worktree-dirty',
        'git-worktree',
        'Production activation requires a clean, committed integration worktree.',
      ),
    );
  }

  if (!board.health.integrationRef || !board.health.integrationCommit) {
    blockers.push(
      blocker(
        'integration-ref-missing',
        'integration-ref',
        'Production activation requires an explicit Grid integration ref and commit.',
      ),
    );
  }

  if (board.health.liveClaimCount > 0) {
    blockers.push(
      blocker(
        'live-claims',
        'agent-claims',
        `${board.health.liveClaimCount} live Grid claim(s) remain; reconcile and release all active lanes first.`,
      ),
    );
  }

  for (const warning of board.health.coordinationWarnings) {
    blockers.push(
      blocker(
        'coordination-warning',
        warning.code,
        warning.message,
      ),
    );
  }

  for (const milestone of board.milestones) {
    if (milestone.id === 'production-activation') continue;
    if (milestone.status !== 'INTEGRATED') {
      blockers.push(
        blocker(
          'milestone-not-integrated',
          milestone.id,
          `${milestone.title} is ${milestone.status}, not INTEGRATED (${milestone.detail}).`,
        ),
      );
    }
  }

  for (const key of GRID_PRODUCTION_REQUIRED_ON_FLAGS) {
    if (env[key] !== '1') {
      blockers.push(
        blocker(
          'flag-not-enabled',
          key,
          `${key} must be explicitly set to 1 for player production activation.`,
        ),
      );
    }
  }

  for (const key of GRID_PRODUCTION_REQUIRED_OFF_FLAGS) {
    if (env[key] !== '0') {
      blockers.push(
        blocker(
          'maintenance-flag-not-disabled',
          key,
          `${key} must be explicitly set to 0 for initial production activation.`,
        ),
      );
    }
  }

  for (const key of GRID_PRODUCTION_REQUIRED_SECRETS) {
    if (!secretIsStrongEnough(env[key])) {
      blockers.push(
        blocker(
          'secret-invalid',
          key,
          `${key} must be configured with at least 32 UTF-8 bytes.`,
        ),
      );
    }
  }

  const readyForReleaseGate = blockers.length === 0;
  return {
    status: readyForReleaseGate ? 'READY_FOR_RELEASE_GATE' : 'BLOCKED',
    readyForReleaseGate,
    integrationRef: board.health.integrationRef,
    integrationCommit: board.health.integrationCommit,
    blockers,
    requiredOnFlags: GRID_PRODUCTION_REQUIRED_ON_FLAGS,
    requiredOffFlags: GRID_PRODUCTION_REQUIRED_OFF_FLAGS,
    requiredSecrets: GRID_PRODUCTION_REQUIRED_SECRETS,
    releaseGateCommand: GRID_PRODUCTION_RELEASE_GATE_COMMAND,
  };
}

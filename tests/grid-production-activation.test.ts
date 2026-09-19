import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { GRID_MILESTONES } from '../lib/grid/master-board/milestones';
import type { GridMasterBoard } from '../lib/grid/master-board/types';
import {
  evaluateGridProductionActivation,
  GRID_PRODUCTION_RELEASE_GATE_COMMAND,
  GRID_PRODUCTION_REQUIRED_OFF_FLAGS,
  GRID_PRODUCTION_REQUIRED_ON_FLAGS,
  GRID_PRODUCTION_REQUIRED_SECRETS,
} from '../lib/grid/operations/production-activation';

function board(): GridMasterBoard {
  return {
    version: 1,
    health: {
      generatedAt: '2026-09-19T02:40:00.000Z',
      integrationRef: 'grid-canonical-integration-20260919',
      integrationCommit: 'abc123',
      localMainAvailable: true,
      originMainAvailable: true,
      boardroomAutonomousRunActive: false,
      liveClaimCount: 0,
      staleClaimCount: 0,
      coordinationWarnings: [],
    },
    milestones: GRID_MILESTONES.map((milestone) => ({
      id: milestone.id,
      title: milestone.title,
      phase: milestone.phase,
      status: milestone.id === 'production-activation' ? 'SAFE_NEXT_WORK' : 'INTEGRATED',
      promotion: milestone.id === 'production-activation' ? 'DEPLOYMENT_UNKNOWN' : 'GRID_INTEGRATION',
      detail: milestone.id === 'production-activation' ? 'Ready to claim' : 'Integrated for test',
      warnings: [],
    })),
  };
}

function productionEnv(): Record<string, string> {
  return {
    ...Object.fromEntries(GRID_PRODUCTION_REQUIRED_ON_FLAGS.map((key) => [key, '1'])),
    ...Object.fromEntries(GRID_PRODUCTION_REQUIRED_OFF_FLAGS.map((key) => [key, '0'])),
    GRID_LOCATION_ATTESTATION_SECRET: '12345678901234567890123456789012',
  };
}

describe('Grid Canton production activation evaluator', () => {
  it('becomes ready for the existing release gate only when every promotion prerequisite is satisfied', () => {
    const result = evaluateGridProductionActivation({
      board: board(),
      env: productionEnv(),
      cleanWorktree: true,
    });

    expect(result.status).toBe('READY_FOR_RELEASE_GATE');
    expect(result.readyForReleaseGate).toBe(true);
    expect(result.blockers).toEqual([]);
    expect(result.releaseGateCommand).toBe(GRID_PRODUCTION_RELEASE_GATE_COMMAND);
  });

  it('does not require the production-activation milestone to already be integrated', () => {
    const result = evaluateGridProductionActivation({ board: board(), env: productionEnv(), cleanWorktree: true });
    expect(result.blockers.some((item) => item.key === 'production-activation')).toBe(false);
  });

  it('blocks any required milestone that is still outside the integration ref', () => {
    const fixture = board();
    const location = fixture.milestones.find((item) => item.id === 'location-play')!;
    location.status = 'READY_TO_INTEGRATE';
    location.detail = 'Completed only on a clean side branch';

    const result = evaluateGridProductionActivation({ board: fixture, env: productionEnv(), cleanWorktree: true });
    expect(result.readyForReleaseGate).toBe(false);
    expect(result.blockers).toContainEqual(expect.objectContaining({
      kind: 'milestone-not-integrated',
      key: 'location-play',
    }));
  });

  it('blocks live agent work, coordination warnings, and a dirty integration checkout', () => {
    const fixture = board();
    fixture.health.liveClaimCount = 2;
    fixture.health.coordinationWarnings = [{ code: 'scope-overlap', message: 'two lanes overlap' }];

    const result = evaluateGridProductionActivation({ board: fixture, env: productionEnv(), cleanWorktree: false });
    expect(result.blockers.map((item) => item.kind)).toEqual(
      expect.arrayContaining(['worktree-dirty', 'live-claims', 'coordination-warning']),
    );
  });

  it('requires an explicit integration ref and commit', () => {
    const fixture = board();
    fixture.health.integrationRef = null;
    fixture.health.integrationCommit = null;
    const result = evaluateGridProductionActivation({ board: fixture, env: productionEnv(), cleanWorktree: true });
    expect(result.blockers).toContainEqual(expect.objectContaining({ kind: 'integration-ref-missing' }));
  });

  it('requires every player-critical launch flag to be explicitly enabled', () => {
    const env = productionEnv();
    delete env.GRID_ECONOMY_WRITE_ENABLED;
    env.GRID_AUCTION_WRITE_ENABLED = '0';

    const result = evaluateGridProductionActivation({ board: board(), env, cleanWorktree: true });
    expect(result.blockers).toContainEqual(expect.objectContaining({
      kind: 'flag-not-enabled', key: 'GRID_ECONOMY_WRITE_ENABLED',
    }));
    expect(result.blockers).toContainEqual(expect.objectContaining({
      kind: 'flag-not-enabled', key: 'GRID_AUCTION_WRITE_ENABLED',
    }));
  });

  it('requires dangerous maintenance flags to be explicitly disabled at initial launch', () => {
    const env = productionEnv();
    delete env.GRID_PROGRESSION_REBUILD_ENABLED;
    env.GRID_SEASON_ARCHIVE_ENABLED = '1';

    const result = evaluateGridProductionActivation({ board: board(), env, cleanWorktree: true });
    expect(result.blockers).toContainEqual(expect.objectContaining({
      kind: 'maintenance-flag-not-disabled', key: 'GRID_PROGRESSION_REBUILD_ENABLED',
    }));
    expect(result.blockers).toContainEqual(expect.objectContaining({
      kind: 'maintenance-flag-not-disabled', key: 'GRID_SEASON_ARCHIVE_ENABLED',
    }));
  });

  it('requires a location signing secret of at least 32 UTF-8 bytes without exposing the value', () => {
    const env = productionEnv();
    env.GRID_LOCATION_ATTESTATION_SECRET = 'too-short';

    const result = evaluateGridProductionActivation({ board: board(), env, cleanWorktree: true });
    expect(result.blockers).toContainEqual(expect.objectContaining({
      kind: 'secret-invalid', key: 'GRID_LOCATION_ATTESTATION_SECRET',
    }));
    expect(JSON.stringify(result)).not.toContain('too-short');
  });
});

describe('Grid production activation CLI contract', () => {
  it('publishes a no-side-effect activation plan and points to the existing release gate', () => {
    const raw = execFileSync(
      'node',
      ['./node_modules/vite-node/vite-node.mjs', 'scripts/grid-production-activation.ts', '--plan'],
      { cwd: process.cwd(), encoding: 'utf8' },
    );
    const result = JSON.parse(raw);
    expect(result.mutatesProduction).toBe(false);
    expect(result.requiredOnFlags).toEqual(GRID_PRODUCTION_REQUIRED_ON_FLAGS);
    expect(result.requiredOffFlags).toEqual(GRID_PRODUCTION_REQUIRED_OFF_FLAGS);
    expect(result.requiredSecrets.map((item: { key: string }) => item.key)).toEqual(
      GRID_PRODUCTION_REQUIRED_SECRETS,
    );
    expect(result.finalVerificationCommand).toBe('npm run grid:release-gate');
  });

  it('contains no deployment, environment mutation, or migration-apply subprocess', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'scripts/grid-production-activation.ts'),
      'utf8',
    );
    expect(source).not.toMatch(/spawnSync\(['"]vercel/);
    expect(source).not.toMatch(/spawnSync\(['"]supabase/);
    expect(source).not.toContain('process.env[');
    expect(source).not.toContain('process.env.');
    expect(source).not.toContain('apply_migration');
  });
});

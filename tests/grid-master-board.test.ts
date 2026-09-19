import { describe, expect, it } from 'vitest';
import { applyDependencyBlockers, classifyMilestone, promoteSafeNextWork } from '../lib/grid/master-board/classify';
import type {
  GridMilestoneDefinition,
  GridMilestoneEvidence,
  GridMilestoneState,
} from '../lib/grid/master-board/types';

const definition: GridMilestoneDefinition = {
  id: 'road-network',
  title: 'Road Network',
  phase: 'world',
  dependsOn: [],
  lanePatterns: ['road-network'],
  branchPatterns: ['grid-road-network'],
  integrationCommitSignals: ['GRID Roads 13'],
};

function evidence(overrides: Partial<GridMilestoneEvidence> = {}): GridMilestoneEvidence {
  return {
    activeClaims: [],
    branches: [],
    integrationMatches: [],
    blockers: [],
    rejected: [],
    warnings: [],
    contradictions: [],
    ...overrides,
  };
}

describe('Grid Master Board classification', () => {
  it('classifies an active non-stale claim as IN_PROGRESS', () => {
    const result = classifyMilestone(definition, evidence({
      activeClaims: [{ lane: 'road-network', owner: 'agent-a', branch: 'grid-road-network-x', stale: false }],
    }));

    expect(result.status).toBe('IN_PROGRESS');
    expect(result.owner).toBe('agent-a');
  });

  it('does not treat a stale claim as active progress', () => {
    const result = classifyMilestone(definition, evidence({
      activeClaims: [{ lane: 'road-network', owner: 'agent-a', branch: 'grid-road-network-x', stale: true }],
    }));

    expect(result.status).toBe('PLANNED');
    expect(result.warnings.join(' ')).toMatch(/stale/i);
  });

  it('classifies a clean completed side branch as READY_TO_INTEGRATE', () => {
    const result = classifyMilestone(definition, evidence({
      branches: [{ branch: 'grid-road-network-20260915', clean: true, completionCommit: 'abc123', completionSubject: 'GRID Roads 13: derive stable named road corridors', mergedIntoIntegration: false, onLocalMain: false, onOriginMain: false }],
    }));

    expect(result.status).toBe('READY_TO_INTEGRATE');
    expect(result.promotion).toBe('SIDE_BRANCH_ONLY');
  });
  it('refuses to mark a dirty completed branch ready to integrate', () => {
    const result = classifyMilestone(definition, evidence({
      branches: [{ branch: 'grid-road-network-20260915', clean: false, completionCommit: 'abc123', completionSubject: 'GRID Roads 13: derive stable named road corridors', mergedIntoIntegration: false, onLocalMain: false, onOriginMain: false }],
    }));

    expect(result.status).toBe('DIRTY_DORMANT');
    expect(result.warnings.join(' ')).toMatch(/dirty/i);
  });

  it('gives integrated ancestry precedence over an old side branch', () => {
    const result = classifyMilestone(definition, evidence({
      integrationMatches: [{ commit: 'abc123', subject: 'GRID Roads 13: derive stable named road corridors', onLocalMain: false, onOriginMain: false }],
      branches: [{ branch: 'grid-road-network-20260915', clean: true, completionCommit: 'abc123', completionSubject: 'GRID Roads 13: derive stable named road corridors', mergedIntoIntegration: true, onLocalMain: false, onOriginMain: false }],
    }));

    expect(result.status).toBe('INTEGRATED');
    expect(result.promotion).toBe('GRID_INTEGRATION');
  });

  it('uses blocked evidence when no stronger implementation evidence exists', () => {
    const result = classifyMilestone(definition, evidence({ blockers: ['waiting for schema'] }));
    expect(result.status).toBe('BLOCKED');
    expect(result.detail).toMatch(/waiting for schema/i);
  });
  it('keeps a catalog-only milestone visible as PLANNED', () => {
    const result = classifyMilestone(definition, evidence());
    expect(result.status).toBe('PLANNED');
  });

  it('surfaces contradictory evidence as UNKNOWN instead of guessing', () => {
    const result = classifyMilestone(definition, evidence({
      contradictions: ['two incompatible completion commits were found'],
    }));

    expect(result.status).toBe('UNKNOWN');
    expect(result.detail).toMatch(/incompatible completion commits/i);
  });

  it('reports promotion to origin/main when integrated evidence is already there', () => {
    const result = classifyMilestone(definition, evidence({
      integrationMatches: [{ commit: 'abc123', subject: 'GRID Roads 13: derive stable named road corridors', onLocalMain: true, onOriginMain: true }],
    }));

    expect(result.status).toBe('INTEGRATED');
    expect(result.promotion).toBe('ORIGIN_MAIN');
  });

  it('classifies milestone with rejected boardroom evidence as REJECTED', () => {
    const result = classifyMilestone(definition, evidence({
      rejected: ['Task rejected: scope out of date'],
    }));
    expect(result.status).toBe('REJECTED');
    expect(result.detail).toContain('Task rejected: scope out of date');
  });
});

describe('Grid Master Board safe next work promotion', () => {
  it('promotes planned milestones with all integrated dependencies to SAFE_NEXT_WORK', () => {
    const foundation: GridMilestoneDefinition = {
      ...definition,
      id: 'foundation',
      title: 'Foundation',
      dependsOn: [],
    };
    const dependent: GridMilestoneDefinition = {
      ...definition,
      id: 'dependent',
      title: 'Dependent',
      dependsOn: ['foundation'],
    };
    const foundationState: GridMilestoneState = {
      id: 'foundation',
      title: 'Foundation',
      phase: 'world',
      status: 'INTEGRATED',
      promotion: 'GRID_INTEGRATION',
      detail: 'Integrated',
      warnings: [],
    };
    const dependentState = classifyMilestone(dependent, evidence());
    expect(dependentState.status).toBe('PLANNED');

    const promoted = promoteSafeNextWork([foundation, dependent], [foundationState, dependentState]);
    const depResult = promoted.find((item) => item.id === 'dependent');
    expect(depResult?.status).toBe('SAFE_NEXT_WORK');
    expect(depResult?.detail).toMatch(/all prerequisites integrated/i);
  });

  it('does not promote planned milestones to SAFE_NEXT_WORK when dependencies are not integrated', () => {
    const foundation: GridMilestoneDefinition = {
      ...definition,
      id: 'foundation',
      title: 'Foundation',
      dependsOn: [],
    };
    const dependent: GridMilestoneDefinition = {
      ...definition,
      id: 'dependent',
      title: 'Dependent',
      dependsOn: ['foundation'],
    };
    const foundationState: GridMilestoneState = {
      id: 'foundation',
      title: 'Foundation',
      phase: 'world',
      status: 'IN_PROGRESS',
      promotion: 'SIDE_BRANCH_ONLY',
      detail: 'In progress',
      warnings: [],
    };
    const dependentState = classifyMilestone(dependent, evidence());

    const promoted = promoteSafeNextWork([foundation, dependent], [foundationState, dependentState]);
    const depResult = promoted.find((item) => item.id === 'dependent');
    expect(depResult?.status).toBe('PLANNED');
  });
});

import { GRID_MILESTONES } from '../lib/grid/master-board/milestones';

describe('Grid Master Board dependency blocking', () => {
  it('blocks a planned milestone when one of its declared prerequisites is blocked', () => {
    const foundation: GridMilestoneDefinition = {
      ...definition,
      id: 'foundation',
      title: 'Foundation',
      dependsOn: [],
    };
    const dependent: GridMilestoneDefinition = {
      ...definition,
      id: 'dependent',
      title: 'Dependent',
      dependsOn: ['foundation'],
    };
    const foundationState = classifyMilestone(foundation, evidence({ blockers: ['schema unavailable'] }));
    const dependentState = classifyMilestone(dependent, evidence());

    const states = applyDependencyBlockers([foundation, dependent], [foundationState, dependentState]);
    const result = states.find((item) => item.id === 'dependent');

    expect(result?.status).toBe('BLOCKED');
    expect(result?.detail).toContain('Foundation');
  });

  it('does not downgrade stronger implementation evidence because a prerequisite is blocked', () => {
    const foundation: GridMilestoneDefinition = {
      ...definition,
      id: 'foundation',
      title: 'Foundation',
      dependsOn: [],
    };
    const dependent: GridMilestoneDefinition = {
      ...definition,
      id: 'dependent',
      title: 'Dependent',
      dependsOn: ['foundation'],
    };
    const foundationState = classifyMilestone(foundation, evidence({ blockers: ['schema unavailable'] }));
    const dependentState = classifyMilestone(dependent, evidence({
      activeClaims: [{ lane: 'dependent', owner: 'agent', branch: 'grid-dependent', stale: false }],
    }));

    const states = applyDependencyBlockers([foundation, dependent], [foundationState, dependentState]);
    expect(states.find((item) => item.id === 'dependent')?.status).toBe('IN_PROGRESS');
  });
});

describe('Grid Master Board milestone catalog', () => {
  it('keeps major completed and future Grid systems visible with stable unique ids', () => {
    const ids = GRID_MILESTONES.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining([
      'city-compiler', 'road-network', 'market', 'auctions', 'alliances',
      'map-world', 'admin-control', 'launch-readiness', 'passport',
      'anti-cheat', 'season-archive', 'production-activation',
    ]));
  });
});

import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { collectGridMasterBoard, resolveIntegrationRef } from '../lib/grid/master-board/collect';

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function commitFile(cwd: string, filename: string, content: string, message: string): string {
  writeFileSync(path.join(cwd, filename), content);
  git(cwd, 'add', filename);
  git(cwd, 'commit', '-m', message);
  return git(cwd, 'rev-parse', 'HEAD');
}

function makeCollectorRepo(): string {
  const repo = mkdtempSync(path.join(tmpdir(), 'grid-master-board-'));
  git(repo, 'init', '-b', 'main');
  git(repo, 'config', 'user.email', 'grid-board@test.local');
  git(repo, 'config', 'user.name', 'Grid Board Test');
  commitFile(repo, 'base.txt', 'base\n', 'base');
  git(repo, 'branch', 'grid-integration-20260916');
  git(repo, 'checkout', '-b', 'grid-integration-20260917');
  commitFile(repo, 'roads.txt', 'roads\n', 'GRID Roads 13: derive stable named road corridors');
  commitFile(repo, 'legacy-launch.txt', 'legacy\n', 'fix: /admin/live Launch Readiness dashboard now reads real production data');
  commitFile(repo, 'market-core.txt', 'market core\n', 'GRID Market 4: add canonical transaction log core');
  git(repo, 'checkout', 'main');
  git(repo, 'checkout', '-b', 'grid-anti-cheat-20260917');
  commitFile(repo, 'fraud.txt', 'fraud\n', 'anti-cheat foundation');
  git(repo, 'checkout', 'main');
  git(repo, 'checkout', '-b', 'grid-launch-readiness-20260917');
  commitFile(repo, 'launch.txt', 'launch\n', 'GRID Launch Readiness: add integration verification suite and small-season simulation');
  git(repo, 'checkout', 'main');
  git(repo, 'checkout', '-b', 'grid-market-auction-ui-20260917');
  commitFile(repo, 'market-ui.txt', 'market ui\n', 'GRID Market/Auction: add player-facing market home, auction house, and listing purchase UI');
  git(repo, 'checkout', 'main');
  return repo;
}

describe('Grid Master Board runtime collection', () => {
  it('rejects an explicitly requested integration ref that does not exist', () => {
    const repo = makeCollectorRepo();
    expect(() => resolveIntegrationRef(repo, 'grid-integration-does-not-exist')).toThrow(
      /integration ref.*does not exist/i,
    );
  });

  it('selects the newest local integration branch when no override is supplied', () => {
    const repo = makeCollectorRepo();
    expect(resolveIntegrationRef(repo)).toBe('grid-integration-20260917');
    expect(resolveIntegrationRef(repo, 'main')).toBe('main');
  });

  it('derives integrated, active, ready, and blocked milestones from repo evidence', () => {
    const repo = makeCollectorRepo();
    const coordination = path.join(repo, '.git', 'grid-agent-control', 'claims');
    mkdirSync(coordination, { recursive: true });
    const now = new Date();
    writeFileSync(path.join(coordination, 'passport.json'), JSON.stringify({
      version: 1,
      lane: 'passport',
      owner: 'agent-passport',
      goal: 'Build Grid Passport',
      scope: ['lib/grid/passport/**'],
      worktree: repo,
      branch: 'grid-passport-20260917',
      claimedAt: now.toISOString(),
      heartbeatAt: now.toISOString(),
    }));

    const taskDir = path.join(repo, '.boardroom', 'runtime', 'tasks');
    mkdirSync(taskDir, { recursive: true });
    writeFileSync(path.join(taskDir, 'production.json'), JSON.stringify({
      taskId: 'production-activation',
      title: 'Canton Production Activation',
      priority: 'P1',
      status: 'BLOCKED',
    }));

    const board = collectGridMasterBoard({ cwd: repo, now });
    const byId = new Map(board.milestones.map((item) => [item.id, item]));
    expect(board.health.integrationRef).toBe('grid-integration-20260917');
    expect(byId.get('road-network')?.status).toBe('INTEGRATED');
    expect(byId.get('passport')?.status).toBe('IN_PROGRESS');
    expect(byId.get('passport')?.owner).toBe('agent-passport');
    expect(byId.get('anti-cheat')?.status).toBe('READY_TO_INTEGRATE');
    expect(byId.get('launch-readiness')?.status).toBe('READY_TO_INTEGRATE');
    expect(byId.get('market')?.status).toBe('READY_TO_INTEGRATE');
    expect(board.health.safeNextWorkCount).toBeGreaterThan(0);
    expect(byId.get('city-compiler')?.status).toBe('SAFE_NEXT_WORK');
    expect(byId.get('production-activation')?.status).toBe('BLOCKED');
  });

  it('recognizes the canonical archive integration subject even when the original side-branch commit is not an ancestor', () => {
    const repo = makeCollectorRepo();
    git(repo, 'checkout', 'grid-integration-20260917');
    commitFile(
      repo,
      'season-archive.txt',
      'archive integrated\n',
      'GRID player loop: integrate archive power and offline defense',
    );

    const board = collectGridMasterBoard({ cwd: repo, integrationRef: 'grid-integration-20260917' });
    const archive = board.milestones.find((item) => item.id === 'season-archive');
    expect(archive?.status).toBe('INTEGRATED');
    expect(archive?.evidenceSubject).toBe('GRID player loop: integrate archive power and offline defense');
  });

  it('supports deep scan with full workspace hygiene report', () => {
    const repo = makeCollectorRepo();
    const deepBoard = collectGridMasterBoard({ cwd: repo, deep: true });
    expect(deepBoard.health.deepScan).toBe(true);
    expect(deepBoard.health.hygiene).toBeDefined();
    expect(deepBoard.hygiene).toBeDefined();
    expect(deepBoard.health.hygiene?.totalWorktrees).toBeGreaterThanOrEqual(1);
  });

  it('runs fast collection on multi-branch repository in under 2 seconds', () => {
    const repo = makeCollectorRepo();
    const start = Date.now();
    const board = collectGridMasterBoard({ cwd: repo });
    const duration = Date.now() - start;
    expect(board.version).toBe(1);
    expect(duration).toBeLessThan(2000);
  });
});

function makeCanonicalDriftRepo(): string {
  const repo = mkdtempSync(path.join(tmpdir(), 'grid-master-board-canonical-'));
  git(repo, 'init', '-b', 'main');
  git(repo, 'config', 'user.email', 'grid-board@test.local');
  git(repo, 'config', 'user.name', 'Grid Board Test');
  commitFile(repo, 'base.txt', 'base\n', 'base');

  // A legacy grid-integration-* branch that predates City Compiler work and never
  // picked up the completion commit.
  git(repo, 'checkout', '-b', 'grid-integration-20260916');
  commitFile(repo, 'legacy.txt', 'legacy\n', 'chore: legacy integration lane');
  git(repo, 'checkout', 'main');

  // A stale side branch matching city-compiler's branchPatterns that only carries
  // unrelated work, which is exactly what a broken resolver would fall back to.
  git(repo, 'checkout', '-b', 'grid-city-power-live-20260918');
  commitFile(repo, 'city-power.txt', 'city power\n', 'GRID City Power: publish live seasonal ranking');
  git(repo, 'checkout', 'main');

  // The newer canonical integration branch that actually contains the real
  // City Compiler completion commit.
  git(repo, 'checkout', '-b', 'grid-canonical-integration-20260918');
  commitFile(repo, 'compiler.txt', 'compiler\n', 'GRID Compiler 9: add CLI tooling and acceptance gate');
  git(repo, 'checkout', 'main');

  return repo;
}

describe('Grid Master Board canonical integration evidence', () => {
  it('resolveIntegrationRef prefers a newer canonical branch over the legacy naming convention', () => {
    const repo = makeCanonicalDriftRepo();
    expect(resolveIntegrationRef(repo)).toBe('grid-canonical-integration-20260918');
  });

  it('classifies City Compiler as INTEGRATED from canonical history instead of stale side-branch evidence', () => {
    const repo = makeCanonicalDriftRepo();
    const board = collectGridMasterBoard({ cwd: repo });
    const byId = new Map(board.milestones.map((item) => [item.id, item]));

    expect(board.health.integrationRef).toBe('grid-canonical-integration-20260918');
    const compiler = byId.get('city-compiler');
    expect(compiler?.status).toBe('INTEGRATED');
    expect(compiler?.evidenceSubject).toBe('GRID Compiler 9: add CLI tooling and acceptance gate');
    expect(compiler?.detail).not.toMatch(/grid-city-power-live/);
  });
});

describe('Grid Master Board completion evidence specificity', () => {
  it('does not let partial return/takeover core commits stand in for the active completion milestone', () => {
    const catalog = new Map(GRID_MILESTONES.map((item) => [item.id, item]));
    expect(catalog.get('return-experience')?.integrationCommitSignals).not.toContain('return summary');
    expect(catalog.get('return-experience')?.integrationCommitSignals).toContain('return briefing');
    expect(catalog.get('takeover')?.integrationCommitSignals).not.toContain('takeover damage');
    expect(catalog.get('takeover')?.integrationCommitSignals).toContain('takeover persistence');
  });

  it('pins completion evidence to engineering checkpoints instead of generic status or docs copy', () => {
    const catalog = new Map(GRID_MILESTONES.map((item) => [item.id, item]));
    expect(catalog.get('city-compiler')?.integrationCommitSignals).toEqual(['GRID Compiler 9:']);
    expect(catalog.get('economy-core')?.integrationCommitSignals).toEqual(['GRID Economy 8:']);
    expect(catalog.get('alliances')?.integrationCommitSignals).toEqual(['GRID Alliance 1:']);
    expect(catalog.get('chat')?.integrationCommitSignals).toEqual(['GRID Comms 6:']);
    expect(catalog.get('mobile-platform')?.integrationCommitSignals).toEqual(['GRID Mobile 9:']);
  });


  it('recognizes the exact completed Location, Season Archive, and Production Activation checkpoints', () => {
    const catalog = new Map(GRID_MILESTONES.map((item) => [item.id, item]));
    expect(catalog.get('location-play')?.integrationCommitSignals).toEqual([
      'GRID Location: add server-verified enhancement flow',
      'Merge verified Location-Enhanced Play',
    ]);
    expect(catalog.get('season-archive')?.integrationCommitSignals).toEqual([
      'GRID Season: archive final standings and Passport history',
      'GRID player loop: integrate archive power and offline defense',
    ]);
    expect(catalog.get('production-activation')?.integrationCommitSignals).toEqual([
      'GRID Production: add activation preflight',
    ]);
  });
});

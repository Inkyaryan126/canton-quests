import { describe, expect, it } from 'vitest';
import { classifyMilestone } from '../lib/grid/master-board/classify';
import type {
  GridMilestoneDefinition,
  GridMilestoneEvidence,
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

    expect(result.status).toBe('UNKNOWN');
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
});

import { GRID_MILESTONES } from '../lib/grid/master-board/milestones';

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
    expect(byId.get('auctions')?.status).toBe('READY_TO_INTEGRATE');
    expect(byId.get('production-activation')?.status).toBe('BLOCKED');
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
});

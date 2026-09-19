import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import { createClaim } from '../lib/agent-control';
import { executeMergeConveyor, planMergeConveyor } from '../lib/grid/ops/merge-conveyor';

const roots: string[] = [];

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function repo(): { root: string; target: string; source: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'grid-merge-conveyor-'));
  roots.push(root);
  git(root, 'init', '-q');
  git(root, 'config', 'user.email', 'conveyor@example.com');
  git(root, 'config', 'user.name', 'Conveyor Test');
  fs.writeFileSync(path.join(root, 'README.md'), 'base\n');
  git(root, 'add', 'README.md');
  git(root, 'commit', '-q', '-m', 'base');
  git(root, 'branch', 'grid-integration-20260919');
  const target = path.join(root, 'integration');
  const source = path.join(root, 'source');
  git(root, 'worktree', 'add', '-q', target, 'grid-integration-20260919');
  git(root, 'worktree', 'add', '-q', '-b', 'feature-ready', source, 'HEAD');
  return { root, target, source };
}

function sourceChange(context: ReturnType<typeof repo>, file = 'lib/grid/example.ts', content = 'ready\n'): void {
  fs.mkdirSync(path.dirname(path.join(context.source, file)), { recursive: true });
  fs.writeFileSync(path.join(context.source, file), content);
  git(context.source, 'add', file);
  git(context.source, 'commit', '-q', '-m', 'GRID feature: ready');
}

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe('Grid merge conveyor', () => {
  it('requires an explicit source branch and never falls back to dormant branches', () => {
    const context = repo();
    expect(() => planMergeConveyor({ cwd: context.root, integrationRef: 'grid-integration-20260919' })).toThrow(/--branch|source branch/i);
    expect(git(context.root, 'rev-parse', 'grid-integration-20260919')).toBe(git(context.root, 'rev-parse', 'HEAD'));
  });

  it('refuses main and a source branch that is already integrated', () => {
    const context = repo();
    sourceChange(context);
    expect(() => planMergeConveyor({ cwd: context.root, branch: 'feature-ready', integrationRef: 'main' })).toThrow(/dedicated integration/i);
    git(context.target, 'merge', '--no-ff', '-m', 'already integrated', 'feature-ready');
    expect(() => planMergeConveyor({ cwd: context.root, branch: 'feature-ready', integrationRef: 'grid-integration-20260919' })).toThrow(/already merged/i);
  });

  it('refuses missing, identical, claimed, dirty, and overlapping sources or targets', () => {
    const context = repo();
    expect(() => planMergeConveyor({ cwd: context.root, branch: 'missing', integrationRef: 'grid-integration-20260919' })).toThrow(/does not exist/i);
    expect(() => planMergeConveyor({ cwd: context.root, branch: 'grid-integration-20260919', integrationRef: 'grid-integration-20260919' })).toThrow(/same/i);
    sourceChange(context, 'lib/grid/example.ts');
    createClaim({ lane: 'source-claim', owner: 'agent', goal: 'unfinished', scope: ['lib/grid/**'], worktree: context.source, branch: 'feature-ready' }, context.root);
    expect(() => planMergeConveyor({ cwd: context.root, branch: 'feature-ready', integrationRef: 'grid-integration-20260919' })).toThrow(/active claim/i);
    const dirtyContext = repo();
    sourceChange(dirtyContext);
    fs.writeFileSync(path.join(dirtyContext.target, 'dirty.txt'), 'dirty\n');
    expect(() => planMergeConveyor({ cwd: dirtyContext.root, branch: 'feature-ready', integrationRef: 'grid-integration-20260919' })).toThrow(/dirty/i);
  });

  it('refuses an active claim whose scope overlaps the source diff', () => {
    const context = repo();
    sourceChange(context, 'lib/grid/example.ts');
    createClaim({ lane: 'other-lane', owner: 'agent', goal: 'parallel work', scope: ['lib/grid/**'], worktree: path.join(context.root, 'other'), branch: 'other' }, context.root);
    expect(() => planMergeConveyor({ cwd: context.root, branch: 'feature-ready', integrationRef: 'grid-integration-20260919' })).toThrow(/overlap/i);
  });

  it('dry-runs a plan without changing refs or worktrees and discovers focused tests', () => {
    const context = repo();
    sourceChange(context, 'lib/grid/feature.ts');
    fs.mkdirSync(path.join(context.source, 'tests'), { recursive: true });
    fs.writeFileSync(path.join(context.source, 'tests/grid-feature.test.ts'), 'test\n');
    git(context.source, 'add', '.');
    git(context.source, 'commit', '-q', '-m', 'add focused test');
    const before = git(context.target, 'rev-parse', 'HEAD');
    const result = planMergeConveyor({ cwd: context.root, branch: 'feature-ready', integrationRef: 'grid-integration-20260919' });
    expect(result.mode).toBe('plan');
    expect(result.canExecute).toBe(true);
    expect(result.changedPaths).toContain('lib/grid/feature.ts');
    expect(result.focusedTests).toContain('tests/grid-feature.test.ts');
    expect(git(context.target, 'rev-parse', 'HEAD')).toBe(before);
    expect(git(context.target, 'status', '--short')).toBe('');
  });

  it('preflights conflicts and refuses without mutating the integration worktree', () => {
    const context = repo();
    sourceChange(context, 'conflict.txt', 'source\n');
    git(context.target, 'checkout', '-q', '-b', 'temporary');
    fs.writeFileSync(path.join(context.target, 'conflict.txt'), 'target\n');
    git(context.target, 'add', 'conflict.txt');
    git(context.target, 'commit', '-q', '-m', 'target conflict');
    git(context.target, 'checkout', '-q', 'grid-integration-20260919');
    fs.writeFileSync(path.join(context.target, 'conflict.txt'), 'target\n');
    git(context.target, 'add', 'conflict.txt');
    git(context.target, 'commit', '-q', '-m', 'target conflict');
    expect(() => planMergeConveyor({ cwd: context.root, branch: 'feature-ready', integrationRef: 'grid-integration-20260919' })).toThrow(/conflict/i);
    expect(git(context.target, 'status', '--short')).toBe('');
  });

  it('rolls back a no-commit merge when verification fails', () => {
    const context = repo();
    sourceChange(context, 'lib/grid/feature.ts');
    const before = git(context.target, 'rev-parse', 'HEAD');
    expect(() => executeMergeConveyor({ cwd: context.root, branch: 'feature-ready', integrationRef: 'grid-integration-20260919', verification: 'node -e "process.exit(7)"' })).toThrow(/verification/i);
    expect(git(context.target, 'rev-parse', 'HEAD')).toBe(before);
    expect(git(context.target, 'status', '--short')).toBe('');
  });

  it('creates a verified merge commit and safely retires only the local source worktree/branch', () => {
    const context = repo();
    sourceChange(context, 'docs/grid-feature.md');
    git(context.root, 'update-ref', 'refs/remotes/origin/feature-ready', git(context.root, 'rev-parse', 'feature-ready'));
    const result = executeMergeConveyor({ cwd: context.root, branch: 'feature-ready', integrationRef: 'grid-integration-20260919', verification: 'git diff --check', retireSource: true });
    expect(result.executed).toBe(true);
    expect(result.mergeCommit).toMatch(/^[0-9a-f]{40}$/);
    expect(result.archiveTag).toMatch(/^grid-archive\/feature-ready\//);
    expect(git(context.target, 'log', '-1', '--format=%s')).toMatch(/Merge branch 'feature-ready'/);
    expect(git(context.root, 'worktree', 'list')).not.toContain(context.source);
    expect(() => git(context.root, 'rev-parse', '--verify', 'refs/heads/feature-ready')).toThrow();
    expect(git(context.root, 'rev-parse', 'refs/tags/' + result.archiveTag)).toBe(result.sourceCommit);
    expect(git(context.root, 'show-ref', 'refs/remotes/origin/feature-ready')).toBeTruthy();
  });
});

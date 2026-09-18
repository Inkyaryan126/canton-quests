import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import {
  auditWorkspaceHygiene,
  batchCommitHeaders,
  canonicalPath,
  claimScopesOverlap,
  coordinationIssues,
  createClaim,
  dirtyStatusPath,
  heartbeatClaim,
  listWorktreeStates,
  pruneSafeWorktrees,
  readClaims,
  releaseClaim,
  scopesOverlap,
} from '../lib/agent-control';

const tempDirs: string[] = [];

function tempRepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'grid-agent-control-'));
  tempDirs.push(dir);
  execFileSync('git', ['init', '-q'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 'Test User'], { cwd: dir });
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe('GRID agent control', () => {
  it('detects overlapping file scopes conservatively', () => {
    expect(scopesOverlap('lib/grid/roads/**', 'lib/grid/roads/routing.ts')).toBe(true);
    expect(scopesOverlap('tests/grid-road-*.test.ts', 'tests/grid-road-access.test.ts')).toBe(true);
    expect(scopesOverlap('lib/grid/roads/**', 'lib/grid/contest/**')).toBe(false);
    expect(scopesOverlap('lib/grid/server/chat-*.ts', 'lib/grid/server/auction-*.ts')).toBe(false);
    expect(scopesOverlap('supabase/migrations/*chat*.sql', 'supabase/migrations/*auction*.sql')).toBe(true);
    expect(scopesOverlap('app/grid/page.tsx', 'app/grid/page.tsx')).toBe(true);
    expect(scopesOverlap('app/grid/page.tsx', 'app/grid/layout.tsx')).toBe(false);
  });

  it('creates, heartbeats, lists, and releases a shared claim', () => {
    const repo = tempRepo();
    const claim = createClaim({
      lane: 'roads', owner: 'stream-1', goal: 'Build roads',
      scope: ['lib/grid/roads/**'], worktree: repo, branch: 'roads-branch',
    }, repo);
    expect(readClaims(repo)).toEqual([claim]);
    const beat = heartbeatClaim('roads', repo);
    expect(new Date(beat.heartbeatAt).getTime()).toBeGreaterThanOrEqual(new Date(claim.heartbeatAt).getTime());
    expect(releaseClaim('roads', repo).lane).toBe('roads');
    expect(readClaims(repo)).toEqual([]);
  });

  it('refuses a second lane whose scope overlaps an active claim', () => {
    const repo = tempRepo();
    const first = createClaim({
      lane: 'roads', owner: 'stream-1', goal: 'Build roads',
      scope: ['lib/grid/roads/**'], worktree: repo, branch: 'roads-branch',
    }, repo);
    const second = {
      ...first, lane: 'roads-ui', owner: 'stream-2',
      scope: ['lib/grid/roads/ui/**'],
    };
    expect(claimScopesOverlap(first, second)).toBe(true);
    expect(() => createClaim({
      lane: second.lane, owner: second.owner, goal: 'Build road UI',
      scope: second.scope, worktree: repo, branch: 'roads-ui-branch',
    }, repo)).toThrow(/scope overlaps active lane/i);
  });

  it('parses dirty paths including rename status lines', () => {
    expect(dirtyStatusPath('?? lib/grid/new.ts')).toBe('lib/grid/new.ts');
    expect(dirtyStatusPath(' M lib/grid/changed.ts')).toBe('lib/grid/changed.ts');
    expect(dirtyStatusPath('R  old.ts -> new.ts')).toBe('new.ts');
  });

  it('blocks preflight for unclaimed worktrees and dirty files outside a declared claim', () => {
    const boardroom = { counts: {}, queued: [], blocked: [], rejected: [], autonomousRunActive: false };
    const worktree = {
      path: '/tmp/grid-x', head: 'abc', branch: 'grid-x',
      dirtyPaths: ['?? lib/grid/owned.ts', '?? lib/grid/wandered.ts'],
      lastCommitSubject: 'x', lastCommitAt: new Date().toISOString(), activeProcessCount: 0,
    };

    expect(coordinationIssues([], [worktree], boardroom).map((issue) => issue.code)).toEqual([
      'DIRTY_UNCLAIMED',
    ]);

    const now = new Date().toISOString();
    const claim = {
      version: 1 as const, lane: 'owned', owner: 'stream', goal: 'work',
      scope: ['lib/grid/owned.ts'], worktree: '/tmp/grid-x', branch: 'grid-x',
      claimedAt: now, heartbeatAt: now,
    };
    expect(coordinationIssues([claim], [worktree], boardroom).map((issue) => issue.code)).toEqual([
      'DIRTY_OUTSIDE_CLAIM',
    ]);
  });

  it('audits workspace hygiene and categorizes worktrees accurately', () => {
    const repo = tempRepo();
    fs.writeFileSync(path.join(repo, 'base.txt'), 'base\n');
    execFileSync('git', ['add', '.'], { cwd: repo });
    execFileSync('git', ['commit', '-m', 'base commit'], { cwd: repo });
    execFileSync('git', ['branch', '-M', 'main'], { cwd: repo });

    // 1. Safe worktree: clean, merged into main, unclaimed
    const wtSafe = path.join(os.tmpdir(), `grid-wt-safe-${Math.random().toString(36).slice(2)}`);
    tempDirs.push(wtSafe);
    execFileSync('git', ['worktree', 'add', '-b', 'wt-safe-branch', wtSafe, 'main'], { cwd: repo });

    // 2. Dirty worktree: uncommitted file
    const wtDirty = path.join(os.tmpdir(), `grid-wt-dirty-${Math.random().toString(36).slice(2)}`);
    tempDirs.push(wtDirty);
    execFileSync('git', ['worktree', 'add', '-b', 'wt-dirty-branch', wtDirty, 'main'], { cwd: repo });
    fs.writeFileSync(path.join(wtDirty, 'dirty.txt'), 'dirty content\n');

    // 3. Unmerged worktree: has a commit not in main
    const wtUnmerged = path.join(os.tmpdir(), `grid-wt-unmerged-${Math.random().toString(36).slice(2)}`);
    tempDirs.push(wtUnmerged);
    execFileSync('git', ['worktree', 'add', '-b', 'wt-unmerged-branch', wtUnmerged, 'main'], { cwd: repo });
    fs.writeFileSync(path.join(wtUnmerged, 'unmerged.txt'), 'unmerged content\n');
    execFileSync('git', ['add', '.'], { cwd: wtUnmerged });
    execFileSync('git', ['commit', '-m', 'feature commit on side branch'], { cwd: wtUnmerged });

    // 4. Claimed worktree: active claim
    const wtClaimed = path.join(os.tmpdir(), `grid-wt-claimed-${Math.random().toString(36).slice(2)}`);
    tempDirs.push(wtClaimed);
    execFileSync('git', ['worktree', 'add', '-b', 'wt-claimed-branch', wtClaimed, 'main'], { cwd: repo });
    createClaim({
      lane: 'claimed-lane',
      owner: 'agent-1',
      goal: 'work on claimed',
      scope: ['claimed.txt'],
      worktree: wtClaimed,
      branch: 'wt-claimed-branch',
    }, repo);

    const report = auditWorkspaceHygiene(repo);
    expect(report.totalWorktrees).toBe(5); // primary + 4 worktrees
    expect(report.counts.SAFE_TO_PRUNE).toBe(1);
    expect(report.counts.DIRTY_DORMANT).toBe(1);
    expect(report.counts.UNMERGED_DORMANT).toBe(1);
    expect(report.counts.ACTIVE_CLAIMED).toBe(1);
    expect(report.counts.CURRENT_OR_PRIMARY).toBe(1);

    const itemSafe = report.items.find((i) => canonicalPath(i.path) === canonicalPath(wtSafe));
    expect(itemSafe?.category).toBe('SAFE_TO_PRUNE');
    expect(itemSafe?.safeToPrune).toBe(true);

    const itemDirty = report.items.find((i) => canonicalPath(i.path) === canonicalPath(wtDirty));
    expect(itemDirty?.category).toBe('DIRTY_DORMANT');
    expect(itemDirty?.safeToPrune).toBe(false);
    expect(itemDirty?.refusalReason).toMatch(/uncommitted change/i);

    const itemUnmerged = report.items.find((i) => canonicalPath(i.path) === canonicalPath(wtUnmerged));
    expect(itemUnmerged?.category).toBe('UNMERGED_DORMANT');
    expect(itemUnmerged?.safeToPrune).toBe(false);
    expect(itemUnmerged?.refusalReason).toMatch(/not merged/i);

    const itemClaimed = report.items.find((i) => canonicalPath(i.path) === canonicalPath(wtClaimed));
    expect(itemClaimed?.category).toBe('ACTIVE_CLAIMED');
    expect(itemClaimed?.safeToPrune).toBe(false);
    expect(itemClaimed?.refusalReason).toMatch(/active claim/i);
  });

  it('prunes safe worktrees only on execute, refuses unsafe ones, and preserves git branches', () => {
    const repo = tempRepo();
    fs.writeFileSync(path.join(repo, 'base.txt'), 'base\n');
    execFileSync('git', ['add', '.'], { cwd: repo });
    execFileSync('git', ['commit', '-m', 'base commit'], { cwd: repo });
    execFileSync('git', ['branch', '-M', 'main'], { cwd: repo });

    const wtSafe = path.join(os.tmpdir(), `grid-wt-safe-${Math.random().toString(36).slice(2)}`);
    tempDirs.push(wtSafe);
    execFileSync('git', ['worktree', 'add', '-b', 'wt-safe-branch', wtSafe, 'main'], { cwd: repo });
    const wtSafeCanonical = canonicalPath(wtSafe);

    const wtDirty = path.join(os.tmpdir(), `grid-wt-dirty-${Math.random().toString(36).slice(2)}`);
    tempDirs.push(wtDirty);
    execFileSync('git', ['worktree', 'add', '-b', 'wt-dirty-branch', wtDirty, 'main'], { cwd: repo });
    fs.writeFileSync(path.join(wtDirty, 'dirty.txt'), 'dirty content\n');

    const wtUnmerged = path.join(os.tmpdir(), `grid-wt-unmerged-${Math.random().toString(36).slice(2)}`);
    tempDirs.push(wtUnmerged);
    execFileSync('git', ['worktree', 'add', '-b', 'wt-unmerged-branch', wtUnmerged, 'main'], { cwd: repo });
    fs.writeFileSync(path.join(wtUnmerged, 'unmerged.txt'), 'unmerged\n');
    execFileSync('git', ['add', '.'], { cwd: wtUnmerged });
    execFileSync('git', ['commit', '-m', 'unmerged commit'], { cwd: wtUnmerged });

    // Dry-run
    const dryRun = pruneSafeWorktrees(repo, { dryRun: true });
    expect(dryRun.executed).toBe(false);
    expect(dryRun.dryRun).toBe(true);
    expect(dryRun.pruned.map((p) => canonicalPath(p.path))).toContain(wtSafeCanonical);
    expect(dryRun.refused.map((r) => canonicalPath(r.path))).toContain(canonicalPath(wtDirty));
    expect(dryRun.refused.map((r) => canonicalPath(r.path))).toContain(canonicalPath(wtUnmerged));
    expect(fs.existsSync(wtSafeCanonical)).toBe(true);

    // Execution
    const execResult = pruneSafeWorktrees(repo, { execute: true });
    expect(execResult.executed).toBe(true);
    expect(execResult.pruned.map((p) => canonicalPath(p.path))).toContain(wtSafeCanonical);
    expect(execResult.branchesPreserved).toContain('wt-safe-branch');
    expect(fs.existsSync(wtSafeCanonical)).toBe(false);

    // Git branch is preserved
    const branchCheck = execFileSync('git', ['rev-parse', '--verify', 'wt-safe-branch'], { cwd: repo, encoding: 'utf8' }).trim();
    expect(branchCheck).toBeTruthy();

    // Dirty and unmerged worktrees are preserved untouched
    expect(fs.existsSync(wtDirty)).toBe(true);
    expect(fs.existsSync(wtUnmerged)).toBe(true);
  });

  it('batches commit headers efficiently', () => {
    const repo = tempRepo();
    fs.writeFileSync(path.join(repo, 'f1.txt'), 'f1\n');
    execFileSync('git', ['add', '.'], { cwd: repo });
    execFileSync('git', ['commit', '-m', 'first commit'], { cwd: repo });
    const c1 = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim();

    fs.writeFileSync(path.join(repo, 'f2.txt'), 'f2\n');
    execFileSync('git', ['add', '.'], { cwd: repo });
    execFileSync('git', ['commit', '-m', 'second commit'], { cwd: repo });
    const c2 = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim();

    const headers = batchCommitHeaders([c1, c2], repo);
    expect(headers.get(c1)?.subject).toBe('first commit');
    expect(headers.get(c2)?.subject).toBe('second commit');
    expect(headers.get(c1)?.date).toBeTruthy();
    expect(headers.get(c2)?.date).toBeTruthy();
  });
});

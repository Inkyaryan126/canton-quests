// Canton Quests Boardroom V2 — bootstrap sequence tests.
//
// Uses a fake GitRunner so this suite never touches the real repo's git
// state, branches, or working tree.

import { describe, expect, it, vi } from 'vitest';
import { bootstrap, assertNoExtraWorktrees, generateRunId, type GitRunner } from '../lib/boardroom/preflight';

function fakeGit(overrides: Partial<Record<string, (args: string[]) => string>> = {}): GitRunner {
  const calls: string[][] = [];
  const run = (args: string[]): string => {
    calls.push(args);
    const key = args[0];
    if (overrides[key]) return overrides[key]!(args);
    if (key === 'status') return '';
    if (key === 'rev-parse') return 'basecommit1234567890';
    if (key === 'branch') return '';
    if (key === 'checkout') return '';
    if (key === 'worktree') return '/repo  abc1234 [main]';
    return '';
  };
  return { run, __calls: calls } as unknown as GitRunner & { __calls: string[][] };
}

describe('bootstrap', () => {
  it('fails at clean-working-tree when there are uncommitted changes', () => {
    const git = fakeGit({ status: () => ' M dirty-file.ts\n' });
    const result = bootstrap({ git });
    expect(result.ok).toBe(false);
    expect(result.failedStep).toBe('clean-working-tree');
  });

  it('succeeds through all four steps on a clean tree and verified checkout', () => {
    let checkedOutBranch = '';
    const git = fakeGit({
      checkout: (args) => {
        checkedOutBranch = args[2];
        return '';
      },
      branch: () => checkedOutBranch,
    });
    const result = bootstrap({ git, runId: 'TESTRUN' });
    expect(result.ok).toBe(true);
    expect(result.runId).toBe('TESTRUN');
    expect(result.branch).toBe('boardroom/astra-overnight-TESTRUN');
    expect(result.baseCommit).toBe('basecommit1234567890');
  });

  it('fails at verify-checkout when the landed branch does not match', () => {
    const git = fakeGit({ branch: () => 'some-other-branch' });
    const result = bootstrap({ git, runId: 'TESTRUN' });
    expect(result.ok).toBe(false);
    expect(result.failedStep).toBe('verify-checkout');
  });

  it('fails at create-branch when checkout throws', () => {
    const git = fakeGit({
      checkout: () => {
        throw new Error('branch already exists');
      },
    });
    const result = bootstrap({ git, runId: 'TESTRUN' });
    expect(result.ok).toBe(false);
    expect(result.failedStep).toBe('create-branch');
  });

  it('never runs task work implicitly — bootstrap only ever returns a result, it does not execute agents', () => {
    // Structural assertion: bootstrap's only side effects are the git calls it makes directly.
    const runSpy = vi.fn((args: string[]) => (args[0] === 'rev-parse' ? 'abc' : ''));
    bootstrap({ git: { run: runSpy }, runId: 'X' });
    for (const call of runSpy.mock.calls) {
      expect(['status', 'rev-parse', 'checkout', 'branch']).toContain(call[0][0]);
    }
  });

  it('override path requires BOTH flags and skips branch creation', () => {
    const git = fakeGit({ branch: () => 'main' });
    const refused = bootstrap({ git, overrideBranchCheck: true });
    expect(refused.ok).toBe(false);
    expect(refused.failedStep).toBe('override-confirmation');

    const allowed = bootstrap({ git, overrideBranchCheck: true, overrideConfirmed: true });
    expect(allowed.ok).toBe(true);
    expect(allowed.branch).toBe('main');
  });

  it('override path honors an explicit branchOverrideName label', () => {
    const git = fakeGit({ branch: () => 'boardroom/astra-overnight-PRIOR' });
    const result = bootstrap({ git, overrideBranchCheck: true, overrideConfirmed: true, branchOverrideName: 'boardroom/astra-overnight-PRIOR' });
    expect(result.ok).toBe(true);
    expect(result.branch).toBe('boardroom/astra-overnight-PRIOR');
  });

  it('generateRunId produces a distinct id each call', () => {
    const a = generateRunId();
    const b = generateRunId();
    expect(a).not.toBe(b);
  });
});

describe('assertNoExtraWorktrees', () => {
  it('passes with a single worktree', () => {
    const git = fakeGit({ worktree: () => '/repo  abc1234 [main]' });
    expect(assertNoExtraWorktrees(git)).toEqual({ ok: true, worktrees: ['/repo  abc1234 [main]'] });
  });

  it('fails when more than one worktree is listed', () => {
    const git = fakeGit({ worktree: () => '/repo  abc1234 [main]\n/repo-other  def5678 [feature]' });
    const result = assertNoExtraWorktrees(git);
    expect(result.ok).toBe(false);
    expect(result.worktrees).toHaveLength(2);
  });
});

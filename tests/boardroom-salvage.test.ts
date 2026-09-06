// Canton Quests Boardroom V2 — salvage mechanism tests.
//
// Uses a real, disposable temp git repo (stash/tag are real git primitives
// that are hard to fake meaningfully) — never the actual Canton Quests repo.

import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { salvageWorkingTree, describeSalvage } from '../lib/boardroom/salvage';
import type { GitOps } from '../lib/boardroom/supervisor';

let repoDir: string;

function gitAt(dir: string): GitOps {
  return { run: (args: string[]) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' }) };
}

beforeEach(() => {
  repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boardroom-salvage-repo-'));
  execFileSync('git', ['init', '-q'], { cwd: repoDir });
  execFileSync('git', ['config', 'user.email', 'boardroom-test@example.com'], { cwd: repoDir });
  execFileSync('git', ['config', 'user.name', 'Boardroom Test'], { cwd: repoDir });
  fs.writeFileSync(path.join(repoDir, 'README.md'), 'init\n');
  execFileSync('git', ['add', 'README.md'], { cwd: repoDir });
  execFileSync('git', ['commit', '-q', '-m', 'init'], { cwd: repoDir });
});

afterEach(() => {
  fs.rmSync(repoDir, { recursive: true, force: true });
});

describe('salvageWorkingTree', () => {
  it('returns null and touches nothing when there are no paths to salvage', () => {
    const result = salvageWorkingTree(gitAt(repoDir), { taskId: 'TASK-1', agent: 'AGY', attempt: 1, runId: 'R1', paths: [], reason: 'nothing happened' });
    expect(result).toBeNull();
  });

  it('stashes exactly the given paths (tracked and untracked) and restores a clean tree', () => {
    fs.writeFileSync(path.join(repoDir, 'tracked.txt'), 'modified\n');
    execFileSync('git', ['add', 'tracked.txt'], { cwd: repoDir });
    execFileSync('git', ['commit', '-q', '-m', 'add tracked.txt'], { cwd: repoDir });
    fs.writeFileSync(path.join(repoDir, 'tracked.txt'), 'changed again\n');
    fs.writeFileSync(path.join(repoDir, 'untracked.txt'), 'brand new\n');

    const statusBefore = execFileSync('git', ['status', '--short'], { cwd: repoDir, encoding: 'utf8' });
    expect(statusBefore.split('\n').filter(Boolean).sort()).toEqual([' M tracked.txt', '?? untracked.txt'].sort());

    const entry = salvageWorkingTree(gitAt(repoDir), {
      taskId: 'TASK-1',
      agent: 'AGY',
      attempt: 1,
      runId: 'R1',
      paths: ['tracked.txt', 'untracked.txt'],
      reason: 'BLOCKED: out of scope',
    });

    expect(entry).not.toBeNull();
    expect(entry!.pathsSalvaged).toEqual(['tracked.txt', 'untracked.txt']);
    expect(entry!.tagRef).toBe('boardroom-salvage/TASK-1-attempt1');
    expect(entry!.stashLabel).toContain('TASK-1');
    expect(entry!.stashLabel).toContain('AGY');
    expect(entry!.commitHash).toMatch(/^[0-9a-f]{40}$/);

    // The working tree is now clean — this IS the "restore to last clean commit" step.
    const statusAfter = execFileSync('git', ['status', '--short'], { cwd: repoDir, encoding: 'utf8' });
    expect(statusAfter.trim()).toBe('');
    expect(fs.existsSync(path.join(repoDir, 'untracked.txt'))).toBe(false);
    expect(fs.readFileSync(path.join(repoDir, 'tracked.txt'), 'utf8')).toBe('modified\n');
  });

  it('the tag remains a stable, independent reference even after the stash list is popped/dropped', () => {
    fs.writeFileSync(path.join(repoDir, 'a.txt'), 'a\n');
    const entry = salvageWorkingTree(gitAt(repoDir), { taskId: 'TASK-2', agent: 'CLAUDE', attempt: 1, runId: 'R1', paths: ['a.txt'], reason: 'test' })!;

    // Drop the stash entirely from the reflog — the tag must still resolve.
    execFileSync('git', ['stash', 'drop'], { cwd: repoDir });
    const listAfterDrop = execFileSync('git', ['stash', 'list'], { cwd: repoDir, encoding: 'utf8' });
    expect(listAfterDrop.trim()).toBe('');

    const resolved = execFileSync('git', ['rev-parse', entry.tagRef], { cwd: repoDir, encoding: 'utf8' }).trim();
    expect(resolved).toBe(entry.commitHash);

    // And the content is still recoverable via the tag, independent of stash@{N}
    // — a stash commit has multiple parents, so `git stash show` (not plain
    // `git show --stat`, which shows no diffstat for a merge by default) is
    // the correct way to inspect it; `-u` is needed since a.txt was untracked
    // (never `git add`ed) when it was stashed.
    const showOutput = execFileSync('git', ['stash', 'show', '--stat', '-u', entry.tagRef], { cwd: repoDir, encoding: 'utf8' });
    expect(showOutput).toContain('a.txt');
  });

  it('a second salvage for the same task+attempt overwrites the tag rather than erroring (force-tag)', () => {
    fs.writeFileSync(path.join(repoDir, 'first.txt'), '1\n');
    const first = salvageWorkingTree(gitAt(repoDir), { taskId: 'TASK-3', agent: 'AGY', attempt: 1, runId: 'R1', paths: ['first.txt'], reason: 'first' })!;

    fs.writeFileSync(path.join(repoDir, 'second.txt'), '2\n');
    const second = salvageWorkingTree(gitAt(repoDir), { taskId: 'TASK-3', agent: 'AGY', attempt: 1, runId: 'R2', paths: ['second.txt'], reason: 'second' })!;

    expect(second.tagRef).toBe(first.tagRef);
    expect(second.commitHash).not.toBe(first.commitHash);
    const resolved = execFileSync('git', ['rev-parse', second.tagRef], { cwd: repoDir, encoding: 'utf8' }).trim();
    expect(resolved).toBe(second.commitHash);
  });

  it('propagates a real git failure rather than swallowing it (e.g. salvaging a path outside the repo)', () => {
    expect(() =>
      salvageWorkingTree(gitAt(repoDir), { taskId: 'TASK-4', agent: 'AGY', attempt: 1, runId: 'R1', paths: ['/definitely/not/a/real/path/anywhere.txt'], reason: 'bogus' })
    ).toThrow();
  });
});

describe('describeSalvage', () => {
  it('gives concrete, exact recovery commands referencing the stable tag', () => {
    const text = describeSalvage({ agent: 'ASTRA', attempt: 2, stashLabel: 'boardroom-salvage-TASK-9-ASTRA-attempt2-R1', tagRef: 'boardroom-salvage/TASK-9-attempt2', commitHash: 'deadbeef', pathsSalvaged: ['lib/foo.ts', 'lib/bar.ts'], reason: 'VALIDATION FAILED: npm test' });
    expect(text).toContain('git stash show -p -u boardroom-salvage/TASK-9-attempt2');
    expect(text).toContain('git stash apply boardroom-salvage/TASK-9-attempt2');
    expect(text).toContain('lib/foo.ts');
    expect(text).toContain('lib/bar.ts');
    expect(text).toContain('never auto-applied by Boardroom');
  });
});

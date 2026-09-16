import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import {
  claimScopesOverlap,
  coordinationIssues,
  createClaim,
  dirtyStatusPath,
  diagnoseStaleClaims,
  expandClaim,
  heartbeatClaim,
  readClaims,
  releaseClaim,
  scopesOverlap,
} from '../lib/agent-control';

const tempDirs: string[] = [];

function tempRepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'grid-agent-control-'));
  tempDirs.push(dir);
  execFileSync('git', ['init', '-q'], { cwd: dir });
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
    const boardroom = { counts: {}, queued: [], blocked: [], autonomousRunActive: false };
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
});

it('reports the owning lane and a concrete scope-expansion command for out-of-claim writes', () => {
  const boardroom = { counts: {}, queued: [], blocked: [], autonomousRunActive: false };
  const now = new Date().toISOString();
  const claim = {
    version: 1 as const, lane: 'chat-system', owner: 'stream', goal: 'chat',
    scope: ['app/api/grid/chat/**'], worktree: '/tmp/grid-chat', branch: 'grid-chat',
    claimedAt: now, heartbeatAt: now,
  };
  const worktree = {
    path: '/tmp/grid-chat', head: 'abc', branch: 'grid-chat',
    dirtyPaths: ['?? supabase/migrations/20260916074000_grid_chat_sync_notifications.sql'],
    lastCommitSubject: 'chat', lastCommitAt: now, activeProcessCount: 0,
  };
  const [issue] = coordinationIssues([claim], [worktree], boardroom);
  expect(issue.message).toContain('lane=chat-system');
  expect(issue.message).toContain('owner=stream');
  expect(issue.message).toContain('supabase/migrations/20260916074000_grid_chat_sync_notifications.sql');
  expect(issue.remediation).toContain('grid:agents -- expand --lane chat-system --scope');
});

it('expands a claim only when the new scope does not collide with another lane', () => {
  const repo = tempRepo();
  createClaim({ lane: 'chat', owner: 'a', goal: 'chat', scope: ['app/grid/chat/**'], worktree: repo, branch: 'chat' }, repo);
  createClaim({ lane: 'auction', owner: 'b', goal: 'auction', scope: ['app/grid/auctions/**'], worktree: '/tmp/auction', branch: 'auction' }, repo);
  const expanded = expandClaim('chat', ['supabase/migrations/20260916074000_grid_chat_sync_notifications.sql'], repo);
  expect(expanded.scope).toContain('supabase/migrations/20260916074000_grid_chat_sync_notifications.sql');
  expect(() => expandClaim('chat', ['app/grid/auctions/page.tsx'], repo)).toThrow(/scope overlaps active lane/i);
});

it('classifies stale claims as safe to release only when their worktree is clean and idle', () => {
  const old = new Date(Date.now() - 7 * 60 * 60_000).toISOString();
  const base = { version: 1 as const, owner: 'stream', goal: 'work', scope: ['lib/grid/**'], claimedAt: old, heartbeatAt: old };
  const claims = [
    { ...base, lane: 'clean', worktree: '/tmp/clean', branch: 'clean' },
    { ...base, lane: 'dirty', worktree: '/tmp/dirty', branch: 'dirty' },
    { ...base, lane: 'busy', worktree: '/tmp/busy', branch: 'busy' },
  ];
  const state = (path: string, dirtyPaths: string[], activeProcessCount: number) => ({
    path, head: 'abc', branch: path.slice(5), dirtyPaths, lastCommitSubject: 'x', lastCommitAt: old, activeProcessCount,
  });
  expect(diagnoseStaleClaims(claims, [state('/tmp/clean', [], 0), state('/tmp/dirty', [' M lib/grid/x.ts'], 0), state('/tmp/busy', [], 1)])).toEqual([
    expect.objectContaining({ lane: 'clean', disposition: 'SAFE_TO_RELEASE' }),
    expect.objectContaining({ lane: 'dirty', disposition: 'INSPECT', reasons: expect.arrayContaining(['dirty worktree']) }),
    expect.objectContaining({ lane: 'busy', disposition: 'INSPECT', reasons: expect.arrayContaining(['active processes']) }),
  ]);
});

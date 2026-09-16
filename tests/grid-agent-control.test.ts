import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import {
  claimScopesOverlap,
  coordinationIssues,
  createClaim,
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

  it('blocks preflight only for Boardroom activity, dirty unclaimed worktrees, or stale claims', () => {
    const issues = coordinationIssues(
      [],
      [{
        path: '/tmp/grid-x', head: 'abc', branch: 'grid-x',
        dirtyPaths: ['?? file.ts'], lastCommitSubject: 'x',
        lastCommitAt: new Date().toISOString(), activeProcessCount: 0,
      }],
      { counts: {}, queued: [], blocked: [], autonomousRunActive: false },
    );
    expect(issues.map((issue) => issue.code)).toEqual(['DIRTY_UNCLAIMED']);
  });
});

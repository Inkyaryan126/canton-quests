import { execFileSync } from 'node:child_process';
import { NextResponse } from 'next/server';
import { resolveAdminSessionFromRequest } from '@/lib/admin-auth';
import {
  boardroomSummary,
  claimLifecycleState,
  coordinationIssues,
  listWorktreeStates,
  readClaims,
} from '@/lib/agent-control';
import { collectGridBuilderOsSnapshot, resolveGridBuilderIntegrationRef } from '@/lib/grid/ops/grid-builder-os';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

function recentCommits(cwd: string, ref: string | null) {
  try {
    if (!ref) return [];
    return git(cwd, ['log', '-6', '--format=%h%x09%cI%x09%an%x09%s', ref])
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [sha, at, author, ...summary] = line.split('\t');
        return { sha, at, author, summary: summary.join('\t') };
      });
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  const session = resolveAdminSessionFromRequest(request);
  if (!session.isAdmin) {
    return NextResponse.json({ error: 'Admin authorization required.' }, { status: 401 });
  }

  try {
    const hostname = new URL(request.url).hostname;
    const cwd = process.cwd();
    const snapshot = collectGridBuilderOsSnapshot({
      cwd,
      hostname,
      nodeEnv: process.env.NODE_ENV,
    });
    const allClaims = readClaims(cwd);
    const claims = allClaims.filter((claim) => claim.lane !== 'grid-builder-os' && claimLifecycleState(claim) === 'active');
    const boardroom = boardroomSummary(cwd);
    const worktrees = listWorktreeStates(cwd, { fast: true });
    const warnings = coordinationIssues(allClaims, worktrees, boardroom);
    const workerByLane = new Map(snapshot.workers.map((worker) => [worker.lane, worker]));
    const branch = resolveGridBuilderIntegrationRef(cwd) ?? git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']);
    const dirtyFiles = git(cwd, ['status', '--porcelain'])
      .split('\n')
      .filter(Boolean)
      .length;
    const commits = recentCommits(cwd, branch);

    const meta = {
      branch,
      environment: process.env.NODE_ENV ?? 'development',
      dirtyFiles,
      coordinationWarnings: warnings.length,
      boardroom: {
        counts: boardroom.counts,
        active: boardroom.queued.length,
        blocked: boardroom.blocked.length,
        rejected: boardroom.rejected.length,
      },
      lanes: claims.map((claim) => ({
        lane: claim.lane,
        owner: claim.owner,
        task: claim.goal,
        branch: claim.branch,
        claimedAt: claim.claimedAt,
        heartbeatAt: claim.heartbeatAt,
        state: workerByLane.get(claim.lane)?.state ?? 'checkpoint',
      })),
      commits,
    };

    return NextResponse.json(
      { snapshot, meta },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to read Builder OS status.' },
      { status: 500 },
    );
  }
}

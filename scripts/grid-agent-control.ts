import { execFileSync } from 'node:child_process';
import {
  boardroomSummary,
  coordinationIssues,
  createClaim,
  expandClaim,
  heartbeatClaim,
  listWorktreeStates,
  readClaims,
  releaseClaim,
  repoRoot,
  staleClaim,
} from '../lib/agent-control';

function flag(args: string[], name: string): string | undefined {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? undefined : args[index + 1];
}

function splitList(value: string | undefined): string[] {
  return value ? value.split(',').map((item) => item.trim()).filter(Boolean) : [];
}

function currentBranch(cwd: string): string {
  return execFileSync('git', ['branch', '--show-current'], { cwd, encoding: 'utf8' }).trim();
}

function formatAge(iso: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h${minutes % 60}m`;
}

function status(): void {
  const claims = readClaims();
  const worktrees = listWorktreeStates();
  const boardroom = boardroomSummary();
  const claimByWorktree = new Map(claims.map((claim) => [claim.worktree, claim]));

  console.log('# GRID AGENT CONTROL TOWER');
  console.log(`Boardroom autonomous run: ${boardroom.autonomousRunActive ? 'ACTIVE — hand-driven agents must not edit the main repo' : 'inactive'}`);
  console.log(`Live lane claims: ${claims.length}`);
  if (claims.length === 0) console.log('  (none)');
  for (const claim of claims) {
    console.log(`  ${staleClaim(claim) ? 'STALE' : 'CLAIMED'} ${claim.lane} — ${claim.owner}`);
    console.log(`    branch=${claim.branch} worktree=${claim.worktree} heartbeat=${formatAge(claim.heartbeatAt)} ago`);
    console.log(`    goal=${claim.goal}`);
    console.log(`    scope=${claim.scope.join(', ') || '(unspecified)'}`);
  }
  console.log('\nWorktrees:');
  for (const worktree of worktrees) {
    const claim = claimByWorktree.get(worktree.path);
    const dirty = worktree.dirtyPaths.length;
    const state = claim
      ? `CLAIMED:${claim.lane}`
      : dirty > 0
        ? 'DIRTY-UNCLAIMED'
        : worktree.activeProcessCount > 0
          ? 'ACTIVE-UNCLAIMED'
          : 'clean';
    console.log(`  ${state} ${worktree.branch} @ ${worktree.head.slice(0, 8)}`);
    console.log(`    ${worktree.path}`);
    console.log(`    dirty=${dirty} activeProcesses=${worktree.activeProcessCount} last=${worktree.lastCommitSubject}`);
    for (const dirtyPath of worktree.dirtyPaths.slice(0, 8)) console.log(`      ${dirtyPath}`);
    if (worktree.dirtyPaths.length > 8) console.log(`      … ${worktree.dirtyPaths.length - 8} more`);
  }

  console.log('\nBoardroom ledger:');
  const counts = Object.entries(boardroom.counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join(' ');
  console.log(`  ${counts || '(no runtime tasks found)'}`);
  for (const task of boardroom.queued.slice(0, 10)) {
    console.log(`  ${task.status} ${task.priority} ${task.taskId} — ${task.title}`);
  }
  if (boardroom.blocked.length > 0) {
    console.log(`  blocked=${boardroom.blocked.length} (use Boardroom task show/handoffs for details)`);
  }

  const issues = coordinationIssues(claims, worktrees, boardroom);
  console.log('\nCoordination warnings:');
  if (issues.length === 0) console.log('  none');
  else for (const issue of issues) {
    console.log(`  ${issue.code}: ${issue.message}`);
    if (issue.remediation) console.log(`    FIX: ${issue.remediation}`);
  }
}

function check(): void {
  const claims = readClaims();
  const worktrees = listWorktreeStates();
  const boardroom = boardroomSummary();
  const issues = coordinationIssues(claims, worktrees, boardroom);
  if (issues.length === 0) {
    console.log('GRID AGENT PREFLIGHT OK');
    return;
  }
  console.error('GRID AGENT PREFLIGHT BLOCKED');
  for (const issue of issues) {
    console.error(`  ${issue.code}: ${issue.message}`);
    if (issue.remediation) console.error(`    FIX: ${issue.remediation}`);
  }
  process.exit(1);
}
function claim(args: string[]): void {
  const lane = flag(args, 'lane');
  const owner = flag(args, 'owner');
  const goal = flag(args, 'goal');
  const scope = splitList(flag(args, 'scope'));
  const worktree = flag(args, 'worktree') ?? repoRoot();
  const branch = flag(args, 'branch') ?? currentBranch(worktree);
  if (!lane || !owner || !goal || scope.length === 0) {
    throw new Error(
      'Usage: grid:agents claim --lane NAME --owner NAME --goal "..." --scope "path/**,other/path" [--worktree PATH] [--branch NAME]',
    );
  }
  const created = createClaim({ lane, owner, goal, scope, worktree, branch });
  console.log(`CLAIMED ${created.lane} for ${created.owner}`);
  console.log(`  branch=${created.branch}`);
  console.log(`  worktree=${created.worktree}`);
  console.log(`  scope=${created.scope.join(', ')}`);
}

function expand(args: string[]): void {
  const lane = flag(args, 'lane') ?? args[0];
  const scope = splitList(flag(args, 'scope'));
  if (!lane || scope.length === 0) {
    throw new Error('Usage: grid:agents expand --lane NAME --scope "path/**,other/path"');
  }
  const updated = expandClaim(lane, scope);
  console.log(`EXPANDED ${updated.lane}`);
  console.log(`  scope=${updated.scope.join(', ')}`);
}

function heartbeat(args: string[]): void {
  const lane = flag(args, 'lane') ?? args[0];
  if (!lane) throw new Error('Usage: grid:agents heartbeat --lane NAME');
  const updated = heartbeatClaim(lane);
  console.log(`HEARTBEAT ${updated.lane} ${updated.heartbeatAt}`);
}

function release(args: string[]): void {
  const lane = flag(args, 'lane') ?? args[0];
  if (!lane) throw new Error('Usage: grid:agents release --lane NAME');
  const released = releaseClaim(lane);
  console.log(`RELEASED ${released.lane} (${released.owner})`);
}

function main(): void {
  const [command = 'status', ...args] = process.argv.slice(2);
  if (command === 'status') return status();
  if (command === 'check') return check();
  if (command === 'claim') return claim(args);
  if (command === 'expand') return expand(args);
  if (command === 'heartbeat') return heartbeat(args);
  if (command === 'release') return release(args);
  console.error('Usage: grid:agents <status|check|claim|expand|heartbeat|release> [options]');
  process.exit(2);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

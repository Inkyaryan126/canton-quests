import { execFileSync } from 'node:child_process';
import {
  auditWorkspaceHygiene,
  boardroomSummary,
  coordinationIssues,
  createClaim,
  heartbeatClaim,
  listLiveWorktreeStates,
  listWorktreeStates,
  pruneSafeWorktrees,
  readClaims,
  releaseClaim,
  repoRoot,
  staleClaim,
  worktreeCount,
} from '../lib/agent-control';
import { runGridMasterBoardCli } from '../lib/grid/master-board/cli';

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

async function status(args: string[] = []): Promise<void> {
  const claims = readClaims();
  const deep = args.includes('--deep');
  const totalWorktrees = worktreeCount();
  console.log(deep
    ? `Control Tower: deep-scanning ${totalWorktrees} worktrees...`
    : 'Control Tower: scanning live work only...');
  const worktrees = deep
    ? listWorktreeStates(process.cwd(), { deep: true })
    : await listLiveWorktreeStates(claims);
  const boardroom = boardroomSummary();
  const claimByWorktree = new Map(claims.map((claim) => [claim.worktree, claim]));

  console.log(`# GRID AGENT CONTROL TOWER${deep ? ' [DEEP SCAN]' : ''}`);
  console.log(`Boardroom autonomous run: ${boardroom.autonomousRunActive ? 'ACTIVE — hand-driven agents must not edit the main repo' : 'inactive'}`);
  console.log(`Live lane claims: ${claims.length}`);
  if (claims.length === 0) console.log('  (none)');
  for (const claim of claims) {
    console.log(`  ${staleClaim(claim) ? 'STALE' : 'CLAIMED'} ${claim.lane} — ${claim.owner}`);
    console.log(`    branch=${claim.branch} worktree=${claim.worktree} heartbeat=${formatAge(claim.heartbeatAt)} ago`);
    console.log(`    goal=${claim.goal}`);
    console.log(`    scope=${claim.scope.join(', ') || '(unspecified)'}`);
  }
  console.log(`\nWorktrees (${deep ? 'deep' : 'live'} view):`);
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
  const omitted = totalWorktrees - worktrees.length;
  if (!deep && omitted > 0) {
    console.log(`  ... ${omitted} dormant worktrees skipped (use status --deep for a full audit)`);
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
  if (boardroom.rejected && boardroom.rejected.length > 0) {
    console.log(`  rejected=${boardroom.rejected.length}`);
  }

  const issues = coordinationIssues(claims, worktrees, boardroom);
  console.log('\nCoordination warnings:');
  if (issues.length === 0) console.log('  none');
  else for (const issue of issues) console.log(`  ${issue.code}: ${issue.message}`);
}

async function check(args: string[]): Promise<void> {
  const claims = readClaims();
  const deep = args.includes('--deep');
  const totalWorktrees = worktreeCount();
  console.log(deep
    ? `GRID AGENT PREFLIGHT: deep-scanning ${totalWorktrees} worktrees...`
    : 'GRID AGENT PREFLIGHT: scanning live work only...');
  const worktrees = deep ? listWorktreeStates() : await listLiveWorktreeStates(claims);
  const boardroom = boardroomSummary();
  const issues = coordinationIssues(claims, worktrees, boardroom);
  if (issues.length === 0) {
    const omitted = totalWorktrees - worktrees.length;
    console.log(deep
      ? 'GRID AGENT PREFLIGHT OK (deep audit)'
      : `GRID AGENT PREFLIGHT OK (live scan; ${omitted} dormant worktrees skipped)`);
    return;
  }
  console.error('GRID AGENT PREFLIGHT BLOCKED');
  for (const issue of issues) console.error(`  ${issue.code}: ${issue.message}`);
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

function hygiene(args: string[]): void {
  const asJson = args.includes('--json');
  const report = auditWorkspaceHygiene(process.cwd(), { integrationRef: flag(args, 'integration-ref') });
  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  console.log('# GRID WORKSPACE HYGIENE REPORT');
  console.log(`Generated: ${report.generatedAt}`);
  console.log(`Integration ref: ${report.integrationRef ?? 'UNKNOWN'}`);
  console.log(`Total worktrees: ${report.totalWorktrees}`);
  console.log('\nWorktree category counts:');
  for (const [category, count] of Object.entries(report.counts)) {
    console.log(`  ${category}: ${count}`);
  }
  console.log('\nWorktrees:');
  for (const item of report.items) {
    const flagStr = item.safeToPrune ? 'SAFE_TO_PRUNE' : item.category;
    console.log(`  [${flagStr}] ${item.branch} @ ${item.head.slice(0, 8)}`);
    console.log(`    path: ${item.path}`);
    if (item.refusalReason) console.log(`    reason: ${item.refusalReason}`);
  }
}

function prune(args: string[]): void {
  const execute = args.includes('--execute');
  const integrationRef = flag(args, 'integration-ref');
  const result = pruneSafeWorktrees(process.cwd(), { execute, integrationRef });
  if (!execute) {
    console.log('# GRID WORKSPACE PRUNE (DRY RUN)');
    console.log('Run with --execute to remove safe worktrees.');
    console.log(`Safe to prune: ${result.pruned.length} worktree(s)`);
    for (const p of result.pruned) {
      console.log(`  WOULD PRUNE: ${p.path} (${p.branch} @ ${p.head.slice(0, 8)})`);
    }
    console.log(`\nRetained: ${result.refused.length} worktree(s)`);
    for (const r of result.refused) {
      console.log(`  RETAINED: ${r.path} (${r.branch}) — ${r.reason}`);
    }
    console.log(`\nBranches preserved: ${result.branchesPreserved.length} branch(es) (branches are never deleted)`);
    return;
  }
  console.log('# GRID WORKSPACE PRUNE EXECUTION');
  console.log(`Pruned ${result.pruned.length} worktree(s):`);
  for (const p of result.pruned) {
    console.log(`  PRUNED: ${p.path} (${p.branch} @ ${p.head.slice(0, 8)})`);
  }
  if (result.refused.length > 0) {
    console.log(`\nRetained ${result.refused.length} worktree(s):`);
    for (const r of result.refused) {
      console.log(`  RETAINED: ${r.path} (${r.branch}) — ${r.reason}`);
    }
  }
  console.log(`\nBranches preserved: ${result.branchesPreserved.length} branch(es) (branches are never deleted)`);
}

function watch(args: string[]): void {
  const code = runGridMasterBoardCli(['--watch', ...args]);
  if (code !== 0) process.exit(code);
}

async function main(): Promise<void> {
  const [command = 'status', ...args] = process.argv.slice(2);
  if (command === 'status') return status(args);
  if (command === 'check') return check(args);
  if (command === 'claim') return claim(args);
  if (command === 'heartbeat') return heartbeat(args);
  if (command === 'release') return release(args);
  if (command === 'hygiene') return hygiene(args);
  if (command === 'prune') return prune(args);
  if (command === 'watch') return watch(args);
  console.error('Usage: grid:agents <status|check|claim|heartbeat|release|hygiene|prune|watch> [options]');
  process.exit(2);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

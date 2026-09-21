import fs from 'node:fs';
import path from 'node:path';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { isBoardroomBookkeepingPath } from './boardroom/commitGate';

const execFileAsync = promisify(execFile);

export type AgentClaimState = 'reserved' | 'active';

export interface AgentClaim {
  version: 1;
  lane: string;
  owner: string;
  goal: string;
  scope: string[];
  worktree: string;
  branch: string;
  claimedAt: string;
  heartbeatAt: string;
  state?: AgentClaimState;
  activationDeadline?: string;
  reservedHead?: string;
  activatedAt?: string;
  workerPid?: number;
}

export interface WorktreeState {
  path: string;
  head: string;
  branch: string;
  dirtyPaths: string[];
  lastCommitSubject: string;
  lastCommitAt: string;
  activeProcessCount: number;
}

function runGit(args: string[], cwd = process.cwd()): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

async function runGitAsync(args: string[], cwd = process.cwd()): Promise<string> {
  const result = await execFileAsync('git', args, { cwd, encoding: 'utf8' });
  return result.stdout.trim();
}

export function repoRoot(cwd = process.cwd()): string {
  return runGit(['rev-parse', '--show-toplevel'], cwd);
}

export function gitCommonDir(cwd = process.cwd()): string {
  try {
    const gitPath = path.join(cwd, '.git');
    if (fs.existsSync(gitPath)) {
      const stat = fs.statSync(gitPath);
      if (stat.isDirectory()) {
        return path.resolve(gitPath);
      }
      if (stat.isFile()) {
        const content = fs.readFileSync(gitPath, 'utf8').trim();
        const match = content.match(/^gitdir:\s*(.+)$/m);
        if (match) {
          const gitDir = path.resolve(cwd, match[1]);
          const commondirFile = path.join(gitDir, 'commondir');
          if (fs.existsSync(commondirFile)) {
            const relCommon = fs.readFileSync(commondirFile, 'utf8').trim();
            return path.resolve(gitDir, relCommon);
          }
          return gitDir;
        }
      }
    }
  } catch {
    // fallback to git rev-parse if fs access fails
  }
  const raw = runGit(['rev-parse', '--git-common-dir'], cwd);
  return path.resolve(cwd, raw);
}

export function coordinationRoot(cwd = process.cwd()): string {
  return path.join(gitCommonDir(cwd), 'grid-agent-control');
}

export function claimsDir(cwd = process.cwd()): string {
  return path.join(coordinationRoot(cwd), 'claims');
}
interface ScopeShape {
  raw: string;
  base: string;
  wildcard: boolean;
  directory: boolean;
}

function scopeShape(scope: string): ScopeShape {
  const raw = scope.trim().replace(/^\.\//, '');
  const wildcardIndex = raw.search(/[?*[]/);
  const wildcard = wildcardIndex !== -1;
  const base = (wildcard ? raw.slice(0, wildcardIndex) : raw).replace(/\/+$/, '');
  return { raw, base, wildcard, directory: raw.endsWith('/') || raw.endsWith('/**') };
}

function shapeMatchesPrefix(shape: ScopeShape, candidate: ScopeShape): boolean {
  if (!shape.base) return true;
  if (shape.wildcard) return candidate.raw.startsWith(shape.base) || candidate.base.startsWith(shape.base);
  if (shape.directory) return candidate.raw === shape.base || candidate.raw.startsWith(`${shape.base}/`);
  return false;
}

export function scopesOverlap(a: string, b: string): boolean {
  const left = scopeShape(a);
  const right = scopeShape(b);
  if (!left.base || !right.base) return true;
  if (left.raw === right.raw || left.base === right.base) return true;
  if (shapeMatchesPrefix(left, right) || shapeMatchesPrefix(right, left)) return true;
  return false;
}

export function claimScopesOverlap(a: AgentClaim, b: AgentClaim): boolean {
  return a.scope.some((left) => b.scope.some((right) => scopesOverlap(left, right)));
}

function safeLane(lane: string): string {
  if (!/^[a-z0-9][a-z0-9._-]{1,79}$/i.test(lane)) {
    throw new Error('lane must be 2-80 characters using letters, numbers, dot, underscore, or dash');
  }
  return lane;
}

function claimPath(lane: string, cwd = process.cwd()): string {
  return path.join(claimsDir(cwd), `${safeLane(lane)}.json`);
}

export function readClaims(cwd = process.cwd()): AgentClaim[] {
  const dir = claimsDir(cwd);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')) as AgentClaim);
}
export interface CreateClaimOptions {
  state?: AgentClaimState;
  activationTtlMs?: number;
  now?: Date;
}

export function claimLifecycleState(claim: AgentClaim): AgentClaimState {
  return claim.state ?? 'active';
}

function processExists(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'EPERM');
  }
}

export function createClaim(
  input: Pick<AgentClaim, 'lane' | 'owner' | 'goal' | 'scope' | 'worktree' | 'branch'>,
  cwd = process.cwd(),
  options: CreateClaimOptions = {},
): AgentClaim {
  fs.mkdirSync(claimsDir(cwd), { recursive: true });
  const existing = readClaims(cwd);
  const now = options.now ?? new Date();
  const state = options.state ?? 'active';
  const activationTtlMs = options.activationTtlMs ?? 2 * 60_000;
  let reservedHead: string | undefined;
  if (state === 'reserved') {
    try {
      reservedHead = runGit(['rev-parse', 'HEAD'], input.worktree);
    } catch {
      reservedHead = undefined;
    }
  }
  const candidate: AgentClaim = {
    ...input,
    version: 1,
    claimedAt: now.toISOString(),
    heartbeatAt: now.toISOString(),
    state,
    ...(state === 'reserved' ? {
      activationDeadline: new Date(now.getTime() + activationTtlMs).toISOString(),
      reservedHead,
    } : {}),
  };
  if (existing.some((claim) => claim.lane === candidate.lane)) {
    throw new Error(`lane already claimed: ${candidate.lane}`);
  }
  const conflicts = existing.filter((claim) => claimScopesOverlap(claim, candidate));
  if (conflicts.length > 0) {
    throw new Error(
      `scope overlaps active lane(s): ${conflicts.map((claim) => claim.lane).join(', ')}`,
    );
  }
  fs.writeFileSync(claimPath(candidate.lane, cwd), `${JSON.stringify(candidate, null, 2)}\n`, { flag: 'wx' });
  return candidate;
}

export function activateClaim(
  lane: string,
  workerPid: number,
  cwd = process.cwd(),
  now = new Date(),
): AgentClaim {
  const filename = claimPath(lane, cwd);
  if (!fs.existsSync(filename)) throw new Error(`lane not claimed: ${lane}`);
  if (!processExists(workerPid)) throw new Error(`worker process is not running: pid ${workerPid}`);
  const claim = JSON.parse(fs.readFileSync(filename, 'utf8')) as AgentClaim;
  claim.state = 'active';
  claim.workerPid = workerPid;
  claim.activatedAt = now.toISOString();
  claim.heartbeatAt = now.toISOString();
  delete claim.activationDeadline;
  fs.writeFileSync(filename, `${JSON.stringify(claim, null, 2)}\n`);
  return claim;
}

export function heartbeatClaim(lane: string, cwd = process.cwd()): AgentClaim {
  const filename = claimPath(lane, cwd);
  if (!fs.existsSync(filename)) throw new Error(`lane not claimed: ${lane}`);
  const claim = JSON.parse(fs.readFileSync(filename, 'utf8')) as AgentClaim;
  if (claimLifecycleState(claim) === 'reserved') {
    throw new Error(`lane is reserved but no worker is active: ${lane}; activate it with a live worker PID first`);
  }
  claim.heartbeatAt = new Date().toISOString();
  fs.writeFileSync(filename, `${JSON.stringify(claim, null, 2)}\n`);
  return claim;
}

export interface ReapReservationResult {
  released: AgentClaim[];
  preserved: Array<{ claim: AgentClaim; reason: string }>;
}

export function reapAbandonedReservations(
  cwd = process.cwd(),
  options: { now?: Date } = {},
): ReapReservationResult {
  const now = options.now ?? new Date();
  const released: AgentClaim[] = [];
  const preserved: Array<{ claim: AgentClaim; reason: string }> = [];
  for (const claim of readClaims(cwd)) {
    if (claimLifecycleState(claim) !== 'reserved') continue;
    const deadline = claim.activationDeadline ? new Date(claim.activationDeadline) : null;
    if (deadline && Number.isFinite(deadline.getTime()) && deadline.getTime() > now.getTime()) continue;

    if (!fs.existsSync(claim.worktree)) {
      preserved.push({ claim, reason: 'reserved worktree no longer exists; manual review required' });
      continue;
    }
    let head = '';
    let dirty = '';
    try {
      head = runGit(['rev-parse', 'HEAD'], claim.worktree);
      dirty = runGit(['status', '--short'], claim.worktree);
    } catch {
      preserved.push({ claim, reason: 'unable to inspect reserved worktree safely' });
      continue;
    }
    if (dirty.trim()) {
      preserved.push({ claim, reason: 'reserved worktree has uncommitted changes' });
      continue;
    }
    if (claim.reservedHead && head !== claim.reservedHead) {
      preserved.push({ claim, reason: 'reserved worktree advanced after reservation' });
      continue;
    }
    fs.unlinkSync(claimPath(claim.lane, cwd));
    released.push(claim);
  }
  return { released, preserved };
}

export function releaseClaim(lane: string, cwd = process.cwd()): AgentClaim {
  const filename = claimPath(lane, cwd);
  if (!fs.existsSync(filename)) throw new Error(`lane not claimed: ${lane}`);
  const claim = JSON.parse(fs.readFileSync(filename, 'utf8')) as AgentClaim;
  fs.unlinkSync(filename);
  return claim;
}
function parseWorktrees(raw: string): Array<{ path: string; head: string; branch: string }> {
  const blocks = raw.split(/\n\n+/).map((block) => block.trim()).filter(Boolean);
  return blocks.map((block) => {
    let worktree = '';
    let head = '';
    let branch = '(detached)';
    for (const line of block.split('\n')) {
      if (line.startsWith('worktree ')) worktree = line.slice('worktree '.length);
      else if (line.startsWith('HEAD ')) head = line.slice('HEAD '.length);
      else if (line.startsWith('branch refs/heads/')) branch = line.slice('branch refs/heads/'.length);
    }
    return { path: worktree, head, branch };
  });
}

function processCommands(): string[] {
  try {
    return execFileSync('ps', ['-axo', 'command='], { encoding: 'utf8' })
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function worktreeAliases(worktreePath: string): string[] {
  const aliases = new Set([worktreePath]);
  try { aliases.add(fs.realpathSync(worktreePath)); } catch {}
  if (worktreePath.startsWith('/private/tmp/')) aliases.add(worktreePath.replace('/private/tmp/', '/tmp/'));
  if (worktreePath.startsWith('/tmp/')) aliases.add(worktreePath.replace('/tmp/', '/private/tmp/'));
  return [...aliases];
}

export interface ListWorktreeOptions {
  fast?: boolean;
  deep?: boolean;
  targetWorktrees?: string[];
}

export function batchCommitHeaders(
  commits: string[],
  cwd = process.cwd(),
): Map<string, { date: string; subject: string }> {
  const result = new Map<string, { date: string; subject: string }>();
  const unique = [...new Set(commits.filter((c) => c && c !== '(detached)' && !c.includes(' ') && !c.startsWith('(')))];
  if (unique.length === 0) return result;

  try {
    const raw = runGit(['log', '--no-walk', '--format=%H%x09%cI%x09%s', ...unique], cwd);
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      const [hash, date, ...rest] = line.split('\t');
      if (hash) {
        result.set(hash, { date: date || '', subject: rest.join('\t') || '' });
      }
    }
  } catch {
    for (const hash of unique) {
      try {
        const raw = runGit(['log', '-1', '--format=%cI%x09%s', hash], cwd);
        const [date, ...rest] = raw.split('\t');
        result.set(hash, { date: date || '', subject: rest.join('\t') || '' });
      } catch {}
    }
  }
  return result;
}

export function isAncestor(commit: string, ref: string | null, cwd = process.cwd()): boolean {
  if (!ref || !commit) return false;
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', commit, ref], { cwd, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function canonicalPath(p: string): string {
  try {
    return fs.realpathSync(p);
  } catch {
    return path.resolve(p);
  }
}

export function listWorktreeStates(
  cwd = process.cwd(),
  options: ListWorktreeOptions = {},
): WorktreeState[] {
  const raw = runGit(['worktree', 'list', '--porcelain'], cwd);
  const entries = parseWorktrees(raw);
  const processes = processCommands();

  const heads = entries.map((entry) => entry.head).filter(Boolean);
  const headers = batchCommitHeaders(heads, cwd);

  const claims = readClaims(cwd);
  const claimedPaths = new Set(claims.map((c) => canonicalPath(c.worktree)));
  const currentWorktreePath = canonicalPath(cwd);
  const targetSet = options.targetWorktrees
    ? new Set(options.targetWorktrees.map((p) => canonicalPath(p)))
    : null;

  const isDeep = options.deep === true;
  const isFast = options.fast === true || (!isDeep && options.fast !== false);

  return entries.map((entry) => {
    const resolvedPath = canonicalPath(entry.path);
    const aliases = worktreeAliases(entry.path);
    const activeProcessCount = processes.filter((command) => aliases.some((alias) => command.includes(alias))).length;

    let dirtyPaths: string[] = [];
    const shouldCheckStatus =
      isDeep ||
      (!isFast) ||
      (targetSet !== null && targetSet.has(resolvedPath)) ||
      claimedPaths.has(resolvedPath) ||
      resolvedPath === currentWorktreePath ||
      activeProcessCount > 0;

    if (shouldCheckStatus && fs.existsSync(entry.path)) {
      try {
        dirtyPaths = runGit(['status', '--short'], entry.path)
          .split('\n')
          .filter((line) => line.trim().length > 0);
      } catch {
        dirtyPaths = [];
      }
    }

    const header = headers.get(entry.head) ?? { date: '', subject: '' };
    return {
      ...entry,
      dirtyPaths,
      lastCommitSubject: header.subject,
      lastCommitAt: header.date,
      activeProcessCount,
    };
  });
}

function activeProcessCountFor(worktreePath: string, processes: string[]): number {
  const aliases = worktreeAliases(worktreePath);
  return processes.filter((command) => aliases.some((alias) => command.includes(alias))).length;
}

async function inspectWorktreeAsync(
  entry: { path: string; head: string; branch: string },
  processes: string[],
): Promise<WorktreeState> {
  const [status, commit] = await Promise.all([
    runGitAsync(['status', '--short'], entry.path),
    runGitAsync(['log', '-1', '--pretty=%s%x1f%cI'], entry.path),
  ]);
  const dirtyPaths = status.split('\n').filter((line) => line.trim().length > 0);
  const [lastCommitSubject = '', lastCommitAt = ''] = commit.split('\x1f');
  return {
    ...entry,
    dirtyPaths,
    lastCommitSubject,
    lastCommitAt,
    activeProcessCount: activeProcessCountFor(entry.path, processes),
  };
}

export function worktreeCount(cwd = process.cwd()): number {
  return parseWorktrees(runGit(['worktree', 'list', '--porcelain'], cwd)).length;
}

export async function listLiveWorktreeStates(
  claims: AgentClaim[],
  cwd = process.cwd(),
): Promise<WorktreeState[]> {
  const entries = parseWorktrees(runGit(['worktree', 'list', '--porcelain'], cwd));
  const processes = processCommands();
  const primaryPath = entries[0]?.path;
  const claimedPaths = new Set(claims.map((claim) => claim.worktree));
  const liveEntries = entries.filter((entry) => (
    entry.path === primaryPath
    || claimedPaths.has(entry.path)
    || activeProcessCountFor(entry.path, processes) > 0
  ));
  return Promise.all(liveEntries.map((entry) => inspectWorktreeAsync(entry, processes)));
}

export interface BoardroomTaskSummary {
  counts: Record<string, number>;
  queued: Array<{ taskId: string; title: string; priority: string; status: string }>;
  blocked: Array<{ taskId: string; title: string; priority: string; status: string; reason?: string }>;
  rejected: Array<{ taskId: string; title: string; priority: string; status: string; reason?: string }>;
  autonomousRunActive: boolean;
}

export function primaryWorktree(cwd = process.cwd()): string {
  const raw = runGit(['worktree', 'list', '--porcelain'], cwd);
  const first = parseWorktrees(raw)[0];
  return first?.path ?? repoRoot(cwd);
}

export function boardroomSummary(cwd = process.cwd()): BoardroomTaskSummary {
  const root = primaryWorktree(cwd);
  const taskDir = path.join(root, '.boardroom', 'runtime', 'tasks');
  const activeMarker = path.join(root, '.boardroom', 'runtime', 'AUTONOMOUS_RUN_ACTIVE');
  const tasks: Array<Record<string, unknown>> = [];
  if (fs.existsSync(taskDir)) {
    for (const name of fs.readdirSync(taskDir).filter((value) => value.endsWith('.json')).sort()) {
      try {
        tasks.push(JSON.parse(fs.readFileSync(path.join(taskDir, name), 'utf8')) as Record<string, unknown>);
      } catch {}
    }
  }
  const counts: Record<string, number> = {};
  for (const task of tasks) {
    const status = String(task.status ?? 'UNKNOWN');
    counts[status] = (counts[status] ?? 0) + 1;
  }
  const compact = (task: Record<string, unknown>) => ({
    taskId: String(task.taskId ?? ''),
    title: String(task.title ?? ''),
    priority: String(task.priority ?? ''),
    status: String(task.status ?? ''),
    reason: typeof task.reason === 'string'
      ? task.reason
      : typeof task.notes === 'string'
        ? task.notes
        : Array.isArray(task.blockers)
          ? task.blockers.join(', ')
          : undefined,
  });
  const queued = tasks
    .filter((task) => ['QUEUED', 'READY', 'SCOUTING', 'ACTIVE', 'VERIFYING', 'CHECKPOINTED', 'HANDOFF'].includes(String(task.status)))
    .map(compact);
  const blocked = tasks.filter((task) => String(task.status) === 'BLOCKED').map(compact);
  const rejected = tasks.filter((task) => String(task.status) === 'REJECTED').map(compact);
  return { counts, queued, blocked, rejected, autonomousRunActive: fs.existsSync(activeMarker) };
}

export function staleClaim(claim: AgentClaim, staleMinutes = 360): boolean {
  if (claimLifecycleState(claim) === 'reserved') {
    const deadline = claim.activationDeadline ? new Date(claim.activationDeadline).getTime() : NaN;
    return !Number.isFinite(deadline) || Date.now() > deadline;
  }
  const age = Date.now() - new Date(claim.heartbeatAt).getTime();
  return !Number.isFinite(age) || age > staleMinutes * 60_000;
}

export interface CoordinationIssue {
  code: 'BOARDROOM_ACTIVE' | 'DIRTY_UNCLAIMED' | 'DIRTY_OUTSIDE_CLAIM' | 'STALE_CLAIM';
  message: string;
}

export function coordinationIssues(
  claims: AgentClaim[],
  worktrees: WorktreeState[],
  boardroom: BoardroomTaskSummary,
): CoordinationIssue[] {
  const issues: CoordinationIssue[] = [];
  if (boardroom.autonomousRunActive) {
    issues.push({
      code: 'BOARDROOM_ACTIVE',
      message: 'Boardroom autonomous run is active; hand-driven agents must not edit the main repository.',
    });
  }

  const claimsByWorktree = new Map<string, AgentClaim[]>();
  for (const claim of claims) {
    const key = canonicalPath(claim.worktree);
    const list = claimsByWorktree.get(key) ?? [];
    list.push(claim);
    claimsByWorktree.set(key, list);
  }

  for (const worktree of worktrees) {
    const laneDirtyPaths = worktree.dirtyPaths.filter(
      (statusLine) => !isBoardroomBookkeepingPath(dirtyStatusPath(statusLine)),
    );
    if (laneDirtyPaths.length === 0) continue;

    const worktreeClaims = claimsByWorktree.get(canonicalPath(worktree.path)) ?? [];
    if (worktreeClaims.length === 0) {
      issues.push({
        code: 'DIRTY_UNCLAIMED',
        message: 'Dirty worktree has no live lane claim: ' + worktree.branch + ' — ' + worktree.path,
      });
      continue;
    }

    for (const dirtyPath of laneDirtyPaths) {
      if (worktreeClaims.some((claim) => claimCoversDirtyPath(claim, dirtyPath))) continue;
      issues.push({
        code: 'DIRTY_OUTSIDE_CLAIM',
        message: 'Dirty path is outside every claim on ' + worktree.branch + ': ' + dirtyStatusPath(dirtyPath),
      });
    }
  }

  for (const claim of claims) {
    if (staleClaim(claim)) {
      issues.push({
        code: 'STALE_CLAIM',
        message: `Claim heartbeat is stale: ${claim.lane} (${claim.worktree})`,
      });
    }
  }

  return issues;
}

export function dirtyStatusPath(statusLine: string): string {
  const stripped = statusLine.replace(/^[ MADRCU?!]{1,2}\s+/, '').trim();
  const arrow = stripped.lastIndexOf(' -> ');
  return arrow === -1 ? stripped : stripped.slice(arrow + 4).trim();
}

function claimCoversDirtyPath(claim: AgentClaim, statusLine: string): boolean {
  const filePath = dirtyStatusPath(statusLine);
  return claim.scope.some((scope) => scopesOverlap(scope, filePath));
}

export type WorktreeHygieneCategory =
  | 'ACTIVE_CLAIMED'
  | 'ACTIVE_PROCESS'
  | 'DIRTY_DORMANT'
  | 'UNMERGED_DORMANT'
  | 'CURRENT_OR_PRIMARY'
  | 'SAFE_TO_PRUNE';

export interface WorktreeHygieneItem {
  path: string;
  branch: string;
  head: string;
  category: WorktreeHygieneCategory;
  dirtyCount: number;
  activeProcessCount: number;
  claimedByLane?: string;
  claimedByOwner?: string;
  mergedIntoIntegration: boolean;
  safeToPrune: boolean;
  refusalReason?: string;
}

export interface WorkspaceHygieneReport {
  generatedAt: string;
  integrationRef: string | null;
  totalWorktrees: number;
  counts: Record<WorktreeHygieneCategory, number>;
  items: WorktreeHygieneItem[];
}

export interface PruneResult {
  executed: boolean;
  dryRun: boolean;
  pruned: Array<{ path: string; branch: string; head: string }>;
  refused: Array<{ path: string; branch: string; reason: string }>;
  branchesPreserved: string[];
}

export function resolveIntegrationBranch(cwd = process.cwd(), explicitRef?: string): string | null {
  if (explicitRef) {
    try {
      runGit(['rev-parse', '--verify', '--quiet', explicitRef], cwd);
      return explicitRef;
    } catch {
      return null;
    }
  }
  const raw = runGit(['for-each-ref', '--format=%(refname:short)', 'refs/heads'], cwd);
  const candidates = raw
    .split('\n')
    .map((s) => s.trim())
    .filter((b) => /^grid-integration-\d{8}$/.test(b))
    .sort();
  if (candidates.length > 0) return candidates[candidates.length - 1];
  try {
    runGit(['rev-parse', '--verify', '--quiet', 'main'], cwd);
    return 'main';
  } catch {
    return null;
  }
}

export function auditWorkspaceHygiene(
  cwd = process.cwd(),
  options: { integrationRef?: string } = {},
): WorkspaceHygieneReport {
  const integrationRef = resolveIntegrationBranch(cwd, options.integrationRef);
  const claims = readClaims(cwd);
  const claimsByWorktree = new Map(claims.map((c) => [canonicalPath(c.worktree), c]));
  const primaryRoot = canonicalPath(primaryWorktree(cwd));
  const currentRoot = canonicalPath(repoRoot(cwd));

  const worktrees = listWorktreeStates(cwd, { deep: true });
  const counts: Record<WorktreeHygieneCategory, number> = {
    ACTIVE_CLAIMED: 0,
    ACTIVE_PROCESS: 0,
    DIRTY_DORMANT: 0,
    UNMERGED_DORMANT: 0,
    CURRENT_OR_PRIMARY: 0,
    SAFE_TO_PRUNE: 0,
  };

  const items: WorktreeHygieneItem[] = worktrees.map((wt) => {
    const resolved = canonicalPath(wt.path);
    const claim = claimsByWorktree.get(resolved);
    const dirtyCount = wt.dirtyPaths.length;
    const activeProcessCount = wt.activeProcessCount;
    const isPrimaryOrCurrent = resolved === primaryRoot || resolved === currentRoot;
    const mergedIntoIntegration = isAncestor(wt.head, integrationRef, cwd);

    let category: WorktreeHygieneCategory;
    let refusalReason: string | undefined;
    let safeToPrune = false;

    if (isPrimaryOrCurrent) {
      category = 'CURRENT_OR_PRIMARY';
      refusalReason = 'Current working directory or primary repository working tree';
    } else if (claim) {
      category = 'ACTIVE_CLAIMED';
      refusalReason = `Worktree has active claim: lane="${claim.lane}" owner="${claim.owner}"`;
    } else if (activeProcessCount > 0) {
      category = 'ACTIVE_PROCESS';
      refusalReason = `Worktree has ${activeProcessCount} active process(es) running`;
    } else if (dirtyCount > 0) {
      category = 'DIRTY_DORMANT';
      refusalReason = `Worktree has ${dirtyCount} uncommitted change(s); dirty work must never be deleted`;
    } else if (!mergedIntoIntegration) {
      category = 'UNMERGED_DORMANT';
      refusalReason = `HEAD commit (${wt.head.slice(0, 8)}) on ${wt.branch} is not merged into ${integrationRef ?? 'integration'}; unmerged work must never be deleted`;
    } else {
      category = 'SAFE_TO_PRUNE';
      safeToPrune = true;
    }

    counts[category] = (counts[category] ?? 0) + 1;

    return {
      path: wt.path,
      branch: wt.branch,
      head: wt.head,
      category,
      dirtyCount,
      activeProcessCount,
      claimedByLane: claim?.lane,
      claimedByOwner: claim?.owner,
      mergedIntoIntegration,
      safeToPrune,
      refusalReason,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    integrationRef,
    totalWorktrees: worktrees.length,
    counts,
    items,
  };
}

export function pruneSafeWorktrees(
  cwd = process.cwd(),
  options: { execute?: boolean; dryRun?: boolean; integrationRef?: string } = {},
): PruneResult {
  const audit = auditWorkspaceHygiene(cwd, options);
  const shouldExecute = options.execute === true && options.dryRun !== true;
  const pruned: Array<{ path: string; branch: string; head: string }> = [];
  const refused: Array<{ path: string; branch: string; reason: string }> = [];
  const branchesPreserved: string[] = [];

  for (const item of audit.items) {
    if (!item.safeToPrune) {
      refused.push({
        path: item.path,
        branch: item.branch,
        reason: item.refusalReason ?? 'Not safe to prune',
      });
      continue;
    }

    // Double-check safety invariants immediately before executing
    if (shouldExecute) {
      if (fs.existsSync(item.path)) {
        const dirtyCheck = runGit(['status', '--short'], item.path).trim();
        if (dirtyCheck.length > 0) {
          refused.push({
            path: item.path,
            branch: item.branch,
            reason: 'Worktree became dirty immediately before removal; refused',
          });
          continue;
        }
      }
      try {
        runGit(['worktree', 'remove', item.path], cwd);
        pruned.push({ path: item.path, branch: item.branch, head: item.head });
        branchesPreserved.push(item.branch);
      } catch (err) {
        refused.push({
          path: item.path,
          branch: item.branch,
          reason: err instanceof Error ? err.message : String(err),
        });
      }
    } else {
      pruned.push({ path: item.path, branch: item.branch, head: item.head });
      branchesPreserved.push(item.branch);
    }
  }

  return {
    executed: shouldExecute,
    dryRun: !shouldExecute,
    pruned,
    refused,
    branchesPreserved,
  };
}

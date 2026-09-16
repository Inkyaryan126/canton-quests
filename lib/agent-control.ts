import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

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

export function repoRoot(cwd = process.cwd()): string {
  return runGit(['rev-parse', '--show-toplevel'], cwd);
}

export function gitCommonDir(cwd = process.cwd()): string {
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
export function createClaim(
  input: Omit<AgentClaim, 'version' | 'claimedAt' | 'heartbeatAt'>,
  cwd = process.cwd(),
): AgentClaim {
  fs.mkdirSync(claimsDir(cwd), { recursive: true });
  const existing = readClaims(cwd);
  const candidate: AgentClaim = {
    ...input,
    version: 1,
    claimedAt: new Date().toISOString(),
    heartbeatAt: new Date().toISOString(),
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

export function heartbeatClaim(lane: string, cwd = process.cwd()): AgentClaim {
  const filename = claimPath(lane, cwd);
  if (!fs.existsSync(filename)) throw new Error(`lane not claimed: ${lane}`);
  const claim = JSON.parse(fs.readFileSync(filename, 'utf8')) as AgentClaim;
  claim.heartbeatAt = new Date().toISOString();
  fs.writeFileSync(filename, `${JSON.stringify(claim, null, 2)}\n`);
  return claim;
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

export function listWorktreeStates(cwd = process.cwd()): WorktreeState[] {
  const raw = runGit(['worktree', 'list', '--porcelain'], cwd);
  const processes = processCommands();
  return parseWorktrees(raw).map((entry) => {
    const dirtyPaths = runGit(['status', '--short'], entry.path)
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    const lastCommitSubject = runGit(['log', '-1', '--pretty=%s'], entry.path);
    const lastCommitAt = runGit(['log', '-1', '--format=%cI'], entry.path);
    const aliases = worktreeAliases(entry.path);
    const activeProcessCount = processes.filter((command) => aliases.some((alias) => command.includes(alias))).length;
    return { ...entry, dirtyPaths, lastCommitSubject, lastCommitAt, activeProcessCount };
  });
}
export interface BoardroomTaskSummary {
  counts: Record<string, number>;
  queued: Array<{ taskId: string; title: string; priority: string; status: string }>;
  blocked: Array<{ taskId: string; title: string; priority: string; status: string }>;
  autonomousRunActive: boolean;
}

function primaryWorktree(cwd = process.cwd()): string {
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
  });
  const queued = tasks
    .filter((task) => ['QUEUED', 'READY', 'SCOUTING', 'ACTIVE', 'VERIFYING', 'CHECKPOINTED', 'HANDOFF'].includes(String(task.status)))
    .map(compact);
  const blocked = tasks.filter((task) => String(task.status) === 'BLOCKED').map(compact);
  return { counts, queued, blocked, autonomousRunActive: fs.existsSync(activeMarker) };
}

export function staleClaim(claim: AgentClaim, staleMinutes = 360): boolean {
  const age = Date.now() - new Date(claim.heartbeatAt).getTime();
  return !Number.isFinite(age) || age > staleMinutes * 60_000;
}

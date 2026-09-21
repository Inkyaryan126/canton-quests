import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  boardroomSummary,
  canonicalPath,
  coordinationIssues,
  coordinationRoot,
  listWorktreeStates,
  readClaims,
  resolveIntegrationBranch,
  staleClaim,
  type CoordinationIssue,
} from '../../agent-control';
import { collectGridMasterBoard } from '../master-board/collect';
import type { GridMilestoneStatus } from '../master-board/types';
import { collectPlayableLoopScore } from './playable-loop-score';
import { recommendGridProductWork } from './product-director';
import { resolvePreferredLocalBinary } from './local-toolchain';

export type GridBuilderRunStatus = 'idle' | 'working' | 'finished' | 'needs_attention';
export type GridBuilderHealthRunStatus = 'idle' | 'working' | 'finished' | 'needs_attention';
export type GridBuilderWorkerState = 'working' | 'checkpoint' | 'needs_attention';
export type GridBuilderCliName = 'codex' | 'claude' | 'gemini';
export type GridBuilderCliHealthStatus = 'ready' | 'installed' | 'needs_attention' | 'unavailable';

function gridBuilderCliLabel(name: GridBuilderCliName): string {
  return name[0].toUpperCase() + name.slice(1);
}

export function formatGridBuilderCliFailureDetail(
  name: GridBuilderCliName,
  stdout: string,
  stderr: string,
  exitCode: number | null,
): string {
  const output = `${stdout}\n${stderr}`.toLowerCase();
  if (
    name === 'claude'
    && /(failed to authenticate|oauth session expired|auth(?:entication)? (?:failure|failed|.*expired))/i.test(output)
  ) {
    return 'Claude sign-in expired. Run claude auth login in Terminal.';
  }
  if (name === 'codex' && /requires a newer version|newer version of codex/i.test(output)) {
    return 'Codex CLI needs an upgrade. Upgrade Codex CLI, then rerun crew health.';
  }
  if (/(credit|quota|payment|resource[- ]exhausted|usage limit|rate limit)/i.test(output)) {
    return 'Account credits or quota are unavailable. Check account billing or quota, then rerun crew health.';
  }
  return `${gridBuilderCliLabel(name)} health probe failed (exit code ${String(exitCode)}). Check the CLI and rerun crew health.`;
}

export interface GridBuilderCliHealth {
  name: GridBuilderCliName;
  label: string;
  role: string;
  status: GridBuilderCliHealthStatus;
  version: string | null;
  detail: string;
  checkedAt: string | null;
}

export interface GridBuilderCliHealthCache {
  version: 1;
  checkedAt: string;
  entries: Partial<Record<GridBuilderCliName, {
    status: 'ready' | 'needs_attention';
    version?: string | null;
    detail: string;
  }>>;
}

export interface GridBuilderHealthRunState {
  version: 1;
  runId: string;
  status: GridBuilderHealthRunStatus;
  pid?: number;
  startedAt?: string;
  endedAt?: string;
  message: string;
}

export interface GridBuilderRunState {
  version: 1;
  runId: string;
  status: GridBuilderRunStatus;
  pid?: number;
  leadPid?: number;
  lead?: 'codex' | 'claude';
  startedAt?: string;
  endedAt?: string;
  exitCode?: number | null;
  message: string;
}

export interface GridBuilderWorker {
  lane: string;
  role: string;
  state: GridBuilderWorkerState;
  task: string;
  lastUpdate: string;
  dirtyFiles: number;
  activeProcesses: number;
}

export interface GridBuilderOsSnapshot {
  generatedAt: string;
  overall: {
    completed: number;
    readyToCombine: number;
    total: number;
    percent: number;
  };
  playableLoop: {
    score: number;
    status: string;
    brokenLink: string | null;
    nextRepair: string | null;
  };
  crewHealth: GridBuilderCliHealth[];
  crewHealthRun: GridBuilderHealthRunState;
  workers: GridBuilderWorker[];
  recommendations: Array<{
    id: string;
    title: string;
    action: string;
    whyNow: string;
    specialization: string;
  }>;
  needsYou: string[];
  recentActivity: Array<{ commit: string; at: string; summary: string }>;
  run: GridBuilderRunState;
  controls: {
    canStartCycle: boolean;
    reasons: string[];
  };
}

export function isGridBuilderSteadyState(
  snapshot: Pick<GridBuilderOsSnapshot, 'overall' | 'playableLoop' | 'workers' | 'recommendations'>,
): boolean {
  return (
    snapshot.overall.total > 0
    && snapshot.overall.completed === snapshot.overall.total
    && snapshot.overall.readyToCombine === 0
    && snapshot.playableLoop.status === 'GREEN'
    && snapshot.workers.length === 0
    && snapshot.recommendations.length === 0
  );
}

export function gridBuilderStateDir(cwd = process.cwd()): string {
  return path.join(coordinationRoot(cwd), 'builder-os');
}

export function gridBuilderStateFile(cwd = process.cwd()): string {
  return path.join(gridBuilderStateDir(cwd), 'state.json');
}

export function gridBuilderLogFile(cwd = process.cwd()): string {
  return path.join(gridBuilderStateDir(cwd), 'latest.log');
}

export function gridBuilderCliHealthFile(cwd = process.cwd()): string {
  return path.join(gridBuilderStateDir(cwd), 'cli-health.json');
}

export function gridBuilderCliHealthStateFile(cwd = process.cwd()): string {
  return path.join(gridBuilderStateDir(cwd), 'cli-health-state.json');
}

export function gridBuilderLaunchTokenFile(cwd = process.cwd()): string {
  return path.join(gridBuilderStateDir(cwd), 'launch-token.json');
}

export function issueGridBuilderLaunchToken(
  cwd = process.cwd(),
  options: { ttlMs?: number; token?: string; now?: Date } = {},
): string {
  const token = options.token ?? crypto.randomBytes(32).toString('hex');
  const now = options.now ?? new Date();
  const ttlMs = options.ttlMs ?? 2 * 60 * 1000;
  const payload = {
    version: 1,
    tokenHash: crypto.createHash('sha256').update(token).digest('hex'),
    expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
  };
  fs.mkdirSync(gridBuilderStateDir(cwd), { recursive: true });
  fs.writeFileSync(gridBuilderLaunchTokenFile(cwd), `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
  return token;
}

export function consumeGridBuilderLaunchToken(
  token: string,
  cwd = process.cwd(),
  now = new Date(),
): boolean {
  if (!token) return false;
  const filename = gridBuilderLaunchTokenFile(cwd);
  if (!fs.existsSync(filename)) return false;

  try {
    const payload = JSON.parse(fs.readFileSync(filename, 'utf8')) as {
      version?: number;
      tokenHash?: string;
      expiresAt?: string;
    };
    const expiresAt = payload.expiresAt ? new Date(payload.expiresAt) : null;
    if (
      payload.version !== 1
      || !payload.tokenHash
      || !expiresAt
      || !Number.isFinite(expiresAt.getTime())
      || expiresAt.getTime() < now.getTime()
    ) {
      fs.rmSync(filename, { force: true });
      return false;
    }

    const suppliedHash = crypto.createHash('sha256').update(token).digest('hex');
    const expected = Buffer.from(payload.tokenHash);
    const supplied = Buffer.from(suppliedHash);
    if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) {
      return false;
    }

    fs.rmSync(filename, { force: true });
    return true;
  } catch {
    fs.rmSync(filename, { force: true });
    return false;
  }
}

export function resolvePreferredCliBinary(
  name: GridBuilderCliName,
  options: { homeDir?: string; pathEnv?: string; env?: NodeJS.ProcessEnv } = {},
): string | null {
  const env = options.env ?? process.env;
  return resolvePreferredLocalBinary(name, {
    homeDir: options.homeDir,
    pathEnv: options.pathEnv ?? env.PATH,
    override: env[`GRID_BUILDER_${name.toUpperCase()}_BIN`],
  });
}

export function readGridBuilderCliHealthCache(cwd = process.cwd()): GridBuilderCliHealthCache | null {
  const filename = gridBuilderCliHealthFile(cwd);
  if (!fs.existsSync(filename)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(filename, 'utf8')) as GridBuilderCliHealthCache;
    if (parsed.version !== 1 || !parsed.checkedAt || !parsed.entries) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeGridBuilderCliHealthCache(
  cache: GridBuilderCliHealthCache,
  cwd = process.cwd(),
): void {
  fs.mkdirSync(gridBuilderStateDir(cwd), { recursive: true });
  fs.writeFileSync(gridBuilderCliHealthFile(cwd), `${JSON.stringify(cache, null, 2)}\n`);
}

export function collectGridBuilderCliHealth(cwd = process.cwd()): GridBuilderCliHealth[] {
  const cache = readGridBuilderCliHealthCache(cwd);
  const definitions: Array<{ name: GridBuilderCliName; label: string; role: string }> = [
    { name: 'codex', label: 'Codex', role: 'Lead Builder' },
    { name: 'claude', label: 'Claude', role: 'Backup Engineer' },
    { name: 'gemini', label: 'Gemini', role: 'Fast Builder' },
  ];

  return definitions.map((definition) => {
    const binary = resolvePreferredCliBinary(definition.name);
    if (!binary) {
      return {
        ...definition,
        status: 'unavailable' as const,
        version: null,
        detail: 'Not installed in the preferred local toolchain.',
        checkedAt: null,
      };
    }

    const cached = cache?.entries[definition.name];
    if (cached) {
      return {
        ...definition,
        status: cached.status,
        version: cached.version ?? null,
        detail: cached.detail,
        checkedAt: cache.checkedAt,
      };
    }

    return {
      ...definition,
      status: 'installed' as const,
      version: null,
      detail: 'Installed. Run CHECK CREW NOW for live model health and version.',
      checkedAt: null,
    };
  });
}

export function writeGridBuilderCliHealthRunState(
  state: GridBuilderHealthRunState,
  cwd = process.cwd(),
): void {
  fs.mkdirSync(gridBuilderStateDir(cwd), { recursive: true });
  fs.writeFileSync(gridBuilderCliHealthStateFile(cwd), `${JSON.stringify(state, null, 2)}\n`);
}

export function readGridBuilderCliHealthRunState(cwd = process.cwd()): GridBuilderHealthRunState {
  const filename = gridBuilderCliHealthStateFile(cwd);
  if (!fs.existsSync(filename)) {
    return { version: 1, runId: 'none', status: 'idle', message: 'Crew health has not been checked yet.' };
  }
  try {
    const state = JSON.parse(fs.readFileSync(filename, 'utf8')) as GridBuilderHealthRunState;
    if (state.status === 'working' && !processAlive(state.pid)) {
      return {
        ...state,
        status: 'needs_attention',
        endedAt: state.endedAt ?? new Date().toISOString(),
        message: 'The last crew-health check stopped unexpectedly. Run it again.',
      };
    }
    return state;
  } catch {
    return {
      version: 1,
      runId: 'unknown',
      status: 'needs_attention',
      message: 'Builder OS could not read the last crew-health check.',
    };
  }
}

export function writeGridBuilderRunState(state: GridBuilderRunState, cwd = process.cwd()): void {
  fs.mkdirSync(gridBuilderStateDir(cwd), { recursive: true });
  fs.writeFileSync(gridBuilderStateFile(cwd), `${JSON.stringify(state, null, 2)}\n`);
}

export function gridBuilderProcessProbeErrorMeansAlive(error: unknown): boolean {
  return Boolean(
    error
    && typeof error === 'object'
    && 'code' in error
    && (error as NodeJS.ErrnoException).code === 'EPERM',
  );
}

function processAlive(pid?: number): boolean {
  if (!pid || !Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return gridBuilderProcessProbeErrorMeansAlive(error);
  }
}

export function readGridBuilderRunState(cwd = process.cwd()): GridBuilderRunState {
  const filename = gridBuilderStateFile(cwd);
  if (!fs.existsSync(filename)) {
    return { version: 1, runId: 'none', status: 'idle', message: 'Ready for the next build cycle.' };
  }
  try {
    const state = JSON.parse(fs.readFileSync(filename, 'utf8')) as GridBuilderRunState;
    if (state.status === 'working' && !processAlive(state.pid)) {
      return {
        ...state,
        status: 'needs_attention',
        endedAt: state.endedAt ?? new Date().toISOString(),
        message: 'The last build cycle stopped unexpectedly. It is safe to inspect before restarting.',
      };
    }
    return state;
  } catch {
    return {
      version: 1,
      runId: 'unknown',
      status: 'needs_attention',
      message: 'Builder OS could not read its last run state.',
    };
  }
}

export function isLocalBuilderHostname(hostname: string): boolean {
  const clean = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return clean === 'localhost' || clean === '127.0.0.1' || clean === '::1';
}

export function summarizeMilestoneProgress(statuses: GridMilestoneStatus[]): {
  completed: number;
  readyToCombine: number;
  total: number;
  percent: number;
} {
  const total = statuses.length;
  const completed = statuses.filter((status) => status === 'INTEGRATED').length;
  const readyToCombine = statuses.filter((status) => status === 'READY_TO_INTEGRATE').length;
  return {
    completed,
    readyToCombine,
    total,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
  };
}

export function humanizeBuilderOwner(owner: string): string {
  const value = owner.toLowerCase();
  if (value.includes('codex') || value.includes('astra')) return 'Lead Builder';
  if (value.includes('claude')) return 'Engineer';
  if (value.includes('gemini') || value.includes('agy') || value.includes('antigravity')) return 'Fast Builder';
  return 'Builder';
}

export function deriveBuilderWorkerState(input: {
  stale: boolean;
  activeProcesses: number;
  dirtyFiles: number;
}): GridBuilderWorkerState {
  if (input.stale) return 'needs_attention';
  if (input.activeProcesses > 0 || input.dirtyFiles > 0) return 'working';
  return 'checkpoint';
}

export function evaluateBuilderStartGuard(input: {
  hostname: string;
  nodeEnv: string | undefined;
  issues: CoordinationIssue[];
  run: GridBuilderRunState;
}): { canStart: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (!isLocalBuilderHostname(input.hostname)) reasons.push('Open Builder OS on this Mac using localhost.');
  if (input.nodeEnv === 'production') reasons.push('Builder OS cannot start development agents from production.');
  if (input.issues.length > 0) reasons.push('Control Tower has a coordination warning that must be cleared first.');
  if (input.run.status === 'working') reasons.push('A build cycle is already running.');
  return { canStart: reasons.length === 0, reasons };
}

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

export function resolveGridBuilderIntegrationRef(cwd = process.cwd()): string | null {
  try {
    const branches = git(cwd, ['for-each-ref', '--format=%(refname:short)', 'refs/heads'])
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    const canonical = branches.filter((branch) => /^grid-canonical-integration-\d{8}$/.test(branch)).sort();
    if (canonical.length > 0) return canonical[canonical.length - 1];
  } catch {
    // Existing resolver below remains the fallback.
  }
  return resolveIntegrationBranch(cwd);
}

function recentActivity(cwd: string, ref: string | null): GridBuilderOsSnapshot['recentActivity'] {
  if (!ref) return [];
  try {
    return git(cwd, ['log', '-6', '--format=%h%x09%cI%x09%s', ref])
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [commit, at, ...summary] = line.split('\t');
        return { commit, at, summary: summary.join('\t') };
      });
  } catch {
    return [];
  }
}

export function collectGridBuilderOsSnapshot(options: {
  cwd?: string;
  hostname?: string;
  nodeEnv?: string;
} = {}): GridBuilderOsSnapshot {
  const cwd = options.cwd ?? process.cwd();
  const integrationRef = resolveGridBuilderIntegrationRef(cwd);
  const claims = readClaims(cwd);
  const worktrees = listWorktreeStates(cwd, { fast: true });
  const boardroom = boardroomSummary(cwd);
  const issues = coordinationIssues(claims, worktrees, boardroom);
  const board = collectGridMasterBoard({ cwd, integrationRef: integrationRef ?? undefined });
  const playable = collectPlayableLoopScore({ cwd, board });
  const director = recommendGridProductWork({
    masterBoard: board,
    claims,
    limit: 3,
    playableLoopScore: playable,
  });
  const worktreeByPath = new Map(worktrees.map((item) => [canonicalPath(item.path), item]));
  const workers = claims
    .filter((claim) => claim.lane !== 'grid-builder-os')
    .map((claim) => {
      const worktree = worktreeByPath.get(canonicalPath(claim.worktree));
      const dirtyFiles = worktree?.dirtyPaths.length ?? 0;
      const activeProcesses = worktree?.activeProcessCount ?? 0;
      return {
        lane: claim.lane,
        role: humanizeBuilderOwner(claim.owner),
        state: deriveBuilderWorkerState({
          stale: staleClaim(claim),
          activeProcesses,
          dirtyFiles,
        }),
        task: claim.goal,
        lastUpdate: claim.heartbeatAt,
        dirtyFiles,
        activeProcesses,
      };
    });
  const run = readGridBuilderRunState(cwd);
  const crewHealthRun = readGridBuilderCliHealthRunState(cwd);
  const crewHealth = collectGridBuilderCliHealth(cwd);
  const guard = evaluateBuilderStartGuard({
    hostname: options.hostname ?? 'localhost',
    nodeEnv: options.nodeEnv ?? process.env.NODE_ENV,
    issues,
    run,
  });
  const needsYou = issues.map((issue) => issue.message);
  if (run.status === 'needs_attention') needsYou.push(run.message);
  if (crewHealthRun.status === 'needs_attention') needsYou.push(crewHealthRun.message);
  for (const agent of crewHealth.filter((item) => item.status === 'needs_attention' || item.status === 'unavailable')) {
    needsYou.push(`${agent.label}: ${agent.detail}`);
  }
  for (const worker of workers.filter((item) => item.state === 'needs_attention')) {
    needsYou.push(`${worker.role} has not checked in recently: ${worker.task}`);
  }

  return {
    generatedAt: new Date().toISOString(),
    overall: summarizeMilestoneProgress(board.milestones.map((item) => item.status)),
    playableLoop: {
      score: playable.score,
      status: playable.status,
      brokenLink: playable.highestValueBrokenLink?.title ?? null,
      nextRepair: playable.highestValueBrokenLink?.recommendation ?? null,
    },
    crewHealth,
    crewHealthRun,
    workers,
    recommendations: director.recommendations.map((item) => ({
      id: item.id,
      title: item.title,
      action: item.actionType === 'INTEGRATE' ? 'Ready to combine' : 'Build next',
      whyNow: item.whyNow,
      specialization: item.specialization,
    })),
    needsYou: Array.from(new Set(needsYou)),
    recentActivity: recentActivity(cwd, integrationRef),
    run,
    controls: {
      canStartCycle: guard.canStart,
      reasons: guard.reasons,
    },
  };
}

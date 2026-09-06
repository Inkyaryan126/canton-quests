/**
 * Canton Quests Boardroom V2 — the supervisor loop.
 *
 * Wires every other module (lock, tasks, attempts, budget, routing,
 * commitGate, preflight, runLifecycle, adapters) into the single
 * authoritative per-task sequence Dustin specified verbatim:
 *
 *   agent runs -> capture result -> inspect actual changed paths ->
 *   commitGate.evaluateChangedPaths() -> BLOCK immediately if anything is
 *   outside WRITE_SCOPE -> run TESTS_REQUIRED -> if validation passes,
 *   stage exact approved paths only -> Boardroom creates the commit ->
 *   update task/checkpoint with resulting commit hash -> release writer
 *   lock -> route next task.
 *
 * The write lock is acquired before the agent runs and is held
 * continuously through validation and the commit — it is never released in
 * the gap between an agent finishing its edits and the checkpoint landing.
 *
 * Everything that touches the outside world (git, the CLI adapters, the
 * test runner, sleep prevention, process-signal registration) is
 * dependency-injected so the whole loop can run against
 * tests/fixtures/fake-cli.sh and a fake GitRunner in tests, never against
 * the real repo or real Astra/Claude/Agy usage.
 */
import { execFileSync } from 'child_process';
import { bootstrap, assertNoExtraWorktrees, realGit, type GitRunner, type BootstrapOptions } from './preflight';
import { checkAndRecoverMarker, writeMarker, clearMarker, registerCleanupHandlers, startSleepPrevention } from './runLifecycle';
import { acquireLock, releaseLock, assessStaleLock, recoverStaleLock, LockHeldByAnotherAgentError } from './lock';
import { listTasks, getTask, updateTaskStatus, checkpoint, recordFilesTouched, recordTestResult, addBlocker, setCurrentCommit, recordSalvage } from './tasks';
import { recordAttempt, checkThreshold } from './attempts';
import { getBudgetState, selfReportAllowance, requestReset, classifyTier } from './budget';
import { defaultAssignment, applyBudgetConservation, type WorkCategory, type RoutingAssignment } from './routing';
import { evaluateChangedPaths, parseGitStatusShort, isBoardroomBookkeepingPath } from './commitGate';
import { getAdapter } from './adapters/registry';
import { probeAgentHealth } from './adapters/probe';
import { salvageWorkingTree, describeSalvage } from './salvage';
import { invocationLogFile } from './paths';
import { writeHandoff } from './handoff';
import { writeMorningReport, type RunSummary } from './report';
import type { Task, AgentName, TestResult, Priority } from './types';

export interface GitOps extends GitRunner {}

export const realGitOps: GitOps = realGit;

function statusShort(git: GitOps): string {
  try {
    // `--untracked-files=all` is load-bearing, not cosmetic: by default `git
    // status --short` collapses a wholly-new, never-before-tracked directory
    // into a single directory-level entry (e.g. `?? boardroom/recon/`)
    // instead of listing the individual file(s) inside it. `git add`/`git
    // diff --cached --name-only` never collapse like that — they always
    // report real file paths. Without `=all` here, a task whose first-ever
    // write lands in a brand-new scope directory gets a "changed path" of
    // just the directory name, which then flows into gate.inScope as that
    // same bare directory string; the file gets staged correctly, but the
    // post-stage exact-set comparison then sees "approved: boardroom/recon/"
    // vs "staged: boardroom/recon/astra-experiential-audit.md" — two
    // different strings for the same real content — and falsely fails with
    // EXACT_STAGING_VERIFICATION_FAILED. Reproduced and fixed after the
    // second real overnight run; see the regression test in
    // tests/boardroom-hardening-extra.test.ts.
    return git.run(['status', '--short', '--untracked-files=all']);
  } catch {
    return '';
  }
}

function stageExactPaths(git: GitOps, paths: string[]): void {
  for (const p of paths) git.run(['add', '--', p]);
}

/**
 * Commits ONLY the given paths, never a bare `git commit -m` — a bare commit
 * commits the ENTIRE index regardless of what this call staged, so if some
 * other path ever leaves unrelated content sitting staged (e.g. a prior
 * failure branch that didn't clean up), a bare commit would silently absorb
 * it under this commit's message. Restricting to an explicit pathspec keeps
 * every commit's contents exactly equal to what Boardroom decided to commit
 * this call, regardless of index state left over from anything else.
 */
function commitExact(git: GitOps, message: string, paths: string[]): string {
  git.run(['commit', '-m', message, '--', ...paths]);
  return git.run(['rev-parse', 'HEAD']).trim();
}

function currentHead(git: GitOps): string {
  try {
    return git.run(['rev-parse', 'HEAD']).trim();
  } catch {
    return '';
  }
}

function currentBranch(git: GitOps): string {
  try {
    return git.run(['branch', '--show-current']).trim();
  } catch {
    return '';
  }
}

function stagedPaths(git: GitOps): string[] {
  try {
    return git.run(['diff', '--cached', '--name-only']).split('\n').map((s) => s.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function nonBookkeepingDirtyPaths(git: GitOps): string[] {
  return parseGitStatusShort(statusShort(git)).filter((p) => !isBoardroomBookkeepingPath(p));
}

/**
 * Preserves a blocked/failed task's uncommitted edits in a Boardroom-owned
 * stash+tag (see salvage.ts) and, as a side effect of `git stash push`,
 * restores the working tree to the last clean commit — the mechanism that
 * fixes the first overnight run's contamination bug (a blocked task's edits
 * sitting in the tree and getting blamed on the NEXT task's WRITE_SCOPE
 * check). A salvage failure is surfaced, never swallowed — the caller must
 * stop the run rather than risk proceeding on a tree that might still be
 * dirty from this task.
 */
function salvageAndRecord(params: {
  git: GitOps;
  task: Task;
  agent: AgentName;
  attempt: number;
  runId: string;
  paths: string[];
  reason: string;
  root?: string;
}): { ok: true; note: string } | { ok: false; error: string } {
  try {
    const entry = salvageWorkingTree(params.git, {
      taskId: params.task.taskId,
      agent: params.agent,
      attempt: params.attempt,
      runId: params.runId,
      paths: params.paths,
      reason: params.reason,
    });
    if (!entry) return { ok: true, note: 'Nothing to salvage — no in-scope changes were present.' };
    recordSalvage(params.task.taskId, entry, params.root);
    return { ok: true, note: describeSalvage(entry) };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
}

function logSince(git: GitOps, baseCommit: string): Array<{ hash: string; subject: string }> {
  try {
    const out = git.run(['log', '--reverse', '--pretty=format:%H%x09%s', `${baseCommit}..HEAD`]);
    return out
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [hash, ...rest] = line.split('\t');
        return { hash, subject: rest.join('\t') };
      });
  } catch {
    return [];
  }
}

export type RunTestsFn = (commands: string[], cwd: string) => TestResult[];

export const defaultRunTests: RunTestsFn = (commands, cwd) => {
  const now = () => new Date().toISOString();
  return commands.map((command) => {
    try {
      execFileSync(command, { cwd, shell: '/bin/bash', stdio: 'pipe' });
      return { command, passed: true, summary: 'exit 0', at: now() };
    } catch (err: any) {
      const output = (err?.stdout?.toString?.() || '') + (err?.stderr?.toString?.() || '');
      return { command, passed: false, summary: output.slice(-500) || String(err?.message || err), at: now() };
    }
  });
};

const PRIORITY_ORDER: Record<Priority, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
const PHASE_ORDER: Record<Task['phase'], number> = {
  PHASE_1_RECON: 1,
  PHASE_2_CORE_EXPERIENCE_SYSTEM: 2,
  PHASE_3_FLAGSHIP_MOMENTS: 3,
  PHASE_4_SECONDARY_POLISH: 4,
  PHASE_5_PERFORMANCE_ACCESSIBILITY: 5,
  PHASE_6_ASTRA_FINAL_PASS: 6,
};

function pickNextTask(tasks: Task[], runQueue: ReadonlySet<string>): { task: Task | null; barrier: Task[] } {
  const runTasks = tasks.filter((t) => runQueue.has(t.taskId));
  const unresolved = runTasks.filter((t) => t.status !== 'DONE' && t.status !== 'REJECTED');
  if (unresolved.length === 0) return { task: null, barrier: [] };

  const earliestPhase = Math.min(...unresolved.map((t) => PHASE_ORDER[t.phase]));
  const phaseTasks = unresolved.filter((t) => PHASE_ORDER[t.phase] === earliestPhase);
  const candidates = phaseTasks.filter((t) => t.status === 'QUEUED' || t.status === 'READY');

  if (candidates.length === 0) return { task: null, barrier: phaseTasks };

  candidates.sort((a, b) => {
    const p = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (p !== 0) return p;
    return a.createdAt.localeCompare(b.createdAt);
  });
  return { task: candidates[0], barrier: [] };
}

/** Determines the current agent chain for a task, applying live budget conservation when the task declares a category. */
function resolveAssignment(task: Task, budgetTier: ReturnType<typeof classifyTier>): RoutingAssignment {
  if (!task.category) {
    return { primary: task.primaryAgent, fallback1: task.fallbackAgent1 ?? task.primaryAgent, fallback2: task.fallbackAgent2 ?? task.primaryAgent, reason: 'Static assignment set at task creation.' };
  }
  const category = task.category as WorkCategory;
  const base = defaultAssignment(category);
  return applyBudgetConservation(base, category, budgetTier, { protectedFinalIntegration: task.phase === 'PHASE_6_ASTRA_FINAL_PASS' });
}

function firstAvailable(
  assignment: RoutingAssignment,
  unavailable: ReadonlySet<AgentName>,
  taskUnavailable: ReadonlySet<AgentName> = new Set()
): AgentName | null {
  for (const candidate of [assignment.primary, assignment.fallback1, assignment.fallback2]) {
    if (!unavailable.has(candidate) && !taskUnavailable.has(candidate)) return candidate;
  }
  return null;
}

export interface SupervisorDeps {
  root?: string;
  git?: GitOps;
  runTests?: RunTestsFn;
  pid?: number;
  maxIterations?: number;
  perTaskTimeoutMs?: number;
  binaryOverrides?: Partial<Record<AgentName, string>>;
  registerProcessHandlers?: boolean;
  bootstrapOptions?: BootstrapOptions;
  /** Injectable so tests never actually spawn caffeinate. */
  startSleepPrevention?: typeof startSleepPrevention;
}

export interface SupervisorResult {
  ok: boolean;
  stopReason: string;
  runId?: string;
  branch?: string;
  iterations: number;
  actionsRequired: string[];
  reportPath?: string;
  reportContent?: string;
}

const DEFAULT_TIMEOUT_MS = 20 * 60 * 1000;
const DEFAULT_MAX_ITERATIONS = 200;

export async function runSupervisor(deps: SupervisorDeps = {}): Promise<SupervisorResult> {
  const root = deps.root;
  const git = deps.git ?? realGitOps;
  const runTests = deps.runTests ?? defaultRunTests;
  const pid = deps.pid ?? process.pid;
  const maxIterations = deps.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  const perTaskTimeoutMs = deps.perTaskTimeoutMs ?? DEFAULT_TIMEOUT_MS;
  const registerProcessHandlers = deps.registerProcessHandlers ?? true;
  const startedAt = new Date().toISOString();
  const actionsRequired: string[] = [];

  const markerCheck = checkAndRecoverMarker(root);
  if (markerCheck.status === 'ALIVE') {
    return { ok: false, stopReason: `ANOTHER_SUPERVISOR_ALIVE (pid ${markerCheck.marker?.pid})`, iterations: 0, actionsRequired };
  }

  const staleLock = assessStaleLock(root);
  if (staleLock && !staleLock.holderPidAlive) {
    recoverStaleLock({ root });
  } else if (staleLock && staleLock.holderPidAlive) {
    return { ok: false, stopReason: `WRITE_LOCK_HELD_BY_LIVE_PROCESS (${staleLock.lock.holder}, pid ${staleLock.lock.pid})`, iterations: 0, actionsRequired };
  }

  const worktrees = assertNoExtraWorktrees(git);
  if (!worktrees.ok) {
    return { ok: false, stopReason: `UNEXPECTED_EXTRA_WORKTREES: ${worktrees.worktrees.join(' | ')}`, iterations: 0, actionsRequired };
  }

  const boot = bootstrap({ git, ...deps.bootstrapOptions });
  if (!boot.ok) {
    return { ok: false, stopReason: `BOOTSTRAP_FAILED (${boot.failedStep}): ${boot.message}`, iterations: 0, actionsRequired };
  }

  try {
    git.run(['config', 'core.hooksPath', '.githooks']);
  } catch {
    actionsRequired.push('Could not set core.hooksPath to .githooks — the push-protection hook may not be active this run. Verify manually before trusting main is protected.');
  }

  writeMarker({ pid, branch: boot.branch!, runId: boot.runId }, root);
  const sleep = (deps.startSleepPrevention ?? startSleepPrevention)(pid);

  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    clearMarker(root);
    sleep.child?.kill?.('SIGTERM');
  };
  if (registerProcessHandlers) registerCleanupHandlers(cleanup);

  const unavailable = new Set<AgentName>();
  const taskUnavailable = new Map<string, Set<AgentName>>();
  const crashCounts: Record<AgentName, number> = { ASTRA: 0, CLAUDE: 0, AGY: 0 };
  const touchedThisRun = new Set<string>();
  const runQueue = new Set(
    listTasks(root)
      .filter((t) => t.status === 'QUEUED' || t.status === 'READY')
      .map((t) => t.taskId)
  );
  let iterations = 0;
  let stopReason = 'UNKNOWN';

  try {
    while (true) {
      if (iterations >= maxIterations) {
        stopReason = 'MAX_ITERATIONS_REACHED';
        break;
      }

      if (currentBranch(git) !== boot.branch) {
        stopReason = 'BRANCH_DRIFT';
        actionsRequired.push(`ACTION REQUIRED: expected Boardroom branch ${boot.branch} but found ${currentBranch(git) || '(detached)'}. Stopped before dispatching another agent.`);
        break;
      }

      const preTaskDirty = nonBookkeepingDirtyPaths(git);
      if (preTaskDirty.length > 0) {
        stopReason = 'DIRTY_WORKTREE_BEFORE_TASK';
        actionsRequired.push(`ACTION REQUIRED: source files were already dirty before task dispatch: ${preTaskDirty.join(', ')}. Boardroom refused to guess ownership.`);
        break;
      }

      const tasks = listTasks(root);
      const pick = pickNextTask(tasks, runQueue);
      if (!pick.task) {
        if (pick.barrier.length) {
          stopReason = 'PHASE_BARRIER_BLOCKED';
          actionsRequired.push(`ACTION REQUIRED: ${pick.barrier[0].phase} cannot advance because ${pick.barrier.map((t) => `${t.taskId}[${t.status}]`).join(', ')} must be resolved first.`);
        } else {
          stopReason = tasks.length === 0 ? 'NO_TASKS_QUEUED' : 'NO_MORE_READY_TASKS';
        }
        break;
      }
      const task = pick.task;

      if (unavailable.size >= 3) {
        const exhaustedBudget = getBudgetState(root);
        if (unavailable.has('ASTRA') && exhaustedBudget.resetCreditsUsed < 2) {
          const nextReset: 1 | 2 = exhaustedBudget.resetCreditsUsed === 0 ? 1 : 2;
          actionsRequired.push(requestReset(nextReset, root).message);
        }
        stopReason = 'ALL_AGENTS_UNAVAILABLE';
        break;
      }

      touchedThisRun.add(task.taskId);

      const budget = getBudgetState(root);
      if (task.phase === 'PHASE_6_ASTRA_FINAL_PASS' && unavailable.has('ASTRA')) {
        if (budget.resetCreditsUsed < 2) {
          const nextReset: 1 | 2 = budget.resetCreditsUsed === 0 ? 1 : 2;
          actionsRequired.push(requestReset(nextReset, root).message);
          stopReason = 'ASTRA_RESET_REQUIRED_FOR_FINAL_INTEGRATION';
        } else {
          actionsRequired.push('ACTION REQUIRED: protected final Astra integration is blocked; Astra is unavailable and both reset credits are already used.');
          stopReason = 'ASTRA_UNAVAILABLE_FOR_FINAL_INTEGRATION';
        }
        break;
      }

      const assignment = resolveAssignment(task, budget.tier);
      const perTaskUnavailable = taskUnavailable.get(task.taskId) ?? new Set<AgentName>();
      const agent = firstAvailable(assignment, unavailable, perTaskUnavailable);
      if (!agent) {
        addBlocker(task.taskId, `All candidate agents (${assignment.primary}/${assignment.fallback1}/${assignment.fallback2}) are unavailable this run.`, root);
        updateTaskStatus(task.taskId, 'BLOCKED', root);
        iterations++;
        continue;
      }

      const forced = checkThreshold(task.taskId, root);
      if (forced) {
        addBlocker(task.taskId, `${forced.reason}. Forced options: ${forced.options.join(', ')}.`, root);
        updateTaskStatus(task.taskId, 'BLOCKED', root);
        iterations++;
        continue;
      }

      const staleBeforeAcquire = assessStaleLock(root);
      if (staleBeforeAcquire && !staleBeforeAcquire.holderPidAlive) {
        recoverStaleLock({ root });
      }

      const taskStartHead = currentHead(git);
      let lockAcquired = true;
      try {
        acquireLock({ holder: agent, taskId: task.taskId, startingCommit: taskStartHead, pid, root });
      } catch (err) {
        if (err instanceof LockHeldByAnotherAgentError) {
          stopReason = `LOCK_CONTENTION_EXTERNAL (${err.lock.holder} pid ${err.lock.pid})`;
          lockAcquired = false;
        } else {
          throw err;
        }
      }
      if (!lockAcquired) break;

      updateTaskStatus(task.taskId, 'ACTIVE', root);

      const attemptNumber = task.attempts.length + 1;
      const logFile = invocationLogFile(task.taskId, agent, attemptNumber, root);
      const adapter = getAdapter(agent);
      const prompt = buildPrompt(task);

      console.log(`[boardroom] START ${agent} ${task.taskId} — ${task.title}`);
      const workerStartedAt = Date.now();
      const heartbeat = setInterval(() => {
        const elapsedMinutes = Math.max(1, Math.floor((Date.now() - workerStartedAt) / 60_000));
        console.log(`[boardroom] HEARTBEAT ${agent} ${task.taskId} — still running (${elapsedMinutes}m)`);
      }, 60_000);

      let runResult;
      try {
        runResult = await adapter.run(prompt, {
          cwd: root ?? process.cwd(),
          timeoutMs: perTaskTimeoutMs,
          logFile,
          binaryOverride: deps.binaryOverrides?.[agent],
        });
      } finally {
        clearInterval(heartbeat);
        console.log(`[boardroom] END ${agent} ${task.taskId} — ${Math.round((Date.now() - workerStartedAt) / 1000)}s`);
      }

      if (runResult.exitCode === null && !runResult.timedOut) {
        crashCounts[agent]++;
        if (crashCounts[agent] >= 2) {
          unavailable.add(agent);
          actionsRequired.push(`${agent} crashed twice this run and has been marked unavailable for the rest of the run.`);
        }
      }

      if (currentBranch(git) !== boot.branch || currentHead(git) !== taskStartHead) {
        addBlocker(task.taskId, `Agent ${agent} changed git history/branch while Boardroom held the write lease. Boardroom will not reset or rewrite that history automatically.`, root);
        updateTaskStatus(task.taskId, 'BLOCKED', root);
        writeHandoff(getTask(task.taskId, root)!, root);
        releaseLock({ holder: agent, taskId: task.taskId, root });
        stopReason = 'AGENT_MUTATED_GIT_HISTORY';
        actionsRequired.push(`ACTION REQUIRED: ${agent} changed git history during ${task.taskId}. State was preserved for manual inspection.`);
        break;
      }

      const postRunRawChangedPaths = parseGitStatusShort(statusShort(git));
      const postRunChangedPaths = postRunRawChangedPaths.filter((p) => !isBoardroomBookkeepingPath(p));
      const stagedByAgent = stagedPaths(git).filter((p) => !isBoardroomBookkeepingPath(p));
      if (stagedByAgent.length > 0) {
        const salvage = salvageAndRecord({ git, task, agent, attempt: attemptNumber, runId: boot.runId, paths: postRunChangedPaths, reason: `FAILED: agent staged files (${stagedByAgent.join(', ')})`, root });
        if (!salvage.ok) {
          addBlocker(task.taskId, `Agent staged files and salvage failed: ${salvage.error}`, root);
          updateTaskStatus(task.taskId, 'BLOCKED', root);
          writeHandoff(getTask(task.taskId, root)!, root);
          releaseLock({ holder: agent, taskId: task.taskId, root });
          stopReason = `SALVAGE_FAILED (${task.taskId}): ${salvage.error}`;
          break;
        }
        recordAttempt(task.taskId, { agent, approachSummary: 'Agent staged files despite Boardroom-owned commit protocol.', outcome: 'FAILED', whyFailed: stagedByAgent.join(', ') }, root);
        const failedAgents = taskUnavailable.get(task.taskId) ?? new Set<AgentName>();
        failedAgents.add(agent);
        taskUnavailable.set(task.taskId, failedAgents);
        updateTaskStatus(task.taskId, 'READY', root);
        writeHandoff(getTask(task.taskId, root)!, root);
        releaseLock({ holder: agent, taskId: task.taskId, root });
        iterations++;
        continue;
      }

      if (runResult.likelyUsageExhausted) {
        const beforeProbePaths = [...postRunChangedPaths].sort();
        const probe = await probeAgentHealth(adapter, {
          cwd: root ?? process.cwd(),
          timeoutMs: perTaskTimeoutMs,
          binaryOverride: deps.binaryOverrides?.[agent],
        });
        const afterProbePaths = nonBookkeepingDirtyPaths(git).sort();
        if (JSON.stringify(afterProbePaths) !== JSON.stringify(beforeProbePaths)) {
          addBlocker(task.taskId, 'Health probe unexpectedly changed the source worktree. Boardroom stopped instead of attributing probe edits to a task.', root);
          updateTaskStatus(task.taskId, 'BLOCKED', root);
          writeHandoff(getTask(task.taskId, root)!, root);
          releaseLock({ holder: agent, taskId: task.taskId, root });
          stopReason = 'PROBE_MODIFIED_WORKTREE';
          actionsRequired.push(`ACTION REQUIRED: health probe for ${agent} modified source paths during ${task.taskId}.`);
          break;
        }

        if (probe.healthy) {
          actionsRequired.push(
            `${agent} showed a possible usage-exhaustion signal on ${task.taskId}, but a cheap follow-up probe succeeded — treating it as transient.`
          );
        } else {
          const salvage = salvageAndRecord({ git, task, agent, attempt: attemptNumber, runId: boot.runId, paths: postRunChangedPaths, reason: 'FAILED: probe-confirmed usage exhaustion', root });
          if (!salvage.ok) {
            addBlocker(task.taskId, `Usage exhaustion was detected but salvage failed: ${salvage.error}`, root);
            updateTaskStatus(task.taskId, 'BLOCKED', root);
            writeHandoff(getTask(task.taskId, root)!, root);
            releaseLock({ holder: agent, taskId: task.taskId, root });
            stopReason = `SALVAGE_FAILED (${task.taskId}): ${salvage.error}`;
            break;
          }

          unavailable.add(agent);
          recordAttempt(task.taskId, { agent, approachSummary: 'Probe-confirmed usage exhaustion.', outcome: 'FAILED', whyFailed: runResult.stderr.slice(-500) || 'probe-confirmed exhaustion' }, root);
          updateTaskStatus(task.taskId, 'READY', root);
          writeHandoff(getTask(task.taskId, root)!, root);

          if (agent === 'ASTRA') {
            actionsRequired.push('ASTRA is probe-confirmed usage-exhausted. Reset redemption is DEFERRED while fallbacks can continue; Boardroom will request it only at protected final integration or if every agent becomes unavailable.');
          } else {
            actionsRequired.push(`${agent} is probe-confirmed usage-exhausted and is unavailable for the rest of this run.`);
          }

          releaseLock({ holder: agent, taskId: task.taskId, root });
          iterations++;
          continue;
        }
      }

      if (runResult.timedOut || runResult.exitCode === null || runResult.exitCode !== 0) {
        const salvage = salvageAndRecord({ git, task, agent, attempt: attemptNumber, runId: boot.runId, paths: postRunChangedPaths, reason: runResult.timedOut ? 'FAILED: timeout' : 'FAILED: non-zero/crashed process', root });
        if (!salvage.ok) {
          addBlocker(task.taskId, `Agent process failed and salvage failed: ${salvage.error}`, root);
          updateTaskStatus(task.taskId, 'BLOCKED', root);
          writeHandoff(getTask(task.taskId, root)!, root);
          releaseLock({ holder: agent, taskId: task.taskId, root });
          stopReason = `SALVAGE_FAILED (${task.taskId}): ${salvage.error}`;
          break;
        }
        recordAttempt(task.taskId, { agent, approachSummary: runResult.timedOut ? 'Agent timed out.' : 'Agent process exited unsuccessfully.', outcome: 'FAILED', whyFailed: runResult.stderr.slice(-500) || `exit=${runResult.exitCode}` }, root);
        const failedAgents = taskUnavailable.get(task.taskId) ?? new Set<AgentName>();
        failedAgents.add(agent);
        taskUnavailable.set(task.taskId, failedAgents);
        updateTaskStatus(task.taskId, 'READY', root);
        writeHandoff(getTask(task.taskId, root)!, root);
        releaseLock({ holder: agent, taskId: task.taskId, root });
        iterations++;
        continue;
      }

      const rawChangedPaths = postRunRawChangedPaths;
      // Boardroom's own bookkeeping (a prior task's handoff doc, etc.) is never
      // subject to THIS task's write scope — it wasn't written by this agent.
      const boardroomOwnPendingPaths = rawChangedPaths.filter(isBoardroomBookkeepingPath);
      const changedPaths = rawChangedPaths.filter((p) => !isBoardroomBookkeepingPath(p));
      const gate = evaluateChangedPaths(task.writeScope, changedPaths);

      if (gate.decision === 'BLOCK') {
        recordAttempt(task.taskId, { agent, approachSummary: `Run produced out-of-scope changes: ${gate.outOfScope.join(', ')}`, outcome: 'BLOCKED', whyFailed: `Out-of-scope paths: ${gate.outOfScope.join(', ')}` }, root);
        const salvage = salvageAndRecord({ git, task, agent, attempt: attemptNumber, runId: boot.runId, paths: changedPaths, reason: `BLOCKED: out-of-scope changes (${gate.outOfScope.join(', ')})`, root });
        if (!salvage.ok) {
          addBlocker(
            task.taskId,
            `Agent ${agent} touched paths outside WRITE_SCOPE: ${gate.outOfScope.join(', ')}. SALVAGE FAILED (${salvage.error}) — the working tree may still contain this task's edits. Stopping the run rather than risk contaminating further tasks.`,
            root
          );
          updateTaskStatus(task.taskId, 'BLOCKED', root);
          writeHandoff(getTask(task.taskId, root)!, root);
          releaseLock({ holder: agent, taskId: task.taskId, root });
          stopReason = `SALVAGE_FAILED (${task.taskId}): ${salvage.error}`;
          break;
        }
        addBlocker(task.taskId, `Agent ${agent} touched paths outside WRITE_SCOPE: ${gate.outOfScope.join(', ')}. Nothing was staged or committed. ${salvage.note}`, root);
        updateTaskStatus(task.taskId, 'BLOCKED', root);
        writeHandoff(getTask(task.taskId, root)!, root);
        releaseLock({ holder: agent, taskId: task.taskId, root });
        iterations++;
        continue;
      }

      if (gate.inScope.length === 0) {
        recordAttempt(task.taskId, { agent, approachSummary: 'Agent run produced no file changes.', outcome: 'FAILED', whyFailed: 'No changes produced.' }, root);
        const failedAgents = taskUnavailable.get(task.taskId) ?? new Set<AgentName>();
        failedAgents.add(agent);
        taskUnavailable.set(task.taskId, failedAgents);
        updateTaskStatus(task.taskId, 'READY', root);
        writeHandoff(getTask(task.taskId, root)!, root);
        releaseLock({ holder: agent, taskId: task.taskId, root });
        iterations++;
        continue;
      }

      recordFilesTouched(task.taskId, gate.inScope, root);

      const testResults = task.testsRequired.length ? runTests(task.testsRequired, root ?? process.cwd()) : [];
      for (const tr of testResults) recordTestResult(task.taskId, tr, root);
      const allPassed = testResults.every((t) => t.passed);

      if (!allPassed) {
        const failedCommands = testResults.filter((t) => !t.passed).map((t) => t.command).join(', ');
        recordAttempt(task.taskId, { agent, approachSummary: `Implementation attempt (${gate.inScope.length} files)`, outcome: 'FAILED', whyFailed: testResults.filter((t) => !t.passed).map((t) => `${t.command}: ${t.summary}`).join(' | ') }, root);
        const salvage = salvageAndRecord({ git, task, agent, attempt: attemptNumber, runId: boot.runId, paths: gate.inScope, reason: `VALIDATION FAILED: ${failedCommands}`, root });
        if (!salvage.ok) {
          addBlocker(
            task.taskId,
            `Validation failed after ${agent}'s changes: ${failedCommands}. SALVAGE FAILED (${salvage.error}) — the working tree may still contain this task's edits. Stopping the run rather than risk contaminating further tasks.`,
            root
          );
          updateTaskStatus(task.taskId, 'BLOCKED', root);
          writeHandoff(getTask(task.taskId, root)!, root);
          releaseLock({ holder: agent, taskId: task.taskId, root });
          stopReason = `SALVAGE_FAILED (${task.taskId}): ${salvage.error}`;
          break;
        }
        const failedAgents = taskUnavailable.get(task.taskId) ?? new Set<AgentName>();
        failedAgents.add(agent);
        taskUnavailable.set(task.taskId, failedAgents);
        updateTaskStatus(task.taskId, 'READY', root);
        writeHandoff(getTask(task.taskId, root)!, root);
        releaseLock({ holder: agent, taskId: task.taskId, root });
        iterations++;
        continue;
      }

      // Sweep in any pending Boardroom bookkeeping paths (e.g. a prior task's
      // handoff doc) alongside this task's approved paths — still an exact,
      // enumerated list, never `git add -A`.
      const approvedPaths = Array.from(new Set([...gate.inScope, ...boardroomOwnPendingPaths]));
      stageExactPaths(git, approvedPaths);

      const stagedNow = stagedPaths(git);
      const unexpectedStaged = stagedNow.filter((p) => !approvedPaths.includes(p));
      const missingStaged = gate.inScope.filter((p) => !stagedNow.includes(p));
      if (unexpectedStaged.length || missingStaged.length) {
        recordAttempt(task.taskId, { agent, approachSummary: `Exact staging verification failed (unexpected: ${unexpectedStaged.join(', ') || 'none'}; missing: ${missingStaged.join(', ') || 'none'})`, outcome: 'BLOCKED', whyFailed: 'Staged set did not exactly match the approved set.' }, root);
        // Whatever is currently staged/dirty must not be left sitting in the
        // index for a later step (e.g. the end-of-run bookkeeping sweep) to
        // accidentally absorb into an unrelated commit — same salvage-then-
        // clean treatment as every other failure branch.
        const salvage = salvageAndRecord({ git, task, agent, attempt: attemptNumber, runId: boot.runId, paths: Array.from(new Set([...stagedNow, ...nonBookkeepingDirtyPaths(git)])), reason: `EXACT_STAGING_VERIFICATION_FAILED (unexpected: ${unexpectedStaged.join(', ') || 'none'}; missing: ${missingStaged.join(', ') || 'none'})`, root });
        if (!salvage.ok) {
          addBlocker(task.taskId, `Exact staging verification failed AND salvage failed (${salvage.error}). The working tree may still contain this task's edits.`, root);
        } else {
          addBlocker(task.taskId, `Exact staging verification failed. Unexpected: ${unexpectedStaged.join(', ') || 'none'}; missing: ${missingStaged.join(', ') || 'none'}. ${salvage.note}`, root);
        }
        updateTaskStatus(task.taskId, 'BLOCKED', root);
        writeHandoff(getTask(task.taskId, root)!, root);
        releaseLock({ holder: agent, taskId: task.taskId, root });
        stopReason = 'EXACT_STAGING_VERIFICATION_FAILED';
        actionsRequired.push(`ACTION REQUIRED: Boardroom refused to commit because the staged set did not exactly match the approved set for ${task.taskId}.${salvage.ok ? '' : ' Salvage also failed — inspect the working tree manually before proceeding.'}`);
        break;
      }

      const commitMessage = `${task.title}\n\nBoardroom task ${task.taskId} (${agent}).\n\nCo-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`;
      const commitHash = commitExact(git, commitMessage, approvedPaths);

      recordAttempt(task.taskId, { agent, approachSummary: `Implementation attempt (${gate.inScope.length} files)`, outcome: 'SUCCEEDED' }, root);
      setCurrentCommit(task.taskId, commitHash, root);
      checkpoint(task.taskId, { summary: `${agent} committed ${gate.inScope.length} file(s) as ${commitHash.slice(0, 12)}.`, remainingWork: 'None recorded — task may be DONE or may need a follow-up task.', status: 'DONE' }, root);
      writeHandoff(getTask(task.taskId, root)!, root);

      releaseLock({ holder: agent, taskId: task.taskId, root });

      const postCommitDirty = nonBookkeepingDirtyPaths(git);
      if (postCommitDirty.length > 0) {
        stopReason = 'POST_COMMIT_DIRTY_WORKTREE';
        actionsRequired.push(`ACTION REQUIRED: source paths remained dirty after committing ${task.taskId}: ${postCommitDirty.join(', ')}.`);
        break;
      }

      iterations++;
    }
  } finally {
    cleanup();
  }

  const finalTasks = listTasks(root);
  const budget = getBudgetState(root);
  const commits = logSince(git, boot.baseCommit!);
  const run: RunSummary = {
    runId: boot.runId,
    branch: boot.branch!,
    baseCommit: boot.baseCommit!,
    startedAt,
    endedAt: new Date().toISOString(),
    sleepPrevention: { active: sleep.active, reason: sleep.reason },
    stopReason,
  };
  const reportContent = writeMorningReport({ run, tasks: finalTasks, budget, commits, actionsRequired, touchedThisRunTaskIds: Array.from(touchedThisRun) }, root);

  // Sweep any remaining Boardroom bookkeeping (a final task's own handoff doc,
  // which is written after its commit and so is never included in it, plus
  // the morning report just written above) into one closing commit — so
  // boardroom/ actually stays git-tracked as intended, rather than left as
  // uncommitted local files at the end of a run with nothing further to do.
  try {
    const trailingPaths = parseGitStatusShort(statusShort(git)).filter(isBoardroomBookkeepingPath);
    if (trailingPaths.length > 0) {
      stageExactPaths(git, trailingPaths);
      // Pathspec-restricted to exactly trailingPaths — never a bare `git
      // commit -m`, which would commit the WHOLE index regardless of what
      // this sweep staged. If some earlier failure branch ever left
      // unrelated content sitting staged, a bare commit here would silently
      // absorb it under a "Boardroom bookkeeping" message (this is exactly
      // what happened on the second real overnight run before this fix).
      commitExact(git, `Boardroom bookkeeping for run ${boot.runId}\n\nCo-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`, trailingPaths);
    }
  } catch {
    // Best-effort — a failure here must never prevent the report from being returned.
  }

  return {
    ok: true,
    stopReason,
    runId: boot.runId,
    branch: boot.branch,
    iterations,
    actionsRequired,
    reportPath: `boardroom/reports/MORNING_REPORT.md`,
    reportContent,
  };
}

function buildPrompt(task: Task): string {
  const scope = task.writeScope.length ? task.writeScope.join(', ') : '(undeclared — stay strictly within files relevant to the goal)';
  return [
    `You are working inside the Canton Quests repository as part of a Boardroom-supervised task.`,
    `Boardroom owns every commit — do NOT run git add or git commit yourself. Just edit files.`,
    ``,
    `TASK: ${task.title}`,
    `GOAL: ${task.goal}`,
    `WRITE_SCOPE (stay within these paths): ${scope}`,
    task.acceptanceCriteria.length ? `ACCEPTANCE CRITERIA:\n${task.acceptanceCriteria.map((c) => `- ${c}`).join('\n')}` : '',
    task.checkpointExpectations ? `CHECKPOINT EXPECTATIONS: ${task.checkpointExpectations}` : '',
    task.checkpointSummary ? `PRIOR CHECKPOINT: ${task.checkpointSummary}` : '',
    task.remainingWork ? `REMAINING WORK: ${task.remainingWork}` : '',
    task.blockers.length ? `KNOWN BLOCKERS TO ADDRESS: ${task.blockers.join('; ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/** Re-exported for the CLI entry script and for allowing a manual self-report to feed the very next resolveAssignment call. */
export { selfReportAllowance };

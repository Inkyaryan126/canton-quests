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
import { listTasks, getTask, updateTaskStatus, checkpoint, recordFilesTouched, recordTestResult, addBlocker, setCurrentCommit } from './tasks';
import { recordAttempt, checkThreshold } from './attempts';
import { getBudgetState, selfReportAllowance, requestReset, classifyTier } from './budget';
import { defaultAssignment, applyBudgetConservation, type WorkCategory, type RoutingAssignment } from './routing';
import { evaluateChangedPaths, parseGitStatusShort, isBoardroomBookkeepingPath } from './commitGate';
import { getAdapter } from './adapters/registry';
import { invocationLogFile } from './paths';
import { writeHandoff } from './handoff';
import { writeMorningReport, type RunSummary } from './report';
import type { Task, AgentName, TestResult, Priority } from './types';

export interface GitOps extends GitRunner {}

export const realGitOps: GitOps = realGit;

function statusShort(git: GitOps): string {
  try {
    return git.run(['status', '--short']);
  } catch {
    return '';
  }
}

function stageExactPaths(git: GitOps, paths: string[]): void {
  for (const p of paths) git.run(['add', '--', p]);
}

function commitExact(git: GitOps, message: string): string {
  git.run(['commit', '-m', message]);
  return git.run(['rev-parse', 'HEAD']).trim();
}

function currentHead(git: GitOps): string {
  try {
    return git.run(['rev-parse', 'HEAD']).trim();
  } catch {
    return '';
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

function pickNextTask(tasks: Task[]): Task | null {
  const candidates = tasks.filter((t) => t.status === 'QUEUED' || t.status === 'READY');
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => {
    const p = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (p !== 0) return p;
    return a.createdAt.localeCompare(b.createdAt);
  });
  return candidates[0];
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

function firstAvailable(assignment: RoutingAssignment, unavailable: ReadonlySet<AgentName>): AgentName | null {
  for (const candidate of [assignment.primary, assignment.fallback1, assignment.fallback2]) {
    if (!unavailable.has(candidate)) return candidate;
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
  const crashCounts: Record<AgentName, number> = { ASTRA: 0, CLAUDE: 0, AGY: 0 };
  let iterations = 0;
  let stopReason = 'UNKNOWN';

  try {
    while (true) {
      if (iterations >= maxIterations) {
        stopReason = 'MAX_ITERATIONS_REACHED';
        break;
      }

      const tasks = listTasks(root);
      const task = pickNextTask(tasks);
      if (!task) {
        stopReason = tasks.length === 0 ? 'NO_TASKS_QUEUED' : 'NO_MORE_READY_TASKS';
        break;
      }

      if (unavailable.size >= 3) {
        stopReason = 'ALL_AGENTS_UNAVAILABLE';
        break;
      }

      const budget = getBudgetState(root);
      const assignment = resolveAssignment(task, budget.tier);
      const agent = firstAvailable(assignment, unavailable);
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

      let lockAcquired = true;
      try {
        acquireLock({ holder: agent, taskId: task.taskId, startingCommit: currentHead(git), pid, root });
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

      let runResult;
      try {
        runResult = await adapter.run(prompt, {
          cwd: root ?? process.cwd(),
          timeoutMs: perTaskTimeoutMs,
          logFile,
          binaryOverride: deps.binaryOverrides?.[agent],
        });
      } finally {
        // Lock is released further below regardless of outcome; nothing to do here.
      }

      if (runResult.exitCode === null && !runResult.timedOut) {
        crashCounts[agent]++;
        if (crashCounts[agent] >= 2) {
          unavailable.add(agent);
          actionsRequired.push(`${agent} crashed twice this run and has been marked unavailable for the rest of the run.`);
        }
      }

      if (runResult.likelyUsageExhausted) {
        unavailable.add(agent);
        if (agent === 'ASTRA') {
          const nextReset: 1 | 2 = budget.resetCreditsUsed === 0 ? 1 : 2;
          if (budget.resetCreditsUsed < 2) {
            const reset = requestReset(nextReset, root);
            actionsRequired.push(reset.message);
          } else {
            actionsRequired.push('ACTION REQUIRED: ASTRA appears usage-exhausted and both reset credits are already used. Astra is unavailable for the rest of this run.');
          }
        } else {
          actionsRequired.push(`${agent} appears usage-exhausted (HIGH_CONFIDENCE, pattern-matched — not verified) and has been marked unavailable for the rest of this run.`);
        }
      }

      const rawChangedPaths = parseGitStatusShort(statusShort(git));
      // Boardroom's own bookkeeping (a prior task's handoff doc, etc.) is never
      // subject to THIS task's write scope — it wasn't written by this agent.
      const boardroomOwnPendingPaths = rawChangedPaths.filter(isBoardroomBookkeepingPath);
      const changedPaths = rawChangedPaths.filter((p) => !isBoardroomBookkeepingPath(p));
      const gate = evaluateChangedPaths(task.writeScope, changedPaths);

      if (gate.decision === 'BLOCK') {
        recordAttempt(task.taskId, { agent, approachSummary: `Run produced out-of-scope changes: ${gate.outOfScope.join(', ')}`, outcome: 'BLOCKED', whyFailed: `Out-of-scope paths: ${gate.outOfScope.join(', ')}` }, root);
        addBlocker(task.taskId, `Agent ${agent} touched paths outside WRITE_SCOPE: ${gate.outOfScope.join(', ')}. Nothing was staged or committed.`, root);
        updateTaskStatus(task.taskId, 'BLOCKED', root);
        writeHandoff(getTask(task.taskId, root)!, root);
        releaseLock({ holder: agent, taskId: task.taskId, root });
        iterations++;
        continue;
      }

      if (gate.inScope.length === 0) {
        // Agent made no changes at all — nothing to validate or commit.
        recordAttempt(task.taskId, { agent, approachSummary: 'Agent run produced no file changes.', outcome: runResult.exitCode === 0 ? 'FAILED' : 'FAILED', whyFailed: runResult.stderr?.slice(-500) || 'No changes and non-informative output.' }, root);
        updateTaskStatus(task.taskId, 'BLOCKED', root);
        addBlocker(task.taskId, `Agent ${agent} made no file changes this attempt.`, root);
        releaseLock({ holder: agent, taskId: task.taskId, root });
        iterations++;
        continue;
      }

      recordFilesTouched(task.taskId, gate.inScope, root);

      const testResults = task.testsRequired.length ? runTests(task.testsRequired, root ?? process.cwd()) : [];
      for (const tr of testResults) recordTestResult(task.taskId, tr, root);
      const allPassed = testResults.every((t) => t.passed);

      if (!allPassed) {
        recordAttempt(task.taskId, { agent, approachSummary: `Implementation attempt (${gate.inScope.length} files)`, outcome: 'FAILED', whyFailed: testResults.filter((t) => !t.passed).map((t) => `${t.command}: ${t.summary}`).join(' | ') }, root);
        addBlocker(task.taskId, `Validation failed after ${agent}'s changes: ${testResults.filter((t) => !t.passed).map((t) => t.command).join(', ')}. Nothing was staged or committed.`, root);
        updateTaskStatus(task.taskId, 'BLOCKED', root);
        writeHandoff(getTask(task.taskId, root)!, root);
        releaseLock({ holder: agent, taskId: task.taskId, root });
        iterations++;
        continue;
      }

      // Sweep in any pending Boardroom bookkeeping paths (e.g. a prior task's
      // handoff doc) alongside this task's approved paths — still an exact,
      // enumerated list, never `git add -A`.
      stageExactPaths(git, [...gate.inScope, ...boardroomOwnPendingPaths]);
      const commitMessage = `${task.title}\n\nBoardroom task ${task.taskId} (${agent}).\n\nCo-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`;
      const commitHash = commitExact(git, commitMessage);

      recordAttempt(task.taskId, { agent, approachSummary: `Implementation attempt (${gate.inScope.length} files)`, outcome: 'SUCCEEDED' }, root);
      setCurrentCommit(task.taskId, commitHash, root);
      checkpoint(task.taskId, { summary: `${agent} committed ${gate.inScope.length} file(s) as ${commitHash.slice(0, 12)}.`, remainingWork: 'None recorded — task may be DONE or may need a follow-up task.', status: 'DONE' }, root);
      writeHandoff(getTask(task.taskId, root)!, root);

      releaseLock({ holder: agent, taskId: task.taskId, root });
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
  const reportContent = writeMorningReport({ run, tasks: finalTasks, budget, commits, actionsRequired }, root);

  // Sweep any remaining Boardroom bookkeeping (a final task's own handoff doc,
  // which is written after its commit and so is never included in it, plus
  // the morning report just written above) into one closing commit — so
  // boardroom/ actually stays git-tracked as intended, rather than left as
  // uncommitted local files at the end of a run with nothing further to do.
  try {
    const trailingPaths = parseGitStatusShort(statusShort(git)).filter(isBoardroomBookkeepingPath);
    if (trailingPaths.length > 0) {
      stageExactPaths(git, trailingPaths);
      commitExact(git, `Boardroom bookkeeping for run ${boot.runId}\n\nCo-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`);
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

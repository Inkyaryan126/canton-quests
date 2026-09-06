/**
 * Canton Quests Boardroom V2 — persistent task ledger.
 *
 * One JSON file per task under .boardroom/runtime/tasks/ (gitignored,
 * atomic writes) so it survives CLI restart, usage exhaustion, terminal
 * closure, agent replacement, and overnight interruption — it's just a
 * file on disk, no daemon or in-memory state to lose.
 */
import { taskFile, tasksDir } from './paths';
import { writeJsonAtomic, readJsonIfExists, listJsonFiles } from './atomicFile';
import type { Task, TaskStatus, Decision, Attempt, TestResult, ConfidenceState, AgentName, Priority, Phase, SalvageEntry } from './types';

export function generateTaskId(): string {
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');
  const rand = Math.random().toString(36).slice(2, 6);
  return `TASK-${stamp}-${rand}`;
}

export function createTask(params: {
  title: string;
  goal: string;
  priority: Priority;
  phase: Phase;
  primaryAgent: AgentName;
  fallbackAgent1?: AgentName;
  fallbackAgent2?: AgentName;
  category?: string;
  writeScope?: string[];
  acceptanceCriteria?: string[];
  checkpointExpectations?: string;
  testsRequired?: string[];
  taskId?: string;
  root?: string;
}): Task {
  const now = new Date().toISOString();
  const task: Task = {
    taskId: params.taskId || generateTaskId(),
    title: params.title,
    goal: params.goal,
    priority: params.priority,
    phase: params.phase,
    primaryAgent: params.primaryAgent,
    fallbackAgent1: params.fallbackAgent1,
    fallbackAgent2: params.fallbackAgent2,
    category: params.category,
    status: 'QUEUED',
    writeScope: params.writeScope ?? [],
    acceptanceCriteria: params.acceptanceCriteria ?? [],
    checkpointExpectations: params.checkpointExpectations,
    salvage: [],
    decisions: [],
    filesTouched: [],
    testsRequired: params.testsRequired ?? [],
    testResults: [],
    knownFailures: [],
    attempts: [],
    confidence: 'ASSUMPTION',
    blockers: [],
    createdAt: now,
    updatedAt: now,
  };
  writeJsonAtomic(taskFile(task.taskId, params.root), task);
  return task;
}

/**
 * Backfills fields added to the Task schema after some on-disk task files
 * were already written, so an older task record never crashes a function
 * that assumes e.g. `task.salvage` is always an array. Never used to change
 * a field that's actually present — only to default a genuinely missing one.
 */
function normalizeTask(task: Task): Task {
  return {
    ...task,
    acceptanceCriteria: task.acceptanceCriteria ?? [],
    salvage: task.salvage ?? [],
  };
}

export function getTask(taskId: string, root?: string): Task | null {
  const task = readJsonIfExists<Task>(taskFile(taskId, root));
  return task ? normalizeTask(task) : null;
}

export function listTasks(root?: string): Task[] {
  return listJsonFiles(tasksDir(root))
    .map((f) => readJsonIfExists<Task>(f))
    .filter((t): t is Task => t !== null)
    .map(normalizeTask)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function saveTask(task: Task, root?: string): Task {
  task.updatedAt = new Date().toISOString();
  writeJsonAtomic(taskFile(task.taskId, root), task);
  return task;
}

export function updateTaskStatus(taskId: string, status: TaskStatus, root?: string): Task {
  const task = requireTask(taskId, root);
  task.status = status;
  return saveTask(task, root);
}

export function setConfidence(taskId: string, confidence: ConfidenceState, root?: string): Task {
  const task = requireTask(taskId, root);
  task.confidence = confidence;
  return saveTask(task, root);
}

export function recordDecision(taskId: string, decision: Omit<Decision, 'at'>, root?: string): Task {
  const task = requireTask(taskId, root);
  task.decisions.push({ ...decision, at: new Date().toISOString() });
  return saveTask(task, root);
}

export function recordFilesTouched(taskId: string, files: string[], root?: string): Task {
  const task = requireTask(taskId, root);
  task.filesTouched = Array.from(new Set([...task.filesTouched, ...files]));
  return saveTask(task, root);
}

export function recordTestResult(taskId: string, result: Omit<TestResult, 'at'>, root?: string): Task {
  const task = requireTask(taskId, root);
  task.testResults.push({ ...result, at: new Date().toISOString() });
  if (!result.passed) task.knownFailures.push(`${result.command}: ${result.summary}`);
  return saveTask(task, root);
}

export function addBlocker(taskId: string, blocker: string, root?: string): Task {
  const task = requireTask(taskId, root);
  if (!task.blockers.includes(blocker)) task.blockers.push(blocker);
  return saveTask(task, root);
}

export function recordSalvage(taskId: string, entry: Omit<SalvageEntry, 'at'>, root?: string): Task {
  const task = requireTask(taskId, root);
  task.salvage.push({ ...entry, at: new Date().toISOString() });
  return saveTask(task, root);
}

/**
 * Replaces a task's declared writeScope entirely (used by
 * `boardroom:task update-scope` to broaden a scope after a real run reveals
 * it was too narrow for legitimate shared/cross-cutting work — see
 * commitGate.ts and boardroom/BOARDROOM.md's WRITE_SCOPE section). Takes the
 * full replacement list rather than an append to keep the resulting scope
 * unambiguous and reviewable in one place.
 */
export function setWriteScope(taskId: string, writeScope: string[], root?: string): Task {
  const task = requireTask(taskId, root);
  task.writeScope = writeScope;
  return saveTask(task, root);
}

export function setCurrentCommit(taskId: string, commit: string, root?: string): Task {
  const task = requireTask(taskId, root);
  task.currentCommit = commit;
  if (!task.startingCommit) task.startingCommit = commit;
  return saveTask(task, root);
}

/**
 * Writes CHECKPOINT_SUMMARY + REMAINING_WORK and moves status to
 * CHECKPOINTED. This is the exact data handoff.ts reads from, so a
 * checkpoint and a generated handoff doc are never out of sync.
 */
export function checkpoint(
  taskId: string,
  params: { summary: string; remainingWork: string; status?: TaskStatus },
  root?: string
): Task {
  const task = requireTask(taskId, root);
  task.checkpointSummary = params.summary;
  task.remainingWork = params.remainingWork;
  task.status = params.status ?? 'CHECKPOINTED';
  return saveTask(task, root);
}

function requireTask(taskId: string, root?: string): Task {
  const task = getTask(taskId, root);
  if (!task) throw new Error(`Boardroom task not found: ${taskId}`);
  return task;
}

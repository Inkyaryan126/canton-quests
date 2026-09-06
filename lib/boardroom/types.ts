/**
 * Canton Quests Boardroom V2 — shared types.
 *
 * See boardroom/BOARDROOM.md for the constitution these types implement.
 * Runtime state (write-lock.json, astra-budget.json, tasks/*.json) lives
 * under .boardroom/runtime/ (gitignored, crash-safe via atomicFile.ts) —
 * these types describe the shape of that state, not where it's stored.
 */

export type AgentName = 'ASTRA' | 'CLAUDE' | 'AGY';

export type TaskStatus =
  | 'QUEUED'
  | 'SCOUTING'
  | 'READY'
  | 'ACTIVE'
  | 'VERIFYING'
  | 'BLOCKED'
  | 'CHECKPOINTED'
  | 'HANDOFF'
  | 'DONE'
  | 'REJECTED';

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type Phase =
  | 'PHASE_1_RECON'
  | 'PHASE_2_CORE_EXPERIENCE_SYSTEM'
  | 'PHASE_3_FLAGSHIP_MOMENTS'
  | 'PHASE_4_SECONDARY_POLISH'
  | 'PHASE_5_PERFORMANCE_ACCESSIBILITY'
  | 'PHASE_6_ASTRA_FINAL_PASS';

/**
 * VERIFIED: actually tested/measured/executed.
 * HIGH_CONFIDENCE: strongly supported by inspection but not fully exercised.
 * ASSUMPTION: requires validation.
 * BLOCKED: cannot safely proceed.
 * An assumption must never silently become a downstream fact — every
 * result-bearing field that carries one of these must keep it attached.
 */
export type ConfidenceState = 'VERIFIED' | 'HIGH_CONFIDENCE' | 'ASSUMPTION' | 'BLOCKED';

export interface Decision {
  at: string; // ISO timestamp
  by: AgentName | 'BOARDROOM' | 'DUSTIN';
  summary: string;
}

export interface Attempt {
  at: string; // ISO timestamp
  agent: AgentName;
  approachSummary: string;
  outcome: 'FAILED' | 'SUCCEEDED' | 'BLOCKED';
  whyFailed?: string;
}

export interface TestResult {
  command: string;
  passed: boolean;
  summary: string;
  at: string; // ISO timestamp
}

/**
 * The full Section 3 task ledger schema. One JSON file per task under
 * .boardroom/runtime/tasks/<TASK_ID>.json while active; a durable summary is
 * written to boardroom/handoffs/<TASK_ID>.md only at real handoff/completion
 * events (see handoff.ts), not on every mutation.
 */
export interface Task {
  taskId: string;
  title: string;
  goal: string;
  priority: Priority;
  phase: Phase;
  primaryAgent: AgentName;
  fallbackAgent1?: AgentName;
  fallbackAgent2?: AgentName;
  /**
   * Optional WorkCategory (see routing.ts) enabling DYNAMIC re-routing as the
   * Astra budget tier shifts during a run. When unset, the supervisor uses
   * primaryAgent/fallbackAgent1/2 exactly as set at task-creation time —
   * i.e. this field opts a task into live budget-conservation, it does not
   * replace the static fallback chain for tasks that don't set it.
   */
  category?: string;
  status: TaskStatus;
  /** Paths (glob-able prefixes) this task is allowed to touch. Empty/undefined = undeclared scope (see commitGate.ts). */
  writeScope: string[];
  /**
   * Concrete, checkable statements of "done" for this task — distinct from
   * the free-text `goal`. Not mechanically enforced by the supervisor today
   * (TESTS_REQUIRED is what actually gates a commit); this is the durable
   * record of what a human or a reviewing agent checks a checkpoint against.
   */
  acceptanceCriteria: string[];
  /**
   * What a checkpoint on this task is expected to look like when the work is
   * genuinely complete or at a sensible pause point — e.g. "one working
   * flagship moment behind a feature-safe fallback" rather than "50% of a
   * page rewritten". Declared up front so a checkpoint can be judged against
   * an actual expectation instead of whatever the agent happened to reach.
   */
  checkpointExpectations?: string;
  startingCommit?: string;
  currentCommit?: string;
  decisions: Decision[];
  filesTouched: string[];
  testsRequired: string[];
  testResults: TestResult[];
  knownFailures: string[];
  attempts: Attempt[];
  confidence: ConfidenceState;
  /** Free-text self-reported usage/budget note relevant to this task, if any. */
  usageState?: string;
  checkpointSummary?: string;
  remainingWork?: string;
  blockers: string[];
  createdAt: string;
  updatedAt: string;
}

export type AstraBudgetTier = 'NORMAL' | 'CONSERVE' | 'RESERVE' | 'CRITICAL';

export interface AstraBudgetState {
  /** Self-reported remaining allowance percentage, 0-100. Never auto-detected — see budget.ts. */
  allowanceRemainingPct: number | null;
  tier: AstraBudgetTier;
  resetCreditsTotal: 2;
  resetCreditsUsed: 0 | 1 | 2;
  lastSelfReportedAt: string | null;
  lastSelfReportedBy: 'DUSTIN' | AgentName | null;
  /** Set only by an explicit human-confirmed redemption call — never by inference. */
  resetHistory: Array<{ which: 1 | 2; confirmedAt: string; confirmedBy: 'DUSTIN' }>;
}

export interface WriteLock {
  holder: AgentName;
  taskId: string;
  startingCommit: string;
  acquiredAt: string;
  /** PID of the process that acquired the lock, for PID-aware stale recovery. */
  pid: number;
  note?: string;
}

export interface AutonomousRunMarker {
  pid: number;
  startedAt: string;
  branch: string;
  runId: string;
}

export interface AgentRunResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  outputFile?: string;
  /** Best-effort, pattern-matched — never VERIFIED, see adapters/exhaustionPatterns.ts. */
  likelyUsageExhausted: boolean;
  confidence: ConfidenceState;
  durationMs: number;
  timedOut: boolean;
}

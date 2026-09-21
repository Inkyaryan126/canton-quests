import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { readClaims } from '../lib/agent-control';
import {
  collectGridBuilderOsSnapshot,
  gridBuilderLogFile,
  isGridBuilderSteadyState,
  readGridBuilderRunState,
  resolveGridBuilderIntegrationRef,
  resolvePreferredCliBinary,
  writeGridBuilderRunState,
  type GridBuilderOsSnapshot,
  type GridBuilderRunState,
} from '../lib/grid/ops/grid-builder-os';
import { resolvePreferredLocalNodeBinary } from '../lib/grid/ops/local-toolchain';

const MAX_LEAD_RUNTIME_MS = 30 * 60 * 1000;

type CrewSlot = 'codex' | 'claude' | 'gemini';

export interface CrewDispatchAssignment {
  slot: CrewSlot;
  taskId: string;
  title: string;
  action: string;
  specialization: string;
  whyNow: string;
}

export function buildCrewDispatchAssignments(
  recommendations: GridBuilderOsSnapshot['recommendations'],
): CrewDispatchAssignment[] {
  const slots: CrewSlot[] = ['codex', 'claude', 'gemini'];
  const seen = new Set<string>();
  const distinct = recommendations.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
  return distinct.slice(0, slots.length).map((item, index) => ({
    slot: slots[index],
    taskId: item.id,
    title: item.title,
    action: item.action,
    specialization: item.specialization,
    whyNow: item.whyNow,
  }));
}

function value(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
}

function appendLog(cwd: string, message: string): void {
  const filename = gridBuilderLogFile(cwd);
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.appendFileSync(filename, `[${new Date().toISOString()}] ${message}\n`);
}

function archiveBuilderLog(cwd: string, runId: string): void {
  const latest = gridBuilderLogFile(cwd);
  if (!runId || !fs.existsSync(latest) || fs.statSync(latest).size === 0) return;
  fs.copyFileSync(latest, path.join(path.dirname(latest), `run-${runId}.log`));
}

function revParse(cwd: string, ref: string): string {
  try {
    return execFileSync('git', ['rev-parse', '--verify', ref], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

function resolveGitCommonDir(cwd: string): string {
  const common = execFileSync('git', ['rev-parse', '--git-common-dir'], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
  return path.resolve(cwd, common);
}

function evidenceFingerprint(cwd: string): string[] {
  const evidenceDir = path.join(
    resolveGitCommonDir(cwd),
    'grid-agent-control',
    'evidence',
  );
  if (!fs.existsSync(evidenceDir)) return [];

  return fs.readdirSync(evidenceDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const filename = path.join(evidenceDir, entry.name);
      const digest = crypto
        .createHash('sha256')
        .update(fs.readFileSync(filename))
        .digest('hex');
      return `evidence|${entry.name}|${digest}`;
    })
    .sort();
}

function progressFingerprint(cwd: string): string {
  const integrationRef = resolveGridBuilderIntegrationRef(cwd) ?? '';
  const integrationSha = integrationRef ? revParse(cwd, integrationRef) : '';
  const claims = readClaims(cwd)
    .filter((claim) => claim.lane !== 'grid-builder-os')
    .map((claim) => [
      claim.lane,
      claim.branch,
      revParse(cwd, claim.branch),
      claim.goal,
    ].join('|'))
    .sort();
  return [
    integrationRef,
    integrationSha,
    ...claims,
    ...evidenceFingerprint(cwd),
  ].join('\n');
}

interface SharedEvidenceRecord {
  status?: string;
  integrationCommit?: string;
  summary?: string;
  buildIncluded?: boolean;
}

interface EvidenceRefreshOutcome {
  attempted: string[];
  failures: string[];
}

function readSharedEvidence(cwd: string, filename: string): SharedEvidenceRecord | null {
  const evidencePath = path.join(
    resolveGitCommonDir(cwd),
    'grid-agent-control',
    'evidence',
    filename,
  );
  if (!fs.existsSync(evidencePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(evidencePath, 'utf8')) as SharedEvidenceRecord;
  } catch {
    return null;
  }
}

function currentFullReleaseGatePass(cwd: string): boolean {
  const integrationRef = resolveGridBuilderIntegrationRef(cwd);
  const integrationCommit = integrationRef ? revParse(cwd, integrationRef) : '';
  const evidence = readSharedEvidence(cwd, 'release-gate.json');
  return Boolean(
    integrationCommit
    && evidence?.status === 'PASS'
    && evidence.integrationCommit === integrationCommit
    && evidence.buildIncluded === true
  );
}

function refreshRequiredEvidence(
  cwd: string,
  supervisorPath: string,
): EvidenceRefreshOutcome {
  const integrationRef = resolveGridBuilderIntegrationRef(cwd);
  const integrationCommit = integrationRef ? revParse(cwd, integrationRef) : '';
  if (!integrationCommit) {
    return {
      attempted: [],
      failures: ['Could not resolve the canonical integration commit for evidence refresh.'],
    };
  }

  const nodeBin = resolvePreferredLocalNodeBinary();
  const viteNode = path.join(
    supervisorPath,
    'node_modules',
    'vite-node',
    'vite-node.mjs',
  );
  const specs = [
    {
      id: 'browser-runtime',
      filename: 'browser-runtime.json',
      script: 'scripts/grid-browser-runtime.ts',
      timeoutMs: 8 * 60 * 1000,
    },
    {
      id: 'migration-safety',
      filename: 'migration-safety.json',
      script: 'scripts/grid-migration-safety.ts',
      timeoutMs: 2 * 60 * 1000,
    },
  ];

  const outcome: EvidenceRefreshOutcome = { attempted: [], failures: [] };
  for (const spec of specs) {
    const current = readSharedEvidence(cwd, spec.filename);
    if (
      current?.status === 'PASS'
      && current.integrationCommit === integrationCommit
    ) {
      appendLog(cwd, `Evidence already current: ${spec.id} PASS @ ${integrationCommit.slice(0, 8)}`);
      continue;
    }

    outcome.attempted.push(spec.id);
    appendLog(cwd, `Refreshing parent-runner evidence: ${spec.id} @ ${integrationCommit.slice(0, 8)}`);
    try {
      execFileSync(
        nodeBin,
        [viteNode, spec.script, '--record', '--json'],
        {
          cwd: supervisorPath,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
          timeout: spec.timeoutMs,
          maxBuffer: 10 * 1024 * 1024,
          env: {
            ...process.env,
            GRID_RUNTIME_NODE_BIN: nodeBin,
            PATH: [
              path.dirname(nodeBin),
              process.env.PATH ?? '',
            ].filter(Boolean).join(path.delimiter),
          },
        },
      );
    } catch (error) {
      appendLog(
        cwd,
        `Parent evidence command failed for ${spec.id}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const refreshed = readSharedEvidence(cwd, spec.filename);
    if (
      refreshed?.status !== 'PASS'
      || refreshed.integrationCommit !== integrationCommit
    ) {
      outcome.failures.push(
        `${spec.id}: ${refreshed?.summary ?? refreshed?.status ?? 'no valid evidence recorded'}`,
      );
      continue;
    }

    appendLog(cwd, `Parent evidence refresh passed: ${spec.id} @ ${integrationCommit.slice(0, 8)}`);
  }

  return outcome;
}

function prepareSupervisorWorktree(cwd: string, runId: string): string {
  const integrationRef = resolveGridBuilderIntegrationRef(cwd);
  if (!integrationRef) throw new Error('Builder OS could not find the canonical Grid integration branch.');
  const supervisorPath = path.join('/private/tmp', `grid-builder-supervisor-${runId}`);
  if (fs.existsSync(supervisorPath)) {
    throw new Error(`Builder OS supervisor worktree already exists: ${supervisorPath}`);
  }
  execFileSync('git', ['worktree', 'add', '--detach', supervisorPath, integrationRef], {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const sourceModules = path.join(cwd, 'node_modules');
  const targetModules = path.join(supervisorPath, 'node_modules');
  if (fs.existsSync(sourceModules) && !fs.existsSync(targetModules)) {
    fs.symlinkSync(sourceModules, targetModules, 'dir');
  }
  return supervisorPath;
}

function cleanupSupervisorWorktree(cwd: string, supervisorPath: string): { clean: boolean; message?: string } {
  try {
    const dirty = execFileSync('git', ['status', '--short'], {
      cwd: supervisorPath,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
    if (dirty) {
      return {
        clean: false,
        message: `The supervisor worktree contains unexpected edits and was preserved for inspection: ${supervisorPath}`,
      };
    }
    execFileSync('git', ['worktree', 'remove', supervisorPath], {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { clean: true };
  } catch (error) {
    return {
      clean: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

function supervisorPrompt(assignments: CrewDispatchAssignment[]): string {
  const firstWave = assignments.length
    ? [
        'PARENT PREASSIGNED FIRST WAVE — preserve these worker/task identities unless a fresh Control Tower conflict makes one unsafe:',
        ...assignments.map((assignment) =>
          `- ${assignment.slot.toUpperCase()} -> ${assignment.taskId}: ${assignment.title} [${assignment.action}; ${assignment.specialization}] — ${assignment.whyNow}`),
        '- These are distinct task identities selected before the supervisor started. Derive exact non-overlapping file scopes and claims before launching them.',
      ]
    : [
        'PARENT PREASSIGNED FIRST WAVE: none. The parent found no current Product Director recommendations; do not invent work just to fill worker slots.',
      ];

  return [
    'You are the crew scheduler AND the Codex worker slot for The Grid local Builder OS.',
    'This is one bounded orchestration cycle made of repeated worker waves, not a single-task handoff and not an endless daemon.',
    '',
    'FIRST: read AGENTS.md, PROJECT-BRAIN.md, docs/GRID_AGENT_CONTROL.md, and current canonical Grid specs.',
    'Inspect current Control Tower claims, active worktrees, recent canonical commits, Product Director, Playable Loop Score, and Definition-of-Done state before assigning anything.',
    '',
    'CONTROL PLANE COMMANDS — use these exact commands; do not guess npm aliases:',
    '- Control Tower: npm run grid:agents -- status',
    '- Preflight: npm run grid:agents -- check',
    '- Master Board: node ./node_modules/vite-node/vite-node.mjs scripts/grid-master-board.ts --json',
    '- Product Director: node ./node_modules/vite-node/vite-node.mjs scripts/grid-product-director.ts --json',
    '- Playable Loop: node ./node_modules/vite-node/vite-node.mjs scripts/grid-playable-loop-score.ts --json',
    '- Prioritizer: node ./node_modules/vite-node/vite-node.mjs scripts/grid-prioritize.ts --json',
    '- Builder snapshot: node ./node_modules/vite-node/vite-node.mjs scripts/grid-builder-os.ts status --json',
    '- Browser evidence refresh is parent-runner owned. Do NOT run `scripts/grid-browser-runtime.ts --record` inside the supervisor sandbox; read the release candidate evidence instead.',
    '- Migration safety refresh is parent-runner owned. Do NOT run `scripts/grid-migration-safety.ts --record` inside the supervisor sandbox; read the release candidate evidence instead.',
    '- Release candidate read: node ./node_modules/vite-node/vite-node.mjs scripts/grid-release-candidate.ts --json',
    '- Definition-of-Done: only after a named worker branch exists; call scripts/grid-definition-done-gate.ts with explicit --branch, --lane, and --integration-ref arguments.',
    '- Merge Conveyor: call scripts/grid-merge-conveyor.ts directly; planning is default and --execute is only for an already verified, released lane.',
    '- Do NOT run scripts/grid-builder-os-health.ts from the supervisor sandbox. It writes shared health state; use cached crew health from the Builder snapshot. Live health refresh belongs to the Boss Panel.',
    '- Cached crew health is advisory only. Do not block a cycle because cached health is stale or red when the current lead/worker process itself is running successfully; live worker launch results are stronger evidence.',
    '- Do NOT use raw `kill -0`, sandbox-local `ps`, or signal permission failures to decide whether the parent Builder runner is alive. Sandbox EPERM can mean the process exists but cannot be signaled. Trust Builder OS run state and continue the bounded cycle unless the runner itself terminates you.',
    '',
    'OPERATING RULES:',
    '- Do not edit the current canonical/integration checkout directly.',
    '- Do not deploy, push main/master, or touch production databases.',
    '- Continue and harvest existing claimed lanes before creating new ones.',
    '- Use focused verification; never launch duplicate full typecheck/build jobs.',
    '- When a lane is complete, use the Definition-of-Done Gate, release it, then plan/execute the Merge Conveyor only when safe.',
    '',
    ...firstWave,
    '',
    'THREE-SLOT CREW SCHEDULER — this is the primary execution model:',
    '- Codex, Claude, and Gemini are three independent worker slots. They are NOT fallback workers for the same task.',
    '- Before launching implementation work, build an ordered queue from Product Director, then Master Board prioritizer, then explicitly documented unfinished work. Never invent filler work.',
    '- Select up to three DISTINCT tasks at a time. Never assign the same candidate, lane, branch, worktree, goal, or overlapping file scope to more than one worker slot.',
    '- Derive exact file scope for each selected task first. Create all safe non-overlapping Control Tower claims and isolated worktrees sequentially BEFORE starting concurrent worker execution. If scopes cannot be proven non-overlapping, do not parallelize those tasks.',
    '- Codex slot: the current Codex lead works one claimed task itself in that task worktree. NEVER launch nested `codex exec`.',
    '- Claude slot: launch Claude non-interactively in its own claimed worktree on a different task.',
    '- Claude implementation launch template (run from its claimed worktree): claude -p --permission-mode acceptEdits --output-format text "<task prompt>".',
    '- Gemini slot: launch Gemini non-interactively in its own claimed worktree on a third different task.',
    '- Gemini implementation launch template (run from its claimed worktree): gemini --skip-trust --approval-mode yolo --output-format text --prompt "<task prompt>".',
    '- Worker prompts must repeat the lane, exact allowed scope, acceptance criteria, required focused tests, no-production rule, and commit/handoff requirement.',
    '- Launch Claude and Gemini as background processes after their claims exist, capture each PID/log separately, then immediately begin the Codex slot task. Do not wait for one worker to finish before starting the others.',
    '- Continuously heartbeat and harvest all active slots. When ANY slot finishes, verify/commit/Definition-of-Done/release/integrate it when safe, re-scan canonical + claims + Product Director, and IMMEDIATELY refill that same CLI slot with the next safe distinct task.',
    '- Repeat worker waves until there is no safe documented work left, a genuine operator blocker exists, or the Builder cycle time limit is reached.',
    '- If fewer than three safe non-overlapping tasks exist, run only the available distinct tasks. Never duplicate one task merely to keep all slots busy.',
    '- If Claude or Gemini is unavailable, unauthenticated, missing credentials, stalled, or errors, mark THAT slot unavailable once and keep the other slots running. Release/requeue its unstarted claim safely. Do NOT collapse its task onto Codex just to simulate three workers.',
    '- Missing Claude/Gemini authentication is a crew-capacity problem that should be surfaced to Dustin, but it must not stop healthy independent slots from continuing.',
    '- Before creating an implementation lane for a verification/readiness task, search the repo for the harness and current shared evidence. If the harness already exists and the only need is stale/missing evidence, run the existing local-only verifier directly with its `--record --json` mode instead of reimplementing it.',
    '- Verification-only evidence refreshes do not require a product-code worker branch when no source edits are needed. They may update only shared git-common coordination evidence and must remain local-only with no production access.',
    '- Every new implementation worker gets an isolated worktree, explicit Control Tower claim, exact scope, and clear acceptance criteria.',
    '- Lead self-execution must happen only in the Codex slot claimed worker worktree under /private/tmp; never edit the supervisor worktree or canonical checkout to implement product code.',
    '- A successful cycle must produce observable progress: integrate a commit, advance a claimed branch, release/replace a completed claim, create a new valid claim for documented work, or refresh commit-bound shared verification evidence. Exiting cleanly with no repo/claim/evidence progress is NOT success.',
    '- Stop only when the safe queue is exhausted, the cycle time limit is reached, or a real blocker requires Dustin.',
    '',
    'At the end, print a concise operator summary by worker slot (Codex / Claude / Gemini): tasks completed, current lane, next refill or unavailable reason, what was integrated, what remains active, and whether Dustin must do anything.',
  ].join('\n');
}

interface AgentResult {
  code: number | null;
  signal: NodeJS.Signals | null;
  pid?: number;
  error?: string;
  timedOut: boolean;
}

function runLead(params: {
  cwd: string;
  command: string;
  args: string[];
  input?: string;
  lead: 'codex' | 'claude';
  runState: GridBuilderRunState;
  pathPrefix?: string;
}): Promise<AgentResult> {
  return new Promise((resolve) => {
    const logFd = fs.openSync(gridBuilderLogFile(params.cwd), 'a');
    let settled = false;
    const child = spawn(params.command, params.args, {
      cwd: params.cwd,
      env: {
        ...process.env,
        PATH: params.pathPrefix
          ? [params.pathPrefix, process.env.PATH ?? ''].filter(Boolean).join(path.delimiter)
          : process.env.PATH,
      },
      stdio: ['pipe', logFd, logFd],
    });

    const current: GridBuilderRunState = {
      ...params.runState,
      lead: params.lead,
      leadPid: child.pid,
      message: `${params.lead === 'codex' ? 'Lead Builder' : 'Backup Lead'} is coordinating the build cycle.`,
    };
    writeGridBuilderRunState(current, params.cwd);
    appendLog(params.cwd, `Started ${params.lead} lead process pid=${child.pid ?? 'unknown'}`);

    if (params.input) child.stdin?.end(params.input);
    else child.stdin?.end();

    const timer = setTimeout(() => {
      if (settled) return;
      appendLog(params.cwd, `${params.lead} exceeded the ${MAX_LEAD_RUNTIME_MS / 60000}-minute cycle limit; stopping it.`);
      child.kill('SIGTERM');
      setTimeout(() => {
        if (!settled) child.kill('SIGKILL');
      }, 5000).unref();
    }, MAX_LEAD_RUNTIME_MS);
    timer.unref();

    child.once('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fs.closeSync(logFd);
      resolve({ code: null, signal: null, error: error.message, pid: child.pid, timedOut: false });
    });

    child.once('exit', (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fs.closeSync(logFd);
      resolve({
        code,
        signal,
        pid: child.pid,
        timedOut: signal === 'SIGKILL' || signal === 'SIGTERM',
      });
    });
  });
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const cwd = path.resolve(value(args, '--cwd') ?? process.cwd());
  const runId = value(args, '--run-id') ?? crypto.randomBytes(5).toString('hex');
  fs.mkdirSync(path.dirname(gridBuilderLogFile(cwd)), { recursive: true });
  const previous = readGridBuilderRunState(cwd);
  if (previous.status === 'working' && previous.pid !== process.pid) {
    throw new Error('Builder OS refused to start because another build cycle is already running.');
  }
  archiveBuilderLog(cwd, previous.runId);
  fs.writeFileSync(gridBuilderLogFile(cwd), '');
  const beforeProgress = progressFingerprint(cwd);

  let state: GridBuilderRunState = {
    version: 1,
    runId,
    status: 'working',
    pid: process.pid,
    startedAt: new Date().toISOString(),
    message: 'Builder OS is checking the crew and current Grid state.',
  };
  writeGridBuilderRunState(state, cwd);
  appendLog(cwd, `Build cycle ${runId} started from ${cwd}`);

  const supervisorPath = prepareSupervisorWorktree(cwd, runId);
  appendLog(cwd, `Created isolated supervisor worktree ${supervisorPath}`);
  const evidenceRefresh = refreshRequiredEvidence(cwd, supervisorPath);
  if (evidenceRefresh.attempted.length > 0) {
    appendLog(cwd, `Parent evidence refresh attempted: ${evidenceRefresh.attempted.join(', ')}`);
  }
  if (evidenceRefresh.failures.length > 0) {
    appendLog(cwd, `Parent evidence refresh failures: ${evidenceRefresh.failures.join(' | ')}`);
  }
  const dispatchSnapshot = collectGridBuilderOsSnapshot({
    cwd,
    hostname: 'localhost',
    nodeEnv: process.env.NODE_ENV,
  });
  const crewAssignments = buildCrewDispatchAssignments(dispatchSnapshot.recommendations);
  appendLog(
    cwd,
    crewAssignments.length
      ? `Parent crew wave: ${crewAssignments.map((item) => `${item.slot}=${item.taskId}`).join(', ')}`
      : 'Parent crew wave: no Product Director tasks available.',
  );
  const prompt = supervisorPrompt(crewAssignments);
  const codexBinary = resolvePreferredCliBinary('codex');
  const claudeBinary = resolvePreferredCliBinary('claude');
  const geminiBinary = resolvePreferredCliBinary('gemini');
  const gitCommonDir = resolveGitCommonDir(cwd);
  const pathPrefix = Array.from(new Set(
    [codexBinary, claudeBinary, geminiBinary]
      .filter((binary): binary is string => Boolean(binary))
      .map((binary) => path.dirname(binary)),
  )).join(path.delimiter);
  let result: AgentResult;

  if (!codexBinary) {
    result = { code: null, signal: null, error: 'Preferred Codex CLI is not installed.', timedOut: false };
  } else {
    appendLog(cwd, `Using preferred Codex toolchain from ${path.dirname(codexBinary)}`);
    result = await runLead({
      cwd: supervisorPath,
      command: codexBinary,
      args: ['exec', '-C', supervisorPath, '-s', 'workspace-write', '--add-dir', '/private/tmp', '--add-dir', gitCommonDir, '--color', 'never', '-'],
      input: prompt,
      lead: 'codex',
      runState: state,
      pathPrefix,
    });
  }

  if (result.code !== 0) {
    appendLog(cwd, `Codex lead unavailable or failed (code=${result.code ?? 'none'}${result.error ? `, ${result.error}` : ''}). Falling back to Claude.`);
    state = {
      ...readGridBuilderRunState(cwd),
      lead: 'claude',
      message: 'Lead Builder was unavailable, so the backup lead is taking over.',
    };
    writeGridBuilderRunState(state, cwd);
    if (!claudeBinary) {
      result = { code: null, signal: null, error: 'Preferred Claude CLI is not installed.', timedOut: false };
    } else {
      appendLog(cwd, `Using preferred Claude toolchain from ${path.dirname(claudeBinary)}`);
      result = await runLead({
        cwd: supervisorPath,
        command: claudeBinary,
        args: ['-p', '--permission-mode', 'acceptEdits', '--output-format', 'text', prompt],
        lead: 'claude',
        runState: state,
        pathPrefix,
      });
    }
  }

  const cleanup = cleanupSupervisorWorktree(cwd, supervisorPath);
  if (!cleanup.clean) appendLog(cwd, cleanup.message ?? 'Supervisor worktree cleanup was refused.');
  const progressChanged = progressFingerprint(cwd) !== beforeProgress;
  const leadSucceeded = result.code === 0 && cleanup.clean;
  const evidenceHealthy = evidenceRefresh.failures.length === 0;
  const steadySnapshot = collectGridBuilderOsSnapshot({
    cwd,
    hostname: 'localhost',
    nodeEnv: process.env.NODE_ENV,
  });
  const steadyStateHealthy = Boolean(
    evidenceHealthy
    && currentFullReleaseGatePass(cwd)
    && isGridBuilderSteadyState(steadySnapshot)
  );
  const ok = leadSucceeded && evidenceHealthy && (progressChanged || steadyStateHealthy);
  if (leadSucceeded && !progressChanged) {
    appendLog(
      cwd,
      steadyStateHealthy
        ? 'STEADY STATE: canonical Grid work and current-commit local release evidence are already complete; no new lane is required.'
        : 'NO-OP BLOCKED: lead exited successfully but canonical, claimed branch, and shared evidence state did not advance.',
    );
  }
  const finalState: GridBuilderRunState = {
    ...readGridBuilderRunState(cwd),
    status: ok ? 'finished' : 'needs_attention',
    endedAt: new Date().toISOString(),
    exitCode: result.code,
    leadPid: undefined,
    message: !evidenceHealthy
      ? `Required local verification evidence failed: ${evidenceRefresh.failures.join(' | ')}`
      : ok && progressChanged
        ? 'Build cycle finished with observable repo, claim, or verification-evidence progress.'
        : ok && steadyStateHealthy
          ? 'Build cycle finished: the current Grid milestone set and local release evidence are already up to date.'
          : leadSucceeded && !progressChanged
            ? 'Build cycle made no observable repo, claim, or verification-evidence progress. It was blocked as a no-op instead of being reported as finished.'
            : !cleanup.clean
              ? cleanup.message ?? 'The supervisor worktree needs inspection before restarting.'
              : result.timedOut
                ? 'The build lead stopped after reaching the cycle time limit. Review before restarting.'
                : 'The build crew could not finish this cycle. Review the needs-you panel before restarting.',
  };
  writeGridBuilderRunState(finalState, cwd);
  appendLog(
    cwd,
    `Build cycle ${runId} finished status=${finalState.status} exit=${String(result.code)} progress=${progressChanged ? 'changed' : 'unchanged'} evidence=${evidenceHealthy ? 'pass' : 'failed'} steady=${steadyStateHealthy ? 'yes' : 'no'}`,
  );
  archiveBuilderLog(cwd, runId);
  process.exitCode = ok ? 0 : 1;
}

main().catch((error) => {
  const cwd = path.resolve(value(process.argv.slice(2), '--cwd') ?? process.cwd());
  const state: GridBuilderRunState = {
    version: 1,
    runId: 'failed-start',
    status: 'needs_attention',
    pid: process.pid,
    startedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
    exitCode: 1,
    message: error instanceof Error ? error.message : String(error),
  };
  try {
    writeGridBuilderRunState(state, cwd);
    appendLog(cwd, state.message);
  } catch {
    // Nothing else can safely be persisted if git coordination storage itself is unavailable.
  }
  process.stderr.write(state.message + '\n');
  process.exitCode = 1;
});


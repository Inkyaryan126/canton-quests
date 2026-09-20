import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { readClaims } from '../lib/agent-control';
import {
  gridBuilderLogFile,
  readGridBuilderRunState,
  resolveGridBuilderIntegrationRef,
  resolvePreferredCliBinary,
  writeGridBuilderRunState,
  type GridBuilderRunState,
} from '../lib/grid/ops/grid-builder-os';

const MAX_LEAD_RUNTIME_MS = 30 * 60 * 1000;

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
  return [integrationRef, integrationSha, ...claims].join('\n');
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

function supervisorPrompt(): string {
  return [
    'You are the lead supervisor for The Grid local Builder OS.',
    'This is one bounded orchestration cycle, not an endless daemon.',
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
    '- Definition-of-Done: only after a named worker branch exists; call scripts/grid-definition-done-gate.ts with explicit --branch, --lane, and --integration-ref arguments.',
    '- Merge Conveyor: call scripts/grid-merge-conveyor.ts directly; planning is default and --execute is only for an already verified, released lane.',
    '- Do NOT run scripts/grid-builder-os-health.ts from the supervisor sandbox. It writes shared health state; use cached crew health from the Builder snapshot. Live health refresh belongs to the Boss Panel.',
    '',
    'OPERATING RULES:',
    '- Do not edit the current canonical/integration checkout directly.',
    '- Do not deploy, push main/master, or touch production databases.',
    '- Continue and harvest existing claimed lanes before creating new ones.',
    '- Use focused verification; never launch duplicate full typecheck/build jobs.',
    '- When a lane is complete, use the Definition-of-Done Gate, release it, then plan/execute the Merge Conveyor only when safe.',
    '- Keep up to three useful development lanes active when safe.',
    '- Use Product Director recommendations as the first shortlist, but derive exact file scope before claiming. Never invent filler work.',
    '- If Product Director returns zero recommendations, run the Master Board prioritizer. If that also returns zero, inspect live Boardroom/Control Tower state and canonical Grid specs, CURRENT_MISSION, and ROADMAP for explicitly documented unfinished work. Only claim work whose requirements already exist in repository source-of-truth documents; never invent undefined mechanics.',
    '- Every new worker gets an isolated worktree, explicit Control Tower claim, exact scope, and clear acceptance criteria.',
    '- Prefer the installed Claude and Gemini CLIs as worker agents when their specialization fits. Use Codex where higher-level architecture or difficult integration is justified.',
    '- If a worker CLI is unavailable, stalled, or errors, record that and route to a healthy fallback instead of retrying the same failure repeatedly. If all worker CLIs fail but one safe documented task is executable by the lead, the lead must complete that bounded task itself rather than ending the cycle empty.',
    '- A successful cycle must produce observable progress: integrate a commit, advance a claimed branch, release/replace a completed claim, or create a new valid claim for documented work. Exiting cleanly with no repo/claim progress is NOT success.',
    '- Stop this cycle after existing ready work is harvested and safe replacement work is assigned or after a real blocker requires Dustin.',
    '',
    'At the end, print a concise operator summary: what was integrated, what remains active, what is blocked, and whether Dustin must do anything.',
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
  const prompt = supervisorPrompt();
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
  const ok = leadSucceeded && progressChanged;
  if (leadSucceeded && !progressChanged) {
    appendLog(cwd, 'NO-OP BLOCKED: lead exited successfully but canonical and claimed branch state did not advance.');
  }
  const finalState: GridBuilderRunState = {
    ...readGridBuilderRunState(cwd),
    status: ok ? 'finished' : 'needs_attention',
    endedAt: new Date().toISOString(),
    exitCode: result.code,
    leadPid: undefined,
    message: ok
      ? 'Build cycle finished with observable repo or claim progress.'
      : leadSucceeded && !progressChanged
        ? 'Build cycle made no observable repo or claim progress. It was blocked as a no-op instead of being reported as finished.'
        : !cleanup.clean
          ? cleanup.message ?? 'The supervisor worktree needs inspection before restarting.'
          : result.timedOut
            ? 'The build lead stopped after reaching the cycle time limit. Review before restarting.'
            : 'The build crew could not finish this cycle. Review the needs-you panel before restarting.',
  };
  writeGridBuilderRunState(finalState, cwd);
  appendLog(cwd, `Build cycle ${runId} finished status=${finalState.status} exit=${String(result.code)} progress=${progressChanged ? 'changed' : 'unchanged'}`);
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


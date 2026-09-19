import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
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
    'OPERATING RULES:',
    '- Do not edit the current canonical/integration checkout directly.',
    '- Do not deploy, push main/master, or touch production databases.',
    '- Continue and harvest existing claimed lanes before creating new ones.',
    '- Use focused verification; never launch duplicate full typecheck/build jobs.',
    '- When a lane is complete, use the Definition-of-Done Gate, release it, then plan/execute the Merge Conveyor only when safe.',
    '- Keep up to three useful development lanes active when safe.',
    '- Use Product Director recommendations as the shortlist, but derive exact file scope before claiming. Never invent filler work.',
    '- Every new worker gets an isolated worktree, explicit Control Tower claim, exact scope, and clear acceptance criteria.',
    '- Prefer the installed Claude and Gemini CLIs as worker agents when their specialization fits. Use Codex where higher-level architecture or difficult integration is justified.',
    '- If a worker CLI is unavailable, stalled, or errors, record that and route to a healthy fallback instead of retrying the same failure repeatedly.',
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
  fs.writeFileSync(gridBuilderLogFile(cwd), '');
  const previous = readGridBuilderRunState(cwd);
  if (previous.status === 'working' && previous.pid !== process.pid) {
    throw new Error('Builder OS refused to start because another build cycle is already running.');
  }

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
      args: ['exec', '-C', supervisorPath, '-s', 'workspace-write', '--add-dir', '/private/tmp', '--color', 'never', '-'],
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
  const ok = result.code === 0 && cleanup.clean;
  const finalState: GridBuilderRunState = {
    ...readGridBuilderRunState(cwd),
    status: ok ? 'finished' : 'needs_attention',
    endedAt: new Date().toISOString(),
    exitCode: result.code,
    leadPid: undefined,
    message: ok
      ? 'Build cycle finished. Refresh to see the new checkpoints and next work.'
      : !cleanup.clean
        ? cleanup.message ?? 'The supervisor worktree needs inspection before restarting.'
        : result.timedOut
        ? 'The build lead stopped after reaching the cycle time limit. Review before restarting.'
        : 'The build crew could not finish this cycle. Review the needs-you panel before restarting.',
  };
  writeGridBuilderRunState(finalState, cwd);
  appendLog(cwd, `Build cycle ${runId} finished status=${finalState.status} exit=${String(result.code)}`);
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


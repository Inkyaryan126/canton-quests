import path from 'node:path';
import { spawn } from 'node:child_process';
import {
  resolvePreferredCliBinary,
  writeGridBuilderCliHealthCache,
  type GridBuilderCliHealthCache,
  type GridBuilderCliName,
} from '../lib/grid/ops/grid-builder-os';

const PROBE_TIMEOUT_MS = 30_000;
const HEALTH_PROMPT = 'Respond exactly HEALTHY and nothing else. Do not use tools.';

interface ProbeResult {
  name: GridBuilderCliName;
  status: 'ready' | 'needs_attention';
  version: string | null;
  detail: string;
}

function terminateProcessGroup(child: ReturnType<typeof spawn>, signal: NodeJS.Signals): void {
  if (!child.pid) return;
  if (process.platform !== 'win32') {
    try {
      process.kill(-child.pid, signal);
      return;
    } catch {
      // Fall back to the direct child below.
    }
  }
  child.kill(signal);
}

function value(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
}

function versionFor(binary: string, name: GridBuilderCliName): Promise<string | null> {
  return new Promise((resolve) => {
    const child = spawn(binary, ['--version'], { stdio: ['ignore', 'pipe', 'ignore'] });
    let stdout = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), 5_000);
    child.stdout?.on('data', (chunk) => { stdout += String(chunk); });
    child.once('error', () => { clearTimeout(timer); resolve(null); });
    child.once('exit', (code) => {
      clearTimeout(timer);
      if (code !== 0) return resolve(null);
      const first = stdout.trim().split('\n').find(Boolean)?.trim() ?? null;
      if (!first) return resolve(null);
      resolve(name === 'codex' ? first.replace(/^codex-cli\s+/i, '') : first);
    });
  });
}

function probeArgs(name: GridBuilderCliName, cwd: string): string[] {
  if (name === 'codex') {
    return ['exec', '-C', cwd, '-s', 'read-only', HEALTH_PROMPT];
  }
  if (name === 'claude') {
    return ['-p', '--permission-mode', 'manual', '--output-format', 'text', HEALTH_PROMPT];
  }
  return ['--skip-trust', '--approval-mode', 'plan', '-o', 'text', '-p', HEALTH_PROMPT];
}

async function probe(name: GridBuilderCliName, cwd: string): Promise<ProbeResult> {
  const binary = resolvePreferredCliBinary(name);
  if (!binary) {
    return { name, status: 'needs_attention', version: null, detail: 'CLI is not installed.' };
  }

  const version = await versionFor(binary, name);
  return new Promise((resolve) => {
    const child = spawn(binary, probeArgs(name, cwd), {
      cwd,
      env: {
        ...process.env,
        PATH: [path.dirname(binary), process.env.PATH ?? ''].filter(Boolean).join(path.delimiter),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
    });
    let stdout = '';
    let stderr = '';
    let settled = false;

    const finish = (result: ProbeResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    const timer = setTimeout(() => {
      terminateProcessGroup(child, 'SIGTERM');
      setTimeout(() => terminateProcessGroup(child, 'SIGKILL'), 2_000).unref();
      finish({
        name,
        status: 'needs_attention',
        version,
        detail: `Live health probe timed out after ${PROBE_TIMEOUT_MS / 1000}s.`,
      });
    }, PROBE_TIMEOUT_MS);
    timer.unref();

    child.stdout?.on('data', (chunk) => { stdout += String(chunk); });
    child.stderr?.on('data', (chunk) => { stderr += String(chunk); });
    child.once('error', (error) => {
      clearTimeout(timer);
      finish({ name, status: 'needs_attention', version, detail: `Could not start: ${error.message}` });
    });
    child.once('exit', (code) => {
      clearTimeout(timer);
      if (settled) return;
      if (code === 0 && stdout.trim().includes('HEALTHY')) {
        finish({ name, status: 'ready', version, detail: 'Live model probe passed.' });
        return;
      }
      const detail = stderr.trim().split('\n').find(Boolean) ?? `Exited with code ${String(code)}.`;
      finish({ name, status: 'needs_attention', version, detail: detail.slice(0, 220) });
    });
  });
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const cwd = path.resolve(value(args, '--cwd') ?? process.cwd());
  const json = args.includes('--json');
  const results: ProbeResult[] = [];

  for (const name of ['codex', 'claude', 'gemini'] as const) {
    const result = await probe(name, cwd);
    results.push(result);
    if (!json) {
      process.stdout.write(`${name.toUpperCase()}: ${result.status} ${result.version ?? ''} — ${result.detail}\n`);
    }
  }

  const checkedAt = new Date().toISOString();
  const cache: GridBuilderCliHealthCache = {
    version: 1,
    checkedAt,
    entries: Object.fromEntries(results.map((result) => [result.name, {
      status: result.status,
      version: result.version,
      detail: result.detail,
    }])),
  };
  writeGridBuilderCliHealthCache(cache, cwd);

  if (json) process.stdout.write(`${JSON.stringify({ checkedAt, results }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

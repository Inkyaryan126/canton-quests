import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { writeGridBuilderVerificationRunState } from '../lib/grid/ops/grid-builder-os';

function flag(name: string): string | undefined {
  const args = process.argv.slice(2);
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
}

const cwd = path.resolve(flag('cwd') ?? process.cwd());
const runId = flag('run-id') ?? 'unknown';
const viteNode = path.join(cwd, 'node_modules', 'vite-node', 'vite-node.mjs');
const startedAt = new Date().toISOString();

const steps = [
  { label: 'V1 feature verification', script: 'grid-completion-board.ts', args: ['--verify-tests', '--json'] },
  { label: 'browser runtime verification', script: 'grid-browser-runtime.ts', args: ['--record', '--json'] },
  { label: 'migration safety verification', script: 'grid-migration-safety.ts', args: ['--record', '--json'] },
  { label: 'full release gate', script: 'grid-release-gate.ts', args: ['--record'] },
] as const;

function writeWorking(message: string) {
  writeGridBuilderVerificationRunState({
    version: 1,
    runId,
    status: 'working',
    pid: process.pid,
    startedAt,
    message,
  }, cwd);
}

function finish(status: 'finished' | 'needs_attention', exitCode: number, message: string) {
  writeGridBuilderVerificationRunState({
    version: 1,
    runId,
    status,
    startedAt,
    endedAt: new Date().toISOString(),
    exitCode,
    message,
  }, cwd);
}

try {
  for (const step of steps) {
    writeWorking(`Running ${step.label}.`);
    const result = spawnSync(process.execPath, [viteNode, path.join(cwd, 'scripts', step.script), ...step.args], {
      cwd,
      env: { ...process.env },
      stdio: 'ignore',
      timeout: 45 * 60 * 1000,
    });
    const exitCode = result.status ?? 1;
    if (exitCode !== 0) {
      finish('needs_attention', exitCode, `${step.label} failed. Review the current verification evidence before rerunning.`);
      process.exitCode = exitCode;
      process.exit();
    }
  }
  finish('finished', 0, 'Full Test & Build verification passed and all commit-bound Grid evidence is current.');
  process.exitCode = 0;
} catch {
  finish('needs_attention', 1, 'Full Test & Build verification stopped unexpectedly. It is safe to rerun.');
  process.exitCode = 1;
}

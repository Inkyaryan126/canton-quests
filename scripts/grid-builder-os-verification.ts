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
const releaseGate = path.join(cwd, 'scripts', 'grid-release-gate.ts');

function finish(status: 'finished' | 'needs_attention', exitCode: number, message: string) {
  writeGridBuilderVerificationRunState({
    version: 1,
    runId,
    status,
    endedAt: new Date().toISOString(),
    exitCode,
    message,
  }, cwd);
}

try {
  const result = spawnSync(process.execPath, [viteNode, releaseGate, '--record'], {
    cwd,
    env: { ...process.env },
    stdio: 'ignore',
    timeout: 45 * 60 * 1000,
  });
  const exitCode = result.status ?? 1;
  if (exitCode === 0) {
    finish('finished', 0, 'Full Test & Build verification passed on the current canonical Grid commit.');
    process.exitCode = 0;
  } else {
    finish('needs_attention', exitCode, 'Full Test & Build verification failed. Review the release-gate evidence before rerunning.');
    process.exitCode = exitCode;
  }
} catch {
  finish('needs_attention', 1, 'Full Test & Build verification stopped unexpectedly. It is safe to rerun.');
  process.exitCode = 1;
}

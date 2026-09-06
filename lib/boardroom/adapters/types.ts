import type { AgentRunResult } from '../types';

export interface AdapterRunOptions {
  /** Working directory the CLI should operate in — always the repo root during real runs. */
  cwd: string;
  /** Per-invocation timeout; runner.ts enforces SIGTERM then SIGKILL after a grace period. */
  timeoutMs: number;
  /** Where to write a captured invocation log (full stdout+stderr) for audit/replay. */
  logFile?: string;
  /** Testing hook: replace the real CLI binary name with a fake one (e.g. tests/fixtures/fake-cli.sh). */
  binaryOverride?: string;
}

export interface AgentAdapter {
  readonly name: 'ASTRA' | 'CLAUDE' | 'AGY';
  run(prompt: string, opts: AdapterRunOptions): Promise<AgentRunResult>;
}

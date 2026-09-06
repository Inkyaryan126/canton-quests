/**
 * Agy adapter. Non-interactive invocation confirmed via `agy --help`:
 * `agy -p --output-format json --mode accept-edits --print-timeout <Nm>
 * <prompt>`. Its flag surface is close enough to Claude Code's own that
 * it's very likely a separately-branded build of the same underlying CLI
 * framework — treated as an independent tool with its own adapter
 * regardless. No usage/quota introspection exists on this CLI either.
 */
import { spawnAndCapture } from '../runner';
import { looksLikeUsageExhaustion } from './exhaustionPatterns';
import type { AgentAdapter, AdapterRunOptions } from './types';
import type { AgentRunResult } from '../types';

export const agyAdapter: AgentAdapter = {
  name: 'AGY',
  async run(prompt: string, opts: AdapterRunOptions): Promise<AgentRunResult> {
    const binary = opts.binaryOverride || 'agy';
    // agy has its own --print-timeout; set it generously above our own
    // runner-level timeout so OUR SIGTERM/SIGKILL ceiling is always the one
    // that actually governs — agy's own timeout is a secondary safety net.
    const agyTimeoutMinutes = Math.max(1, Math.ceil(opts.timeoutMs / 60_000) + 5);
    const args = ['-p', '--output-format', 'json', '--mode', 'accept-edits', '--print-timeout', `${agyTimeoutMinutes}m`, '--add-dir', opts.cwd, prompt];

    const result = await spawnAndCapture(binary, args, { cwd: opts.cwd, timeoutMs: opts.timeoutMs, logFile: opts.logFile });

    const combined = `${result.stdout}\n${result.stderr}`;
    const likelyUsageExhausted = looksLikeUsageExhaustion(combined);

    return {
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      likelyUsageExhausted,
      confidence: likelyUsageExhausted ? 'HIGH_CONFIDENCE' : result.exitCode === 0 ? 'HIGH_CONFIDENCE' : 'ASSUMPTION',
      durationMs: result.durationMs,
      timedOut: result.timedOut,
    };
  },
};

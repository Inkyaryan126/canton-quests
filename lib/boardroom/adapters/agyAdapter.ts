/**
 * Agy adapter. Non-interactive invocation confirmed via `agy --help`:
 * `agy -p --output-format json --mode accept-edits --print-timeout <Nm>
 * <prompt>`. Its flag surface is close enough to Claude Code's own that
 * it's very likely a separately-branded build of the same underlying CLI
 * framework — treated as an independent tool with its own adapter
 * regardless. No usage/quota introspection exists on this CLI either.
 */
import { spawnAndCapture } from '../runner';
import { looksLikeUsageExhaustion, structuredExhaustionSignal } from './exhaustionPatterns';
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
    // `-p` takes the very next token as the prompt (confirmed against the real
    // CLI during the Boardroom rehearsal — putting other flags between `-p`
    // and the prompt makes agy swallow the first flag as its prompt instead).
    const args = ['-p', prompt, '--output-format', 'json', '--mode', 'accept-edits', '--print-timeout', `${agyTimeoutMinutes}m`, '--add-dir', opts.cwd];

    const result = await spawnAndCapture(binary, args, { cwd: opts.cwd, timeoutMs: opts.timeoutMs, logFile: opts.logFile });

    // See claudeAdapter.ts: a clean exit is never scanned for exhaustion —
    // a real false positive on the first overnight run matched the bare
    // digits "429" inside an unrelated usage-stats number
    // (`"input_tokens":1034296`) in Agy's own successful JSON output.
    let likelyUsageExhausted = false;
    if (result.exitCode !== 0) {
      const structured = structuredExhaustionSignal(result.stdout);
      likelyUsageExhausted = structured ?? looksLikeUsageExhaustion(`${result.stdout}\n${result.stderr}`);
    }

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

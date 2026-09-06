/**
 * Claude adapter. Non-interactive invocation confirmed via `claude --help`:
 * `claude -p --output-format json --permission-mode acceptEdits <prompt>`.
 * No usage/quota introspection exists on this CLI's help surface either.
 */
import { spawnAndCapture } from '../runner';
import { looksLikeUsageExhaustion, structuredExhaustionSignal } from './exhaustionPatterns';
import type { AgentAdapter, AdapterRunOptions } from './types';
import type { AgentRunResult } from '../types';

export const claudeAdapter: AgentAdapter = {
  name: 'CLAUDE',
  async run(prompt: string, opts: AdapterRunOptions): Promise<AgentRunResult> {
    const binary = opts.binaryOverride || 'claude';
    // `-p` takes the very next token as the prompt (see agyAdapter.ts — agy
    // and claude appear to share the same underlying CLI framework, and this
    // was confirmed as a real bug on agy during the Boardroom rehearsal).
    const args = ['-p', prompt, '--output-format', 'json', '--permission-mode', 'acceptEdits'];

    const result = await spawnAndCapture(binary, args, { cwd: opts.cwd, timeoutMs: opts.timeoutMs, logFile: opts.logFile });

    // A clean exit can never be "usage exhausted" — a genuinely exhausted CLI
    // errors, it doesn't complete successfully with useful output. Scanning
    // a successful transcript for these phrases is exactly what produced a
    // real false positive (Astra's own prose quoting BOARDROOM.md's
    // documentation of this very pattern list). Only inspect on a non-zero
    // exit, and prefer the CLI's own structured error field over free-text
    // pattern-matching when the JSON output parses.
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

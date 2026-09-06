/**
 * Claude adapter. Non-interactive invocation confirmed via `claude --help`:
 * `claude -p --output-format json --permission-mode acceptEdits <prompt>`.
 * No usage/quota introspection exists on this CLI's help surface either.
 */
import { spawnAndCapture } from '../runner';
import { looksLikeUsageExhaustion } from './exhaustionPatterns';
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

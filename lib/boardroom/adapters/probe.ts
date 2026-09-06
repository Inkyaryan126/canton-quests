/**
 * Canton Quests Boardroom V2 — cheap health probe before exiling an agent.
 *
 * Per the explicit fix for the first overnight run's false positives: even
 * after a pattern/structured match suggests exhaustion, that's still only
 * ever HIGH_CONFIDENCE, never VERIFIED (see BOARDROOM.md). Before marking an
 * agent unavailable for the rest of a run — a consequential, hard-to-undo
 * decision — spend one cheap, trivial invocation to check whether the agent
 * is actually still blocked right now. A real account-wide exhaustion will
 * still fail the probe; a transient/session-level throttle (the genuine
 * Claude 429 observed, "resets 4:40am") often won't have.
 */
import type { AgentAdapter, AdapterRunOptions } from './types';
import type { AgentRunResult } from '../types';

export const PROBE_PROMPT = 'Reply with exactly: OK';
const PROBE_TIMEOUT_MS = 60_000;

export interface ProbeOutcome {
  healthy: boolean;
  result: AgentRunResult;
}

/**
 * Runs one trivial, cheap prompt through the same adapter/binary. `healthy`
 * is true only when the probe exits cleanly and shows no exhaustion signal
 * of its own — a probe that also looks exhausted (or crashes, or times out)
 * confirms rather than dismisses the original signal.
 */
export async function probeAgentHealth(adapter: AgentAdapter, opts: AdapterRunOptions): Promise<ProbeOutcome> {
  const result = await adapter.run(PROBE_PROMPT, { ...opts, timeoutMs: Math.min(opts.timeoutMs, PROBE_TIMEOUT_MS) });
  const healthy = result.exitCode === 0 && !result.likelyUsageExhausted && !result.timedOut;
  return { healthy, result };
}

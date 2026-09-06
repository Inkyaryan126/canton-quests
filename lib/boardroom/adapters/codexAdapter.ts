/**
 * Astra / Codex adapter. Non-interactive invocation confirmed via
 * `codex exec --help`: `codex exec -C <dir> --sandbox workspace-write
 * -o <outputFile> <prompt>`. No usage/quota introspection exists on this
 * CLI (checked `codex --help`, `codex exec --help`, `codex doctor --help`).
 */
import fs from 'fs';
import { spawnAndCapture } from '../runner';
import { looksLikeUsageExhaustion } from './exhaustionPatterns';
import type { AgentAdapter, AdapterRunOptions } from './types';
import type { AgentRunResult } from '../types';

export const codexAdapter: AgentAdapter = {
  name: 'ASTRA',
  async run(prompt: string, opts: AdapterRunOptions): Promise<AgentRunResult> {
    const binary = opts.binaryOverride || 'codex';
    const outputFile = opts.logFile ? `${opts.logFile}.last-message.txt` : undefined;
    const args = ['exec', '-C', opts.cwd, '--sandbox', 'workspace-write'];
    if (outputFile) args.push('-o', outputFile);
    args.push(prompt);

    const result = await spawnAndCapture(binary, args, { cwd: opts.cwd, timeoutMs: opts.timeoutMs, logFile: opts.logFile });

    // A clean exit is never scanned for exhaustion — a real false positive on
    // the first overnight run had Astra's own successful transcript quote
    // BOARDROOM.md's documentation of these very patterns (it read the file
    // as required reading), matching nearly every phrase in the list purely
    // from Astra's own SUCCESSFUL output.
    const likelyUsageExhausted = result.exitCode !== 0 && looksLikeUsageExhaustion(`${result.stdout}\n${result.stderr}`);
    let outputText: string | undefined;
    if (outputFile && fs.existsSync(outputFile)) {
      try {
        outputText = fs.readFileSync(outputFile, 'utf8');
      } catch {
        outputText = undefined;
      }
    }

    return {
      exitCode: result.exitCode,
      stdout: outputText ?? result.stdout,
      stderr: result.stderr,
      outputFile,
      likelyUsageExhausted,
      confidence: likelyUsageExhausted ? 'HIGH_CONFIDENCE' : result.exitCode === 0 ? 'HIGH_CONFIDENCE' : 'ASSUMPTION',
      durationMs: result.durationMs,
      timedOut: result.timedOut,
    };
  },
};

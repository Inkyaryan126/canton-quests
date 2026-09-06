// Canton Quests Boardroom V2 — adapter tests against tests/fixtures/fake-cli.sh.
//
// Never invokes the real codex/claude/agy binaries — see BOARDROOM.md honesty
// rules. Real, deliberate, one-off smoke tests against the actual CLIs are
// run manually outside this automated suite.

import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { codexAdapter } from '../lib/boardroom/adapters/codexAdapter';
import { claudeAdapter } from '../lib/boardroom/adapters/claudeAdapter';
import { agyAdapter } from '../lib/boardroom/adapters/agyAdapter';
import { getAdapter, ADAPTERS } from '../lib/boardroom/adapters/registry';
import { looksLikeUsageExhaustion, structuredExhaustionSignal } from '../lib/boardroom/adapters/exhaustionPatterns';

const FAKE_CLI = path.resolve(__dirname, 'fixtures', 'fake-cli.sh');

let workDir: string;

beforeEach(() => {
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boardroom-adapters-'));
  delete process.env.FAKE_CLI_EXIT_CODE;
  delete process.env.FAKE_CLI_STDOUT;
  delete process.env.FAKE_CLI_STDERR;
  delete process.env.FAKE_CLI_SLEEP_MS;
  delete process.env.FAKE_CLI_OUTPUT_FILE_CONTENT;
});

afterEach(() => {
  fs.rmSync(workDir, { recursive: true, force: true });
});

describe('registry', () => {
  it('maps each AgentName to its own adapter', () => {
    expect(getAdapter('ASTRA')).toBe(codexAdapter);
    expect(getAdapter('CLAUDE')).toBe(claudeAdapter);
    expect(getAdapter('AGY')).toBe(agyAdapter);
    expect(Object.keys(ADAPTERS).sort()).toEqual(['AGY', 'ASTRA', 'CLAUDE']);
  });
});

describe('looksLikeUsageExhaustion', () => {
  it('matches known exhaustion phrasing', () => {
    expect(looksLikeUsageExhaustion('Error: usage limit reached for this account')).toBe(true);
    expect(looksLikeUsageExhaustion('429 Too Many Requests')).toBe(true);
    expect(looksLikeUsageExhaustion('weekly limit exceeded')).toBe(true);
    expect(looksLikeUsageExhaustion("You've hit your session limit · resets 4:40am")).toBe(true);
  });

  it('does not match ordinary output', () => {
    expect(looksLikeUsageExhaustion('Applied 3 edits successfully.')).toBe(false);
    expect(looksLikeUsageExhaustion('')).toBe(false);
  });

  it('REGRESSION (first overnight run): does not match "429" embedded inside a larger number', () => {
    // The real false positive: Agy's own JSON usage stats included
    // "input_tokens":1034296 — the bare digit sequence "429" is a substring
    // of 1034296, but it's not a standalone token.
    expect(looksLikeUsageExhaustion('"usage":{"input_tokens":1034296,"output_tokens":61}')).toBe(false);
  });

  it('still matches a genuine standalone "429" token', () => {
    expect(looksLikeUsageExhaustion('"api_error_status":429,"result":"error"')).toBe(true);
    expect(looksLikeUsageExhaustion('HTTP/1.1 429 Too Many Requests')).toBe(true);
  });

  it('REGRESSION (first overnight run): does not match a benign topical mention of "rate limiting" as engineering prose', () => {
    // Astra's own audit doc recommended "Upstash Redis (Rate Limiting)" as
    // infrastructure — this is exactly the kind of successful, on-topic
    // engineering text that must never be confused with the CLI's own
    // usage state. (The real fix is exit-code gating in each adapter, which
    // this function alone can't provide — this test documents that the
    // phrase itself is still a plain substring match, by design, and the
    // adapter-level gating below is what actually prevents the false
    // positive in practice.)
    expect(looksLikeUsageExhaustion('Recommendation: Upstash Redis (Rate Limiting) for the leaderboard cache.')).toBe(true);
  });
});

describe('structuredExhaustionSignal', () => {
  it('returns true for a genuine is_error + 429/529 JSON payload', () => {
    expect(structuredExhaustionSignal('{"is_error":true,"api_error_status":429,"result":"You\'ve hit your session limit"}')).toBe(true);
    expect(structuredExhaustionSignal('{"is_error":true,"api_error_status":529,"result":"overloaded"}')).toBe(true);
  });

  it('returns false for a JSON payload with an unrelated non-error status', () => {
    expect(structuredExhaustionSignal('{"is_error":true,"api_error_status":500,"result":"internal error"}')).toBe(false);
  });

  it('returns null (defer to text patterns) when there is no recognizable structured field', () => {
    expect(structuredExhaustionSignal('{"is_error":false,"result":"OK"}')).toBeNull();
    expect(structuredExhaustionSignal('not json at all')).toBeNull();
  });
});

describe('claudeAdapter (fake CLI)', () => {
  it('captures a successful run', async () => {
    process.env.FAKE_CLI_EXIT_CODE = '0';
    process.env.FAKE_CLI_STDOUT = 'Task complete.';
    const result = await claudeAdapter.run('do the thing', { cwd: workDir, timeoutMs: 5000, binaryOverride: FAKE_CLI });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Task complete.');
    expect(result.likelyUsageExhausted).toBe(false);
    expect(result.confidence).toBe('HIGH_CONFIDENCE');
    expect(result.timedOut).toBe(false);
  });

  it('flags likely usage exhaustion from stderr text as HIGH_CONFIDENCE, never VERIFIED', async () => {
    process.env.FAKE_CLI_EXIT_CODE = '1';
    process.env.FAKE_CLI_STDERR = 'Error: usage limit reached';
    const result = await claudeAdapter.run('do the thing', { cwd: workDir, timeoutMs: 5000, binaryOverride: FAKE_CLI });
    expect(result.likelyUsageExhausted).toBe(true);
    expect(result.confidence).toBe('HIGH_CONFIDENCE');
    expect(result.confidence).not.toBe('VERIFIED');
  });

  it('a plain non-zero exit with no exhaustion phrasing is only an ASSUMPTION', async () => {
    process.env.FAKE_CLI_EXIT_CODE = '1';
    process.env.FAKE_CLI_STDERR = 'Some unrelated tool error';
    const result = await claudeAdapter.run('do the thing', { cwd: workDir, timeoutMs: 5000, binaryOverride: FAKE_CLI });
    expect(result.likelyUsageExhausted).toBe(false);
    expect(result.confidence).toBe('ASSUMPTION');
  });
});

describe('agyAdapter (fake CLI)', () => {
  it('captures a successful run', async () => {
    process.env.FAKE_CLI_EXIT_CODE = '0';
    process.env.FAKE_CLI_STDOUT = 'Agy done.';
    const result = await agyAdapter.run('do the thing', { cwd: workDir, timeoutMs: 5000, binaryOverride: FAKE_CLI });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Agy done.');
  });

  it('REGRESSION (first overnight run): a successful exit is NEVER scanned for exhaustion, even if its own JSON contains a "429"-looking token', async () => {
    process.env.FAKE_CLI_EXIT_CODE = '0';
    // Mirrors the real payload that caused the false positive: a successful
    // response whose usage stats happen to contain the substring "429".
    process.env.FAKE_CLI_STDOUT = '{"conversation_id":"x","status":"SUCCESS","response":"done","usage":{"input_tokens":1034296,"output_tokens":61}}';
    const result = await agyAdapter.run('do the thing', { cwd: workDir, timeoutMs: 5000, binaryOverride: FAKE_CLI });
    expect(result.exitCode).toBe(0);
    expect(result.likelyUsageExhausted).toBe(false);
  });

  it('uses the structured is_error/api_error_status field over text patterns on a real failure', async () => {
    process.env.FAKE_CLI_EXIT_CODE = '1';
    process.env.FAKE_CLI_STDOUT = '{"is_error":true,"api_error_status":429,"result":"unrelated wording that would not match any text pattern"}';
    const result = await agyAdapter.run('do the thing', { cwd: workDir, timeoutMs: 5000, binaryOverride: FAKE_CLI });
    expect(result.likelyUsageExhausted).toBe(true);
  });
});

describe('codexAdapter (fake CLI)', () => {
  it('reads the -o output file when present, preferring it over raw stdout', async () => {
    process.env.FAKE_CLI_EXIT_CODE = '0';
    process.env.FAKE_CLI_STDOUT = 'raw stdout noise';
    process.env.FAKE_CLI_OUTPUT_FILE_CONTENT = 'the real last message';
    const logFile = path.join(workDir, 'invocation.log');
    const result = await codexAdapter.run('do the thing', { cwd: workDir, timeoutMs: 5000, logFile, binaryOverride: FAKE_CLI });
    expect(result.stdout.trim()).toBe('the real last message');
    expect(result.outputFile).toBe(`${logFile}.last-message.txt`);
  });

  it('falls back to raw stdout when no output file is produced', async () => {
    process.env.FAKE_CLI_EXIT_CODE = '0';
    process.env.FAKE_CLI_STDOUT = 'raw stdout only';
    const result = await codexAdapter.run('do the thing', { cwd: workDir, timeoutMs: 5000, binaryOverride: FAKE_CLI });
    expect(result.stdout).toContain('raw stdout only');
  });

  it('REGRESSION (first overnight run): a successful exit quoting BOARDROOM.md-style exhaustion wording is NOT flagged', async () => {
    process.env.FAKE_CLI_EXIT_CODE = '0';
    // Mirrors the real transcript: Astra's own audit doc quoted BOARDROOM.md's
    // own documentation of the exhaustion patterns almost verbatim, while
    // completing its task successfully.
    process.env.FAKE_CLI_STDOUT =
      'pattern-matches known phrasing ("usage limit", "rate limit", "quota exceeded", "weekly limit", "429", ...). Recommendation: Upstash Redis (Rate Limiting) for the leaderboard cache.';
    const result = await codexAdapter.run('audit the repo', { cwd: workDir, timeoutMs: 5000, binaryOverride: FAKE_CLI });
    expect(result.exitCode).toBe(0);
    expect(result.likelyUsageExhausted).toBe(false);
    expect(result.confidence).toBe('HIGH_CONFIDENCE');
  });
});

describe('timeout enforcement (shared runner.ts)', () => {
  it(
    'marks a hung invocation as timedOut and still resolves',
    async () => {
      process.env.FAKE_CLI_SLEEP_MS = '5000';
      const result = await claudeAdapter.run('hang forever', { cwd: workDir, timeoutMs: 300, binaryOverride: FAKE_CLI });
      expect(result.timedOut).toBe(true);
    },
    10_000
  );
});

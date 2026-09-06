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
import { looksLikeUsageExhaustion } from '../lib/boardroom/adapters/exhaustionPatterns';

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
  });

  it('does not match ordinary output', () => {
    expect(looksLikeUsageExhaustion('Applied 3 edits successfully.')).toBe(false);
    expect(looksLikeUsageExhaustion('')).toBe(false);
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

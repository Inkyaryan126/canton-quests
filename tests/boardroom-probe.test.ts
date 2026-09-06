// Canton Quests Boardroom V2 — cheap health-probe tests.
//
// Reproduces the exact shape of the first overnight run's Claude false
// positive: a real 429 on the actual task ("You've hit your session limit"),
// immediately followed by a manual `claude -p "Reply with exactly: OK"` that
// succeeded — proving the underlying agent was NOT actually unavailable.
// probeAgentHealth() is the mechanism that catches this before Boardroom
// exiles an agent on a single sample.

import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { probeAgentHealth, PROBE_PROMPT } from '../lib/boardroom/adapters/probe';
import { claudeAdapter } from '../lib/boardroom/adapters/claudeAdapter';
import { agyAdapter } from '../lib/boardroom/adapters/agyAdapter';

const FAKE_CLI = path.resolve(__dirname, 'fixtures', 'fake-cli.sh');

let workDir: string;

beforeEach(() => {
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boardroom-probe-'));
  for (const key of ['FAKE_CLI_EXIT_CODE', 'FAKE_CLI_STDOUT', 'FAKE_CLI_STDERR', 'FAKE_CLI_COUNTER_FILE', 'FAKE_CLI_FAIL_FIRST_N']) {
    delete process.env[key];
  }
});

afterEach(() => {
  fs.rmSync(workDir, { recursive: true, force: true });
});

describe('probeAgentHealth', () => {
  it('reports unhealthy when the probe itself still shows a genuine exhaustion signal', async () => {
    process.env.FAKE_CLI_EXIT_CODE = '1';
    process.env.FAKE_CLI_STDOUT = '{"is_error":true,"api_error_status":429,"result":"still exhausted"}';
    const outcome = await probeAgentHealth(claudeAdapter, { cwd: workDir, timeoutMs: 5000, binaryOverride: FAKE_CLI });
    expect(outcome.healthy).toBe(false);
    expect(outcome.result.likelyUsageExhausted).toBe(true);
  });

  it('reports healthy when the probe succeeds cleanly', async () => {
    process.env.FAKE_CLI_EXIT_CODE = '0';
    process.env.FAKE_CLI_STDOUT = 'OK';
    const outcome = await probeAgentHealth(claudeAdapter, { cwd: workDir, timeoutMs: 5000, binaryOverride: FAKE_CLI });
    expect(outcome.healthy).toBe(true);
  });

  it('sends the exact trivial, cheap probe prompt, not the original task prompt', async () => {
    process.env.FAKE_CLI_EXIT_CODE = '0';
    const capturedArgsFile = path.join(workDir, 'captured-args.txt');
    // A tiny wrapper that records argv, then delegates to the real fixture.
    const wrapper = path.join(workDir, 'capture-wrapper.sh');
    fs.writeFileSync(wrapper, `#!/bin/sh\nprintf '%s\\n' "$@" > ${JSON.stringify(capturedArgsFile)}\nexec ${JSON.stringify(FAKE_CLI)} "$@"\n`, { mode: 0o755 });

    await probeAgentHealth(claudeAdapter, { cwd: workDir, timeoutMs: 5000, binaryOverride: wrapper });
    const capturedArgs = fs.readFileSync(capturedArgsFile, 'utf8');
    expect(capturedArgs).toContain(PROBE_PROMPT);
  });

  it('REPRODUCES the first overnight run false positive: a real 429 on the task, followed by a healthy probe, exactly like the manual claude -p "OK" test that followed it', async () => {
    // Step 1: the actual task invocation hits a genuine (if short-lived) 429 —
    // this is real evidence, not itself a bug.
    process.env.FAKE_CLI_EXIT_CODE = '1';
    process.env.FAKE_CLI_STDOUT = '{"is_error":true,"api_error_status":429,"result":"You\'ve hit your session limit · resets 4:40am (America/New_York)"}';
    const taskResult = await claudeAdapter.run('do the real task', { cwd: workDir, timeoutMs: 5000, binaryOverride: FAKE_CLI });
    expect(taskResult.likelyUsageExhausted).toBe(true); // detection itself is correct — this really was a 429

    // Step 2: Boardroom's probe (mirroring Dustin's manual `claude -p "Reply
    // with exactly: OK"` test) runs immediately afterward and succeeds,
    // because the constraint had already cleared.
    delete process.env.FAKE_CLI_EXIT_CODE;
    delete process.env.FAKE_CLI_STDOUT;
    process.env.FAKE_CLI_EXIT_CODE = '0';
    process.env.FAKE_CLI_STDOUT = 'OK';
    const probe = await probeAgentHealth(claudeAdapter, { cwd: workDir, timeoutMs: 5000, binaryOverride: FAKE_CLI });

    // The correct behavior: do NOT treat Claude as unavailable for the rest
    // of the run — the probe proves it's healthy right now.
    expect(probe.healthy).toBe(true);
  });

  it('a genuinely still-exhausted agent (probe also fails) is correctly NOT reported healthy', async () => {
    process.env.FAKE_CLI_COUNTER_FILE = path.join(workDir, 'counter');
    process.env.FAKE_CLI_FAIL_FIRST_N = '5'; // both the task call and the probe stay within the failure window
    process.env.FAKE_CLI_EXIT_CODE = '1';
    process.env.FAKE_CLI_STDOUT = '{"is_error":true,"api_error_status":429,"result":"still exhausted"}';

    await agyAdapter.run('do the real task', { cwd: workDir, timeoutMs: 5000, binaryOverride: FAKE_CLI }); // invocation 1
    const probe = await probeAgentHealth(agyAdapter, { cwd: workDir, timeoutMs: 5000, binaryOverride: FAKE_CLI }); // invocation 2, still within the failure window
    expect(probe.healthy).toBe(false);
  });
});

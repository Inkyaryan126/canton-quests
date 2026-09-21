import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import {
  collectGridBuilderCliHealth,
  deriveBuilderWorkerState,
  evaluateBuilderStartGuard,
  formatGridBuilderCliFailureDetail,
  gridBuilderLaunchTokenFile,
  gridBuilderProcessProbeErrorMeansAlive,
  humanizeBuilderOwner,
  isLocalBuilderHostname,
  issueGridBuilderLaunchToken,
  consumeGridBuilderLaunchToken,
  isGridBuilderSteadyState,
  readGridBuilderCliHealthRunState,
  readGridBuilderRunState,
  resolveGridBuilderIntegrationRef,
  resolvePreferredCliBinary,
  summarizeGridV1Progress,
  summarizeMilestoneProgress,
  writeGridBuilderCliHealthCache,
  writeGridBuilderCliHealthRunState,
  writeGridBuilderRunState,
} from '../lib/grid/ops/grid-builder-os';
import { resolvePreferredLocalNodeBinary } from '../lib/grid/ops/local-toolchain';

const builderClientSource = fs.readFileSync(path.join(process.cwd(), 'app/admin/grid-builder/grid-builder-client.tsx'), 'utf8');
const builderStylesSource = fs.readFileSync(path.join(process.cwd(), 'app/admin/grid-builder/grid-builder.css'), 'utf8');
const dockLaunchRouteSource = fs.readFileSync(path.join(process.cwd(), 'app/api/admin/grid-builder/launch/route.ts'), 'utf8');
const builderRunnerSource = fs.readFileSync(path.join(process.cwd(), 'scripts/grid-builder-os-runner.ts'), 'utf8');
const builderOsSource = fs.readFileSync(path.join(process.cwd(), 'lib/grid/ops/grid-builder-os.ts'), 'utf8');

const tempDirs: string[] = [];

function makeRepo(): string {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'grid-builder-os-'));
  tempDirs.push(cwd);
  execFileSync('git', ['init', '-q'], { cwd });
  execFileSync('git', ['config', 'user.email', 'grid@example.test'], { cwd });
  execFileSync('git', ['config', 'user.name', 'Grid Test'], { cwd });
  fs.writeFileSync(path.join(cwd, 'README.md'), 'grid\n');
  execFileSync('git', ['add', 'README.md'], { cwd });
  execFileSync('git', ['commit', '-qm', 'initial'], { cwd });
  return cwd;
}

afterEach(() => {
  while (tempDirs.length) {
    const dir = tempDirs.pop();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('Grid Builder OS helpers', () => {
  it('maps Claude authentication failures to a safe sign-in action', () => {
    for (const failure of ['Failed to authenticate', 'OAuth session expired', 'Claude auth failure']) {
      expect(formatGridBuilderCliFailureDetail(
        'claude',
        '',
        failure,
        1,
      )).toBe('Claude sign-in expired. Run claude auth login in Terminal.');
    }
  });

  it('treats EPERM process probes as evidence that the process still exists', () => {
    expect(gridBuilderProcessProbeErrorMeansAlive(Object.assign(new Error('not permitted'), { code: 'EPERM' }))).toBe(true);
    expect(gridBuilderProcessProbeErrorMeansAlive(Object.assign(new Error('missing'), { code: 'ESRCH' }))).toBe(false);
    expect(gridBuilderProcessProbeErrorMeansAlive(new Error('unknown'))).toBe(false);
  });

  it('maps Codex version failures to an upgrade action', () => {
    expect(formatGridBuilderCliFailureDetail(
      'codex',
      'requires a newer version of Codex CLI',
      '',
      1,
    )).toBe('Codex CLI needs an upgrade. Upgrade Codex CLI, then rerun crew health.');
  });

  it('maps credit, quota, and payment failures to an account action', () => {
    expect(formatGridBuilderCliFailureDetail(
      'gemini',
      '',
      'resource-exhausted: quota exceeded; payment required',
      1,
    )).toBe('Account credits or quota are unavailable. Check account billing or quota, then rerun crew health.');
  });

  it('uses a safe worker-specific fallback without leaking raw failure text', () => {
    const rawFailure = 'token=sk-secret /Users/inky/project/request-id-123 raw payload {"secret":"value"}';
    const detail = formatGridBuilderCliFailureDetail('gemini', rawFailure, '', 7);

    expect(detail).toBe('Gemini health probe failed (exit code 7). Check the CLI and rerun crew health.');
    expect(detail).not.toContain(rawFailure);
    expect(detail).not.toContain('/Users/');
    expect(detail).not.toContain('sk-secret');
    expect(detail).not.toContain('request-id-123');
  });

  it('uses the approved Empire Panel art as a live-data shell without fake placeholder values', () => {
    expect(builderClientSource).toContain('cq-builder-command-center');
    expect(builderClientSource).toContain('/grid/boss-panel/empire-panel-approved.png');
    expect(builderClientSource).toContain("import Image from 'next/image'");
    expect(builderClientSource).toContain('<Image');
    expect(builderClientSource).toContain('unoptimized');
    expect(builderClientSource).toContain('aria-label="Build the Grid"');
    expect(builderClientSource).toContain("'/api/admin/grid-builder/status'");
    expect(builderClientSource).toContain("'/api/admin/grid-builder/action'");
    expect(builderClientSource).toContain("action: 'refresh-health'");
    expect(builderClientSource).toContain('cq-art-grid-status');
    expect(builderClientSource).toContain('snapshot.overall.remaining');
    expect(builderClientSource).toContain('V1 features remaining');
    expect(builderClientSource).toContain('cq-art-lanes');
    expect(builderClientSource).not.toContain('{{');
    expect(builderStylesSource).toContain('.cq-artboard');
    expect(builderStylesSource).toContain('.cq-art-build-hotspot');
  });

  it('blocks false-success no-op cycles and falls back beyond Product Director', () => {
    expect(builderRunnerSource).toContain('incomplete Canonical V1 Completion Board features');
    expect(builderRunnerSource).toContain('Master Board only for integration cleanup');
    expect(builderRunnerSource).toContain('explicitly documented unfinished work');
    expect(builderRunnerSource).toContain('NO-OP BLOCKED');
    expect(builderRunnerSource).toContain('progressFingerprint');
    expect(builderRunnerSource).toContain('evidenceFingerprint');
    expect(builderRunnerSource).toContain("'grid-agent-control',\n    'evidence'");
    expect(builderRunnerSource).toContain('archiveBuilderLog');
    expect(builderRunnerSource).toContain('resolveGitCommonDir');
    expect(builderRunnerSource).toContain("'--add-dir', gitCommonDir");
    expect(builderRunnerSource).not.toContain("'--add-dir', cwd");
    expect(builderRunnerSource).toContain('Build cycle made no observable repo, claim, or verification-evidence progress');
  });

  it('pins exact supervisor control-plane commands and keeps live health out of the sandbox', () => {
    expect(builderRunnerSource).toContain('CONTROL PLANE COMMANDS — use these exact commands');
    expect(builderRunnerSource).toContain('scripts/grid-completion-board.ts --json');
    expect(builderRunnerSource).toContain('Master Board (integration/history only)');
    expect(builderRunnerSource).toContain('scripts/grid-master-board.ts --json');
    expect(builderRunnerSource).toContain('scripts/grid-product-director.ts --json');
    expect(builderRunnerSource).toContain('scripts/grid-playable-loop-score.ts --json');
    expect(builderRunnerSource).toContain('scripts/grid-prioritize.ts --json');
    expect(builderRunnerSource).toContain('scripts/grid-builder-os.ts status --json');
    expect(builderRunnerSource).toContain('Browser evidence refresh is parent-runner owned');
    expect(builderRunnerSource).toContain('Migration safety refresh is parent-runner owned');
    expect(builderRunnerSource).toContain('scripts/grid-release-candidate.ts --json');
    expect(builderRunnerSource).toContain('Do NOT run scripts/grid-builder-os-health.ts from the supervisor sandbox');
    expect(builderRunnerSource).toContain('Do NOT use raw `kill -0`, sandbox-local `ps`');
    expect(builderRunnerSource).toContain('Sandbox EPERM can mean the process exists but cannot be signaled');
    expect(builderRunnerSource).toContain('Cached crew health is advisory only');
    expect(builderRunnerSource).not.toContain('npm run grid:product-director');
    expect(builderRunnerSource).not.toContain('scripts/grid-task-prioritizer.ts');
  });

  it('refreshes required release evidence in the parent runner and fails closed', () => {
    expect(builderRunnerSource).toContain('function refreshRequiredEvidence');
    expect(builderRunnerSource).toContain('resolvePreferredLocalNodeBinary');
    expect(builderRunnerSource).toContain("id: 'completion-board-tests'");
    expect(builderRunnerSource).toContain("filename: 'completion-board-tests.json'");
    expect(builderRunnerSource).toContain("args: ['--verify-tests', '--json']");
    expect(builderRunnerSource).toContain('blocking: false');
    expect(builderRunnerSource).toContain('Non-blocking product evidence is not green yet');
    expect(builderRunnerSource).toContain("id: 'browser-runtime'");
    expect(builderRunnerSource).toContain("id: 'migration-safety'");
    expect(builderRunnerSource).toContain('Parent evidence refresh passed');
    expect(builderRunnerSource).toContain('Browser evidence refresh is parent-runner owned');
    expect(builderRunnerSource).toContain('Migration safety refresh is parent-runner owned');
    expect(builderRunnerSource).toContain('const evidenceHealthy = evidenceRefresh.failures.length === 0');
    expect(builderRunnerSource).toContain('Required local verification evidence failed');
    expect(builderRunnerSource).not.toContain(
      '- Browser evidence refresh: node ./node_modules/vite-node/vite-node.mjs scripts/grid-browser-runtime.ts --record --json',
    );
  });

  it('runs Codex, Claude, and Gemini as distinct refillable worker slots', () => {
    expect(builderRunnerSource).toContain('You are the crew scheduler AND the Codex worker slot');
    expect(builderRunnerSource).toContain('repeated worker waves, not a single-task handoff');
    expect(builderRunnerSource).toContain("const slots: CrewSlot[] = ['codex', 'claude', 'gemini']");
    expect(builderRunnerSource).toContain('seen.has(item.id)');
    expect(builderRunnerSource).toContain('distinct.slice(0, slots.length)');
    expect(builderRunnerSource).toContain('Parent crew wave:');
    expect(builderRunnerSource).toContain('supervisorPrompt(crewAssignments)');
    expect(builderRunnerSource).toContain('PARENT PREASSIGNED FIRST WAVE');
    expect(builderRunnerSource).toContain('THREE-SLOT CREW SCHEDULER — this is the primary execution model');
    expect(builderRunnerSource).toContain('Codex, Claude, and Gemini are three independent worker slots');
    expect(builderRunnerSource).toContain('They are NOT fallback workers for the same task');
    expect(builderRunnerSource).toContain('Select up to three DISTINCT tasks at a time');
    expect(builderRunnerSource).toContain('overlapping file scope to more than one worker slot');
    expect(builderRunnerSource).toContain('Control Tower startup reservations and isolated worktrees sequentially BEFORE starting concurrent worker execution');
    expect(builderRunnerSource).toContain('A reservation is NOT an active worker');
    expect(builderRunnerSource).toContain('automatically reaped after two minutes');
    expect(builderRunnerSource).toContain('activate each reservation with that live PID');
    expect(builderRunnerSource).toContain('Codex slot: the current Codex lead works one claimed task itself');
    expect(builderRunnerSource).toContain('Claude slot: launch Claude non-interactively in its own claimed worktree on a different task');
    expect(builderRunnerSource).toContain('Claude implementation launch template');
    expect(builderRunnerSource).toContain('claude -p --permission-mode acceptEdits --output-format text');
    expect(builderRunnerSource).toContain('Gemini slot: launch Gemini non-interactively in its own claimed worktree on a third different task');
    expect(builderRunnerSource).toContain('gemini --skip-trust --approval-mode yolo --output-format text --prompt');
    expect(builderRunnerSource).toContain('capture each PID/log separately');
    expect(builderRunnerSource).toContain('Do not wait for one worker to finish before starting the others');
    expect(builderRunnerSource).toContain('IMMEDIATELY refill that same CLI slot');
    expect(builderRunnerSource).toContain('Repeat worker waves until there is no safe documented work left');
    expect(builderRunnerSource).toContain('Do NOT collapse its task onto Codex just to simulate three workers');
    expect(builderRunnerSource).toContain('run the existing local-only verifier directly with its `--record --json` mode');
    expect(builderRunnerSource).toContain('refresh commit-bound shared verification evidence');
    expect(builderOsSource).toContain("claimLifecycleState(claim) === 'active'");
    expect(builderOsSource).toContain('reapAbandonedReservations(cwd)');
  });

  it('recognizes only a fully complete, action-free Grid snapshot as steady state', () => {
    const base: Parameters<typeof isGridBuilderSteadyState>[0] = {
      overall: {
        completed: 53,
        remaining: 0,
        inProgress: 0,
        needsVerification: 0,
        partial: 0,
        missing: 0,
        blocked: 0,
        readyToCombine: 0,
        total: 53,
        percent: 100,
      },
      playableLoop: { score: 100, status: 'GREEN', brokenLink: null, nextRepair: null },
      workers: [],
      recommendations: [],
    };

    expect(isGridBuilderSteadyState(base)).toBe(true);
    expect(isGridBuilderSteadyState({
      ...base,
      overall: { ...base.overall, readyToCombine: 1 },
    })).toBe(false);
    expect(isGridBuilderSteadyState({
      ...base,
      recommendations: [{ id: 'next', title: 'Next', action: 'Build next', whyNow: 'needed', specialization: 'general' }],
    })).toBe(false);
    expect(isGridBuilderSteadyState({
      ...base,
      workers: [{ lane: 'lane', role: 'Lead Builder', state: 'working', task: 'task', lastUpdate: 'now', dirtyFiles: 0, activeProcesses: 1 }],
    })).toBe(false);
    expect(isGridBuilderSteadyState({
      ...base,
      playableLoop: { ...base.playableLoop, status: 'YELLOW' },
    })).toBe(false);
    expect(isGridBuilderSteadyState({
      ...base,
      overall: { ...base.overall, completed: 26, percent: 96 },
    })).toBe(false);
  });

  it('requires current full release-gate proof before a no-change cycle can finish steady', () => {
    expect(builderRunnerSource).toContain('currentFullReleaseGatePass');
    expect(builderRunnerSource).toContain("readSharedEvidence(cwd, 'release-gate.json')");
    expect(builderRunnerSource).toContain("evidence.buildIncluded === true");
    expect(builderRunnerSource).toContain('STEADY STATE: canonical Grid work and current-commit local release evidence are already complete');
    expect(builderRunnerSource).toContain('steadyStateHealthy');
    expect(builderRunnerSource).toContain('progressChanged || steadyStateHealthy');
    expect(builderRunnerSource).toContain("steady=${steadyStateHealthy ? 'yes' : 'no'}");
  });

  it('uses canonical V1 feature completion for Boss Panel progress', () => {
    expect(summarizeGridV1Progress({
      complete: 40,
      remaining: 13,
      inProgress: 2,
      needsVerification: 4,
      partial: 3,
      missing: 1,
      blocked: 3,
      total: 53,
      percent: 75,
    }, 2)).toEqual({
      completed: 40,
      remaining: 13,
      inProgress: 2,
      needsVerification: 4,
      partial: 3,
      missing: 1,
      blocked: 3,
      readyToCombine: 2,
      total: 53,
      percent: 75,
    });
  });

  it('counts only integrated milestones as integration progress', () => {
    expect(summarizeMilestoneProgress([
      'INTEGRATED',
      'INTEGRATED',
      'READY_TO_INTEGRATE',
      'IN_PROGRESS',
    ])).toEqual({
      completed: 2,
      readyToCombine: 1,
      total: 4,
      percent: 50,
    });
  });

  it('turns owner and worker evidence into plain-language states', () => {
    expect(humanizeBuilderOwner('codex-map')).toBe('Lead Builder');
    expect(humanizeBuilderOwner('claude-qa')).toBe('Engineer');
    expect(humanizeBuilderOwner('gemini-ui')).toBe('Fast Builder');
    expect(humanizeBuilderOwner('agy-ui')).toBe('Fast Builder');
    expect(deriveBuilderWorkerState({ stale: false, activeProcesses: 1, dirtyFiles: 0 })).toBe('working');
    expect(deriveBuilderWorkerState({ stale: false, activeProcesses: 0, dirtyFiles: 0 })).toBe('checkpoint');
    expect(deriveBuilderWorkerState({ stale: true, activeProcesses: 0, dirtyFiles: 0 })).toBe('needs_attention');
  });

  it('allows agent starts only from a clean local development control plane', () => {
    expect(isLocalBuilderHostname('localhost')).toBe(true);
    expect(isLocalBuilderHostname('127.0.0.1')).toBe(true);
    expect(isLocalBuilderHostname('example.com')).toBe(false);

    const idle = { version: 1 as const, runId: 'none', status: 'idle' as const, message: 'ready' };
    expect(evaluateBuilderStartGuard({
      hostname: 'localhost',
      nodeEnv: 'development',
      issues: [],
      run: idle,
    }).canStart).toBe(true);

    expect(evaluateBuilderStartGuard({
      hostname: 'example.com',
      nodeEnv: 'production',
      issues: [{ code: 'STALE_CLAIM', message: 'stale' }],
      run: { ...idle, status: 'working' },
    }).reasons).toHaveLength(4);
  });

  it('issues a short-lived single-use Dock launch token without storing the raw token', () => {
    const cwd = makeRepo();
    const token = issueGridBuilderLaunchToken(cwd, {
      token: 'dock-token-1234567890',
      now: new Date('2026-09-20T04:00:00.000Z'),
      ttlMs: 120_000,
    });
    const tokenFile = fs.readFileSync(gridBuilderLaunchTokenFile(cwd), 'utf8');

    expect(token).toBe('dock-token-1234567890');
    expect(tokenFile).not.toContain(token);
    expect(consumeGridBuilderLaunchToken('wrong-token', cwd, new Date('2026-09-20T04:00:30.000Z'))).toBe(false);
    expect(consumeGridBuilderLaunchToken(token, cwd, new Date('2026-09-20T04:00:30.000Z'))).toBe(true);
    expect(consumeGridBuilderLaunchToken(token, cwd, new Date('2026-09-20T04:00:31.000Z'))).toBe(false);
  });

  it('keeps Dock auto-auth local, development-only, and one-time-token gated', () => {
    expect(dockLaunchRouteSource).toContain("process.env.NODE_ENV === 'production'");
    expect(dockLaunchRouteSource).toContain('isLocalBuilderHostname');
    expect(dockLaunchRouteSource).toContain('consumeGridBuilderLaunchToken');
    expect(dockLaunchRouteSource).toContain("url.searchParams.get('token')");
    expect(dockLaunchRouteSource).not.toContain("url.searchParams.get('passphrase')");
  });

  it('stores runner state in git-common coordination storage', () => {
    const cwd = makeRepo();
    writeGridBuilderRunState({
      version: 1,
      runId: 'abc123',
      status: 'finished',
      message: 'done',
      exitCode: 0,
    }, cwd);
    expect(readGridBuilderRunState(cwd)).toMatchObject({
      runId: 'abc123',
      status: 'finished',
      message: 'done',
    });
  });

  it('stores crew-health run state in git-common coordination storage', () => {
    const cwd = makeRepo();
    writeGridBuilderCliHealthRunState({
      version: 1,
      runId: 'health123',
      status: 'finished',
      startedAt: '2026-09-19T11:00:00.000Z',
      endedAt: '2026-09-19T11:00:03.000Z',
      message: 'Codex, Claude, and Gemini are ready.',
    }, cwd);
    expect(readGridBuilderCliHealthRunState(cwd)).toMatchObject({
      runId: 'health123',
      status: 'finished',
      message: 'Codex, Claude, and Gemini are ready.',
    });
  });

  it('prefers the newest NVM CLI over a stale PATH copy', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'grid-builder-home-'));
    tempDirs.push(home);
    const oldBin = path.join(home, 'old-bin');
    const newBin = path.join(home, '.nvm', 'versions', 'node', 'v24.19.0', 'bin');
    fs.mkdirSync(oldBin, { recursive: true });
    fs.mkdirSync(newBin, { recursive: true });
    const stale = path.join(oldBin, 'gemini');
    const preferred = path.join(newBin, 'gemini');
    fs.writeFileSync(stale, '#!/bin/sh\necho stale\n');
    fs.writeFileSync(preferred, '#!/bin/sh\necho preferred\n');
    fs.chmodSync(stale, 0o755);
    fs.chmodSync(preferred, 0o755);

    expect(resolvePreferredCliBinary('gemini', {
      homeDir: home,
      pathEnv: oldBin,
      env: { NODE_ENV: 'test' },
    })).toBe(preferred);
  });

  it('prefers the newest NVM Node over stale PATH and current-process Node', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'grid-runtime-home-'));
    tempDirs.push(home);
    const oldBin = path.join(home, 'old-bin');
    const newBin = path.join(home, '.nvm', 'versions', 'node', 'v24.19.0', 'bin');
    fs.mkdirSync(oldBin, { recursive: true });
    fs.mkdirSync(newBin, { recursive: true });
    const stale = path.join(oldBin, 'node');
    const preferred = path.join(newBin, 'node');
    fs.writeFileSync(stale, '#!/bin/sh\necho stale\n');
    fs.writeFileSync(preferred, '#!/bin/sh\necho preferred\n');
    fs.chmodSync(stale, 0o755);
    fs.chmodSync(preferred, 0o755);

    expect(resolvePreferredLocalNodeBinary({
      homeDir: home,
      pathEnv: oldBin,
      env: { PATH: oldBin, NODE_ENV: 'test' },
      currentExecPath: stale,
    })).toBe(preferred);
  });

  it('surfaces cached live CLI health without exposing binary paths', () => {
    const cwd = makeRepo();
    writeGridBuilderCliHealthCache({
      version: 1,
      checkedAt: '2026-09-19T11:00:00.000Z',
      entries: {
        codex: { status: 'ready', version: '0.154.0', detail: 'Live model probe passed.' },
        claude: { status: 'ready', version: '2.1.240', detail: 'Live model probe passed.' },
        gemini: { status: 'ready', version: '0.57.0', detail: 'Live model probe passed.' },
      },
    }, cwd);

    const health = collectGridBuilderCliHealth(cwd);
    expect(health.map((item) => item.status)).toEqual(['ready', 'ready', 'ready']);
    expect(JSON.stringify(health)).not.toContain('/Users/');
  });

  it('prefers the canonical integration branch when present', () => {
    const cwd = makeRepo();
    execFileSync('git', ['branch', 'grid-canonical-integration-20260918'], { cwd });
    execFileSync('git', ['branch', 'grid-canonical-integration-20260919'], { cwd });
    expect(resolveGridBuilderIntegrationRef(cwd)).toBe('grid-canonical-integration-20260919');
  });
});

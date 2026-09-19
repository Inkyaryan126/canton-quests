import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import {
  collectGridBuilderCliHealth,
  deriveBuilderWorkerState,
  evaluateBuilderStartGuard,
  humanizeBuilderOwner,
  isLocalBuilderHostname,
  readGridBuilderRunState,
  resolveGridBuilderIntegrationRef,
  resolvePreferredCliBinary,
  summarizeMilestoneProgress,
  writeGridBuilderCliHealthCache,
  writeGridBuilderRunState,
} from '../lib/grid/ops/grid-builder-os';

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
  it('counts only integrated milestones as completed progress', () => {
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

  it('prefers the newest NVM CLI over a stale PATH copy', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'grid-builder-home-'));
    tempDirs.push(home);
    const oldBin = path.join(home, 'old-bin');
    const newBin = path.join(home, '.nvm', 'versions', 'node', 'v24.19.0', 'bin');
    fs.mkdirSync(oldBin, { recursive: true });
    fs.mkdirSync(newBin, { recursive: true });
    const stale = path.join(oldBin, 'codex');
    const preferred = path.join(newBin, 'codex');
    fs.writeFileSync(stale, '#!/bin/sh\necho stale\n');
    fs.writeFileSync(preferred, '#!/bin/sh\necho preferred\n');
    fs.chmodSync(stale, 0o755);
    fs.chmodSync(preferred, 0o755);

    expect(resolvePreferredCliBinary('codex', {
      homeDir: home,
      pathEnv: oldBin,
      env: { NODE_ENV: 'test' },
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
        agy: { status: 'ready', version: '1.2.7', detail: 'Live model probe passed.' },
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


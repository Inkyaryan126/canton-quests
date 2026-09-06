// Canton Quests Boardroom V2 — crash-safe marker + sleep-prevention tests.

import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { checkAndRecoverMarker, writeMarker, getMarker, clearMarker, registerCleanupHandlers, startSleepPrevention } from '../lib/boardroom/runLifecycle';
import { autonomousRunMarkerFile } from '../lib/boardroom/paths';

let root: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'boardroom-lifecycle-'));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('marker lifecycle', () => {
  it('checkAndRecoverMarker reports NONE when no marker exists', () => {
    expect(checkAndRecoverMarker(root)).toEqual({ status: 'NONE', marker: null });
  });

  it('writeMarker then checkAndRecoverMarker reports ALIVE for the current (live) process', () => {
    writeMarker({ pid: process.pid, branch: 'boardroom/astra-overnight-x', runId: 'x' }, root);
    const result = checkAndRecoverMarker(root);
    expect(result.status).toBe('ALIVE');
    expect(result.marker?.pid).toBe(process.pid);
  });

  it('a marker left by a dead PID is recovered (removed) rather than blocking forever', () => {
    writeMarker({ pid: 999_999, branch: 'boardroom/astra-overnight-crashed', runId: 'crashed' }, root);
    const result = checkAndRecoverMarker(root);
    expect(result.status).toBe('STALE_RECOVERED');
    expect(fs.existsSync(autonomousRunMarkerFile(root))).toBe(false);
    // A second call now reports NONE — the stale marker was actually deleted, not just reported.
    expect(checkAndRecoverMarker(root).status).toBe('NONE');
  });

  it('clearMarker removes an existing marker and is a no-op otherwise', () => {
    writeMarker({ branch: 'b', runId: 'r' }, root);
    clearMarker(root);
    expect(getMarker(root)).toBeNull();
    expect(() => clearMarker(root)).not.toThrow();
  });

  it('writeMarker defaults pid to the current process', () => {
    const marker = writeMarker({ branch: 'b', runId: 'r' }, root);
    expect(marker.pid).toBe(process.pid);
  });
});

describe('registerCleanupHandlers', () => {
  it('registers exit/SIGINT/SIGTERM/uncaughtException/unhandledRejection listeners', () => {
    const before = {
      exit: process.listenerCount('exit'),
      SIGINT: process.listenerCount('SIGINT'),
      SIGTERM: process.listenerCount('SIGTERM'),
      uncaughtException: process.listenerCount('uncaughtException'),
      unhandledRejection: process.listenerCount('unhandledRejection'),
    };
    registerCleanupHandlers(() => {});
    expect(process.listenerCount('exit')).toBe(before.exit + 1);
    expect(process.listenerCount('SIGINT')).toBe(before.SIGINT + 1);
    expect(process.listenerCount('SIGTERM')).toBe(before.SIGTERM + 1);
    expect(process.listenerCount('uncaughtException')).toBe(before.uncaughtException + 1);
    expect(process.listenerCount('unhandledRejection')).toBe(before.unhandledRejection + 1);
    // Clean up after ourselves so this test doesn't leak listeners into other test files.
    process.removeAllListeners('exit');
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('SIGTERM');
    process.removeAllListeners('uncaughtException');
    process.removeAllListeners('unhandledRejection');
  });

  it('the exit handler invokes cleanup exactly once even if fired multiple times', () => {
    let calls = 0;
    registerCleanupHandlers(() => {
      calls++;
    });
    const exitListeners = process.listeners('exit');
    const ours = exitListeners[exitListeners.length - 1] as (...args: any[]) => void;
    ours();
    ours();
    expect(calls).toBe(1);
    process.removeAllListeners('exit');
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('SIGTERM');
    process.removeAllListeners('uncaughtException');
    process.removeAllListeners('unhandledRejection');
  });
});

describe('startSleepPrevention', () => {
  it('reports NOT ACTIVE on a non-macOS platform', () => {
    if (process.platform === 'darwin') return; // this branch is only exercised on non-macOS CI
    const result = startSleepPrevention(process.pid);
    expect(result.active).toBe(false);
    expect(result.reason).toMatch(/not macOS/);
  });

  it('on macOS, reports ACTIVE with a real caffeinate child, or a clear NOT ACTIVE reason if caffeinate is missing', () => {
    if (process.platform !== 'darwin') return; // this branch is only exercised on macOS
    const result = startSleepPrevention(process.pid);
    expect(typeof result.active).toBe('boolean');
    expect(result.reason).toMatch(result.active ? /ACTIVE/ : /NOT ACTIVE/);
    result.child?.kill?.('SIGTERM');
  });
});

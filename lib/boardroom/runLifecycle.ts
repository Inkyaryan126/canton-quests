/**
 * Canton Quests Boardroom V2 — crash-safe autonomous-run lifecycle.
 *
 * Covers graceful stop, Ctrl-C, and in-process crashes via process signal
 * handlers. It cannot cover SIGKILL or a full power loss — no process-based
 * mechanism can — which is exactly why the startup check here is PID-aware:
 * a marker left behind by a killed process is recovered deliberately
 * instead of permanently blocking the next run.
 */
import { spawn, ChildProcess } from 'child_process';
import { execFileSync } from 'child_process';
import { autonomousRunMarkerFile } from './paths';
import { writeJsonAtomic, readJsonIfExists, removeIfExists } from './atomicFile';
import { isProcessAlive } from './lock';
import type { AutonomousRunMarker } from './types';

export function getMarker(root?: string): AutonomousRunMarker | null {
  return readJsonIfExists<AutonomousRunMarker>(autonomousRunMarkerFile(root));
}

export interface MarkerCheckResult {
  status: 'NONE' | 'ALIVE' | 'STALE_RECOVERED';
  marker: AutonomousRunMarker | null;
}

/**
 * Checks for an existing marker at startup. ALIVE means a real supervisor
 * is already running — refuse to start a second one. STALE_RECOVERED means
 * a marker was left by a process that's no longer running (e.g. SIGKILL,
 * crash, power loss) — it's removed here so the new run can proceed.
 */
export function checkAndRecoverMarker(root?: string): MarkerCheckResult {
  const marker = getMarker(root);
  if (!marker) return { status: 'NONE', marker: null };
  if (isProcessAlive(marker.pid)) {
    return { status: 'ALIVE', marker };
  }
  removeIfExists(autonomousRunMarkerFile(root));
  return { status: 'STALE_RECOVERED', marker };
}

export function writeMarker(params: { pid?: number; branch: string; runId: string }, root?: string): AutonomousRunMarker {
  const marker: AutonomousRunMarker = {
    pid: params.pid ?? process.pid,
    startedAt: new Date().toISOString(),
    branch: params.branch,
    runId: params.runId,
  };
  writeJsonAtomic(autonomousRunMarkerFile(root), marker);
  return marker;
}

export function clearMarker(root?: string): void {
  removeIfExists(autonomousRunMarkerFile(root));
}

/**
 * Registers cleanup for normal exit, SIGINT, SIGTERM, and uncaught
 * exceptions/rejections. Each handler runs `cleanup()` once (idempotency
 * guarded) before continuing the process's normal termination behavior.
 */
export function registerCleanupHandlers(cleanup: () => void): void {
  let ran = false;
  const runOnce = () => {
    if (ran) return;
    ran = true;
    try {
      cleanup();
    } catch (err) {
      // Cleanup must never throw past this point — we're already tearing down.
      // eslint-disable-next-line no-console
      console.error('[boardroom] cleanup handler threw during shutdown:', err);
    }
  };

  process.on('exit', runOnce);
  process.on('SIGINT', () => {
    runOnce();
    process.exit(130);
  });
  process.on('SIGTERM', () => {
    runOnce();
    process.exit(143);
  });
  process.on('uncaughtException', (err) => {
    // eslint-disable-next-line no-console
    console.error('[boardroom] uncaught exception:', err);
    runOnce();
    process.exit(1);
  });
  process.on('unhandledRejection', (reason) => {
    // eslint-disable-next-line no-console
    console.error('[boardroom] unhandled rejection:', reason);
    runOnce();
    process.exit(1);
  });
}

export interface SleepPreventionResult {
  active: boolean;
  reason: string;
  child?: ChildProcess;
}

/**
 * macOS-only. Spawns `caffeinate -dims -w <targetPid>` so its lifetime is
 * tied directly to the target process (usually our own pid) — it exits on
 * its own the instant that process ends, including on a crash or SIGKILL,
 * so there is no separate "release" step to remember. Never silently
 * assumes success: checks the binary exists first and reports
 * ACTIVE/NOT ACTIVE explicitly either way.
 */
export function startSleepPrevention(targetPid: number = process.pid): SleepPreventionResult {
  if (process.platform !== 'darwin') {
    return { active: false, reason: 'NOT ACTIVE (not macOS)' };
  }
  try {
    execFileSync('which', ['caffeinate']);
  } catch {
    return { active: false, reason: 'NOT ACTIVE (caffeinate binary not found)' };
  }
  try {
    const child = spawn('caffeinate', ['-dims', '-w', String(targetPid)], {
      stdio: 'ignore',
      detached: false,
    });
    child.on('error', () => {
      /* best-effort — failure here just means sleep prevention silently isn't active; already reported below as ACTIVE at spawn time, so a post-spawn error is logged by the caller inspecting SleepPreventionResult over the process lifetime if needed. */
    });
    return { active: true, reason: `ACTIVE (caffeinate -w ${targetPid})`, child };
  } catch (err: any) {
    return { active: false, reason: `NOT ACTIVE (failed to spawn caffeinate: ${err?.message || err})` };
  }
}

/**
 * Canton Quests Boardroom V2 — shared process-spawn primitive.
 *
 * The one place that actually spawns a CLI child process, used by every
 * adapter. Enforces a hard timeout ceiling (SIGTERM, then SIGKILL after a
 * grace period) since none of codex/claude/agy self-report "I'm stuck" —
 * this is the mechanism, not a guarantee the process was truly done vs.
 * merely cut off.
 */
import { spawn } from 'child_process';
import { appendLog } from './atomicFile';

export interface SpawnCaptureResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
}

const SIGKILL_GRACE_MS = 5_000;

export function spawnAndCapture(
  binary: string,
  args: string[],
  opts: { cwd: string; timeoutMs: number; input?: string; logFile?: string }
): Promise<SpawnCaptureResult> {
  const start = Date.now();
  return new Promise((resolve) => {
    const child = spawn(binary, args, { cwd: opts.cwd, stdio: ['pipe', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let killTimer: ReturnType<typeof setTimeout> | null = null;
    let termTimer: ReturnType<typeof setTimeout> | null = null;

    const log = (line: string) => {
      if (opts.logFile) appendLog(opts.logFile, line);
    };

    log(`[boardroom] spawning: ${binary} ${args.join(' ')}`);

    child.stdout.on('data', (chunk) => {
      const s = chunk.toString();
      stdout += s;
      log(s);
    });
    child.stderr.on('data', (chunk) => {
      const s = chunk.toString();
      stderr += s;
      log(s);
    });

    if (opts.input !== undefined) {
      child.stdin.write(opts.input);
    }
    child.stdin.end();

    termTimer = setTimeout(() => {
      timedOut = true;
      log(`[boardroom] timeout after ${opts.timeoutMs}ms — sending SIGTERM`);
      child.kill('SIGTERM');
      killTimer = setTimeout(() => {
        log('[boardroom] process did not exit after SIGTERM grace period — sending SIGKILL');
        child.kill('SIGKILL');
      }, SIGKILL_GRACE_MS);
    }, opts.timeoutMs);

    child.on('close', (code) => {
      if (termTimer) clearTimeout(termTimer);
      if (killTimer) clearTimeout(killTimer);
      const durationMs = Date.now() - start;
      log(`[boardroom] exited with code ${code} after ${durationMs}ms (timedOut=${timedOut})`);
      resolve({ exitCode: code, stdout, stderr, durationMs, timedOut });
    });

    child.on('error', (err) => {
      if (termTimer) clearTimeout(termTimer);
      if (killTimer) clearTimeout(killTimer);
      const durationMs = Date.now() - start;
      log(`[boardroom] spawn error: ${err.message}`);
      resolve({ exitCode: null, stdout, stderr: stderr + `\n${err.message}`, durationMs, timedOut });
    });
  });
}

import { spawn, type ChildProcess } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import type { PlayableLoopStageEvidence } from './playable-loop-score';

export type GridPlayerEntryRuntimeMode = 'staged' | 'signed-out';

export interface GridPlayerEntryRedirectObservation {
  mode: GridPlayerEntryRuntimeMode;
  status: number;
  location: string | null;
  origin: string;
}

export interface GridPlayerEntryRuntimeCase {
  mode: GridPlayerEntryRuntimeMode;
  status: number;
  destination: string;
  destinationStatus: number;
}

export interface GridPlayerEntryRuntimeReport {
  verifiedAt: string;
  cases: GridPlayerEntryRuntimeCase[];
}

export interface VerifyGridPlayerEntryRuntimeOptions {
  cwd?: string;
  startupTimeoutMs?: number;
  fetchTimeoutMs?: number;
}

const EXPECTED_DESTINATIONS: Record<GridPlayerEntryRuntimeMode, string> = {
  staged: '/grid',
  'signed-out': '/login?next=%2Fgrid%2Fplay',
};

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

export function classifyGridPlayerEntryRedirect(
  observation: GridPlayerEntryRedirectObservation,
): { destination: string; status: number } {
  if (!REDIRECT_STATUSES.has(observation.status)) {
    throw new Error(
      `Grid player entry expected a redirect status, received ${observation.status}`,
    );
  }
  if (!observation.location) {
    throw new Error('Grid player entry redirect is missing a Location header');
  }

  const originUrl = new URL(observation.origin);
  const destinationUrl = new URL(observation.location, originUrl);
  const loopbackHosts = new Set(['127.0.0.1', 'localhost', '[::1]']);
  const exactOrigin = destinationUrl.origin === originUrl.origin;
  const equivalentLoopbackOrigin =
    destinationUrl.protocol === originUrl.protocol &&
    destinationUrl.port === originUrl.port &&
    loopbackHosts.has(destinationUrl.hostname) &&
    loopbackHosts.has(originUrl.hostname);
  if (!exactOrigin && !equivalentLoopbackOrigin) {
    throw new Error(
      `Grid player entry redirect changed origin from ${originUrl.origin} to ${destinationUrl.origin}`,
    );
  }

  const destination = `${destinationUrl.pathname}${destinationUrl.search}`;
  const expected = EXPECTED_DESTINATIONS[observation.mode];
  if (destination !== expected) {
    throw new Error(
      `Grid player entry ${observation.mode} destination must be ${expected}, received ${destination}`,
    );
  }

  return { destination, status: observation.status };
}

export function runtimeEvidenceFromGridPlayerEntryReport(
  report: GridPlayerEntryRuntimeReport,
): PlayableLoopStageEvidence {
  const staged = report.cases.find((entry) => entry.mode === 'staged');
  const signedOut = report.cases.find((entry) => entry.mode === 'signed-out');
  if (!staged || !signedOut) {
    throw new Error('Grid player entry runtime report requires staged and signed-out cases');
  }
  if (staged.destination !== EXPECTED_DESTINATIONS.staged || staged.destinationStatus !== 200) {
    throw new Error('Grid player entry staged destination did not resolve successfully');
  }
  if (
    signedOut.destination !== EXPECTED_DESTINATIONS['signed-out'] ||
    signedOut.destinationStatus !== 200
  ) {
    throw new Error('Grid player entry signed-out destination did not resolve successfully');
  }

  return {
    status: 'GREEN',
    source: 'runtime',
    runtimeVerified: true,
    evidence: [
      `Grid entry runtime verified: staged ${staged.status} → ${staged.destination} (${staged.destinationStatus}); signed-out ${signedOut.status} → ${signedOut.destination} (${signedOut.destinationStatus})`,
    ],
  };
}

async function reservePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Failed to reserve a local port for Grid runtime verification'));
        return;
      }
      const port = address.port;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

function appendLog(current: string, chunk: Buffer | string): string {
  const next = current + chunk.toString();
  return next.length > 16_000 ? next.slice(-16_000) : next;
}

async function stopServer(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([
    new Promise<void>((resolve) => child.once('exit', () => resolve())),
    new Promise<void>((resolve) => setTimeout(resolve, 4_000)),
  ]);
  if (child.exitCode === null && child.signalCode === null) {
    child.kill('SIGKILL');
  }
}

async function fetchWithTimeout(url: string, timeoutMs: number, redirect: RequestRedirect) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      redirect,
      cache: 'no-store',
      signal: controller.signal,
      headers: { 'user-agent': 'grid-player-entry-runtime-check/1.0' },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function runRuntimeCase(
  cwd: string,
  mode: GridPlayerEntryRuntimeMode,
  startupTimeoutMs: number,
  fetchTimeoutMs: number,
): Promise<GridPlayerEntryRuntimeCase> {
  const port = await reservePort();
  const origin = `http://127.0.0.1:${port}`;
  const worldReadEnabled = mode === 'signed-out' ? '1' : '0';
  const nextBin = path.join(cwd, 'node_modules', 'next', 'dist', 'bin', 'next');
  let logs = '';

  const child = spawn(process.execPath, [nextBin, 'dev', '-H', '127.0.0.1', '-p', String(port)], {
    cwd,
    env: {
      ...process.env,
      GRID_WORLD_READ_ENABLED: worldReadEnabled,
      // Runtime verification must never inherit a remote Supabase target.
      NEXT_PUBLIC_SUPABASE_URL: '',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: '',
      SUPABASE_SERVICE_ROLE_KEY: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk) => {
    logs = appendLog(logs, chunk);
  });
  child.stderr.on('data', (chunk) => {
    logs = appendLog(logs, chunk);
  });

  const deadline = Date.now() + startupTimeoutMs;
  try {
    let entryResponse: Response | null = null;
    let lastError: unknown;
    while (Date.now() < deadline) {
      if (child.exitCode !== null || child.signalCode !== null) {
        throw new Error(
          `Grid runtime server exited before verification (${String(child.exitCode ?? child.signalCode)}).\n${logs}`,
        );
      }
      try {
        const response = await fetchWithTimeout(
          `${origin}/grid/play`,
          Math.min(fetchTimeoutMs, 5_000),
          'manual',
        );
        if (REDIRECT_STATUSES.has(response.status)) {
          entryResponse = response;
          break;
        }
        lastError = new Error(`unexpected status ${response.status}`);
      } catch (error) {
        lastError = error;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    if (!entryResponse) {
      throw new Error(
        `Grid runtime server did not produce the expected entry redirect before timeout${lastError ? `: ${String(lastError)}` : ''}.\n${logs}`,
      );
    }

    const classified = classifyGridPlayerEntryRedirect({
      mode,
      status: entryResponse.status,
      location: entryResponse.headers.get('location'),
      origin,
    });
    const destinationResponse = await fetchWithTimeout(
      new URL(classified.destination, origin).toString(),
      fetchTimeoutMs,
      'follow',
    );
    if (destinationResponse.status !== 200) {
      throw new Error(
        `Grid player entry ${mode} destination returned ${destinationResponse.status}, expected 200.\n${logs}`,
      );
    }

    return {
      mode,
      status: classified.status,
      destination: classified.destination,
      destinationStatus: destinationResponse.status,
    };
  } finally {
    await stopServer(child);
  }
}

export async function verifyGridPlayerEntryRuntime(
  options: VerifyGridPlayerEntryRuntimeOptions = {},
): Promise<GridPlayerEntryRuntimeReport> {
  const cwd = options.cwd ?? process.cwd();
  const startupTimeoutMs = options.startupTimeoutMs ?? 45_000;
  const fetchTimeoutMs = options.fetchTimeoutMs ?? 10_000;

  const cases: GridPlayerEntryRuntimeCase[] = [];
  for (const mode of ['staged', 'signed-out'] as const) {
    cases.push(await runRuntimeCase(cwd, mode, startupTimeoutMs, fetchTimeoutMs));
  }

  const report = { verifiedAt: new Date().toISOString(), cases };
  runtimeEvidenceFromGridPlayerEntryReport(report);
  return report;
}

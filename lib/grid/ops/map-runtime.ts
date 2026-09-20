import { spawn, type ChildProcess } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { resolvePreferredLocalNodeBinary } from './local-toolchain';

export type GridMapRuntimeCase = 'disabled' | 'unauthenticated';

export interface GridMapRuntimeObservation {
  case: GridMapRuntimeCase;
  status: number;
  body: { success?: boolean; error?: string };
}

export interface GridMapRuntimeReport {
  verifiedAt: string;
  cases: GridMapRuntimeObservation[];
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
        reject(new Error('Could not reserve a localhost port'));
        return;
      }
      const port = address.port;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

async function stopServer(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([
    new Promise<void>((resolve) => child.once('exit', () => resolve())),
    new Promise<void>((resolve) => setTimeout(resolve, 4_000)),
  ]);
  if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
}

export async function fetchGridMapRuntimeProbe(
  url: string,
  timeoutMs: number,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, {
      cache: 'no-store',
      redirect: 'manual',
      signal: controller.signal,
      headers: { 'user-agent': 'grid-map-runtime-check/1.0' },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function waitForRuntime(
  origin: string,
  child: ChildProcess,
  label: string,
  startupTimeoutMs = 90_000,
): Promise<void> {
  const deadline = Date.now() + startupTimeoutMs;
  let lastError = 'no response';
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`${label} exited before verification (${String(child.exitCode ?? child.signalCode)})`);
    }
    try {
      const remainingMs = Math.max(1, deadline - Date.now());
      await fetchGridMapRuntimeProbe(
        `${origin}/api/grid/world`,
        Math.min(5_000, remainingMs),
      );
      return;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`${label} did not start before timeout: ${lastError}`);
}

async function readCase(
  origin: string,
  mode: GridMapRuntimeCase,
): Promise<GridMapRuntimeObservation> {
  const response = await fetchGridMapRuntimeProbe(
    `${origin}/api/grid/world`,
    60_000,
  );
  const body = (await response.json()) as GridMapRuntimeObservation['body'];
  return { case: mode, status: response.status, body };
}

export async function verifyGridMapRuntime(
  cwd = process.cwd(),
): Promise<GridMapRuntimeReport> {
  const port = await reservePort();
  const origin = `http://127.0.0.1:${port}`;
  const nextBin = path.join(cwd, 'node_modules', 'next', 'dist', 'bin', 'next');
  const nodeBin = resolvePreferredLocalNodeBinary();
  const child = spawn(nodeBin, [nextBin, 'dev', '-H', '127.0.0.1', '-p', String(port)], {
    cwd,
    env: {
      ...process.env,
      GRID_WORLD_READ_ENABLED: '0',
      NEXT_PUBLIC_SUPABASE_URL: '',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: '',
      SUPABASE_SERVICE_ROLE_KEY: '',
    },
    stdio: 'ignore',
  });

  try {
    await waitForRuntime(origin, child, 'Local Next runtime');

    const disabled = await readCase(origin, 'disabled');
    const enabledChild = spawn(nodeBin, [nextBin, 'dev', '-H', '127.0.0.1', '-p', String(port + 1)], {
      cwd,
      env: {
        ...process.env,
        GRID_WORLD_READ_ENABLED: '1',
        NEXT_PUBLIC_SUPABASE_URL: '',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: '',
        SUPABASE_SERVICE_ROLE_KEY: '',
      },
      stdio: 'ignore',
    });
    try {
      const enabledOrigin = `http://127.0.0.1:${port + 1}`;
      await waitForRuntime(enabledOrigin, enabledChild, 'Enabled local Next runtime');
      const unauthenticated = await readCase(enabledOrigin, 'unauthenticated');
      return { verifiedAt: new Date().toISOString(), cases: [disabled, unauthenticated] };
    } finally {
      await stopServer(enabledChild);
    }
  } finally {
    await stopServer(child);
  }
}

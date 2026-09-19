import { spawn, type ChildProcess } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';

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

async function readCase(
  origin: string,
  mode: GridMapRuntimeCase,
): Promise<GridMapRuntimeObservation> {
  const response = await fetch(`${origin}/api/grid/world`, {
    cache: 'no-store',
    redirect: 'manual',
    headers: { 'user-agent': 'grid-map-runtime-check/1.0' },
  });
  const body = (await response.json()) as GridMapRuntimeObservation['body'];
  return { case: mode, status: response.status, body };
}

export async function verifyGridMapRuntime(
  cwd = process.cwd(),
): Promise<GridMapRuntimeReport> {
  const port = await reservePort();
  const origin = `http://127.0.0.1:${port}`;
  const nextBin = path.join(cwd, 'node_modules', 'next', 'dist', 'bin', 'next');
  const child = spawn(process.execPath, [nextBin, 'dev', '-H', '127.0.0.1', '-p', String(port)], {
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
    await new Promise<void>((resolve, reject) => {
      const deadline = Date.now() + 30_000;
      const poll = () => {
        if (child.exitCode !== null) {
          reject(new Error(`Local Next runtime exited with code ${child.exitCode}`));
          return;
        }
        fetch(`${origin}/api/grid/world`, { cache: 'no-store' })
          .then(() => resolve())
          .catch(() => {
            if (Date.now() >= deadline) reject(new Error('Local Next runtime did not start'));
            else setTimeout(poll, 250);
          });
      };
      poll();
    });

    const disabled = await readCase(origin, 'disabled');
    const enabledChild = spawn(process.execPath, [nextBin, 'dev', '-H', '127.0.0.1', '-p', String(port + 1)], {
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
      await new Promise<void>((resolve, reject) => {
        const deadline = Date.now() + 30_000;
        const poll = () => {
          if (enabledChild.exitCode !== null) {
            reject(new Error(`Enabled local Next runtime exited with code ${enabledChild.exitCode}`));
            return;
          }
          fetch(`${enabledOrigin}/api/grid/world`, { cache: 'no-store' })
            .then(() => resolve())
            .catch(() => {
              if (Date.now() >= deadline) reject(new Error('Enabled local Next runtime did not start'));
              else setTimeout(poll, 250);
            });
        };
        poll();
      });
      const unauthenticated = await readCase(enabledOrigin, 'unauthenticated');
      return { verifiedAt: new Date().toISOString(), cases: [disabled, unauthenticated] };
    } finally {
      await stopServer(enabledChild);
    }
  } finally {
    await stopServer(child);
  }
}

import crypto from 'node:crypto';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { NextResponse } from 'next/server';
import { resolveAdminSessionFromRequest } from '@/lib/admin-auth';
import {
  collectGridBuilderOsSnapshot,
  writeGridBuilderRunState,
} from '@/lib/grid/ops/grid-builder-os';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const session = resolveAdminSessionFromRequest(request);
  if (!session.isAdmin) {
    return NextResponse.json({ error: 'Admin authorization required.' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  if (body?.action !== 'start-cycle') {
    return NextResponse.json({ error: 'Unknown Builder OS action.' }, { status: 400 });
  }

  const hostname = new URL(request.url).hostname;
  const cwd = process.cwd();
  const snapshot = collectGridBuilderOsSnapshot({
    cwd,
    hostname,
    nodeEnv: process.env.NODE_ENV,
  });
  if (!snapshot.controls.canStartCycle) {
    return NextResponse.json(
      { error: 'Builder OS is not ready to start.', reasons: snapshot.controls.reasons },
      { status: 409 },
    );
  }

  const runId = crypto.randomBytes(5).toString('hex');
  const viteNode = path.join(cwd, 'node_modules', 'vite-node', 'vite-node.mjs');
  const runner = path.join(cwd, 'scripts', 'grid-builder-os-runner.ts');

  try {
    const child = spawn(process.execPath, [viteNode, runner, '--cwd', cwd, '--run-id', runId], {
      cwd,
      detached: true,
      stdio: 'ignore',
      env: { ...process.env },
    });
    if (!child.pid) throw new Error('Builder runner did not return a process ID.');
    writeGridBuilderRunState({
      version: 1,
      runId,
      status: 'working',
      pid: child.pid,
      startedAt: new Date().toISOString(),
      message: 'Builder OS is starting the crew and checking current work.',
    }, cwd);
    child.unref();
    return NextResponse.json({
      ok: true,
      message: 'Build cycle started.',
      runId,
    }, { status: 202 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to start the build cycle.' },
      { status: 500 },
    );
  }
}


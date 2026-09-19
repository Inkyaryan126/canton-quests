import crypto from 'node:crypto';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { NextResponse } from 'next/server';
import { resolveAdminSessionFromRequest } from '@/lib/admin-auth';
import {
  collectGridBuilderOsSnapshot,
  isLocalBuilderHostname,
  writeGridBuilderCliHealthRunState,
  writeGridBuilderRunState,
} from '@/lib/grid/ops/grid-builder-os';

export const runtime = 'nodejs';

function startDetachedNodeScript(cwd: string, script: string, args: string[]) {
  const viteNode = path.join(cwd, 'node_modules', 'vite-node', 'vite-node.mjs');
  const child = spawn(process.execPath, [viteNode, script, ...args], {
    cwd,
    detached: true,
    stdio: 'ignore',
    env: { ...process.env },
  });
  if (!child.pid) throw new Error('Builder process did not return a process ID.');
  child.unref();
  return child;
}

export async function POST(request: Request) {
  const session = resolveAdminSessionFromRequest(request);
  if (!session.isAdmin) {
    return NextResponse.json({ error: 'Admin authorization required.' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const hostname = new URL(request.url).hostname;
  const cwd = process.cwd();

  if (body?.action === 'refresh-health') {
    if (!isLocalBuilderHostname(hostname) || process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'Crew health can only run from the local development Boss Panel.' },
        { status: 403 },
      );
    }

    const snapshot = collectGridBuilderOsSnapshot({ cwd, hostname, nodeEnv: process.env.NODE_ENV });
    if (snapshot.crewHealthRun.status === 'working') {
      return NextResponse.json({ error: 'Crew health is already running.' }, { status: 409 });
    }

    const runId = crypto.randomBytes(5).toString('hex');
    const healthScript = path.join(cwd, 'scripts', 'grid-builder-os-health.ts');
    try {
      const child = startDetachedNodeScript(cwd, healthScript, ['--cwd', cwd, '--run-id', runId]);
      writeGridBuilderCliHealthRunState({
        version: 1,
        runId,
        status: 'working',
        pid: child.pid,
        startedAt: new Date().toISOString(),
        message: 'Checking Codex, Claude, and Gemini.',
      }, cwd);
      return NextResponse.json({ ok: true, message: 'Crew health check started.', runId }, { status: 202 });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Unable to start crew health.' },
        { status: 500 },
      );
    }
  }

  if (body?.action !== 'start-cycle') {
    return NextResponse.json({ error: 'Unknown Builder OS action.' }, { status: 400 });
  }

  const snapshot = collectGridBuilderOsSnapshot({ cwd, hostname, nodeEnv: process.env.NODE_ENV });
  if (!snapshot.controls.canStartCycle) {
    return NextResponse.json(
      { error: 'Builder OS is not ready to start.', reasons: snapshot.controls.reasons },
      { status: 409 },
    );
  }

  const runId = crypto.randomBytes(5).toString('hex');
  const runner = path.join(cwd, 'scripts', 'grid-builder-os-runner.ts');

  try {
    const child = startDetachedNodeScript(cwd, runner, ['--cwd', cwd, '--run-id', runId]);
    writeGridBuilderRunState({
      version: 1,
      runId,
      status: 'working',
      pid: child.pid,
      startedAt: new Date().toISOString(),
      message: 'Builder OS is starting the crew and checking current work.',
    }, cwd);
    return NextResponse.json({ ok: true, message: 'Build cycle started.', runId }, { status: 202 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to start the build cycle.' },
      { status: 500 },
    );
  }
}

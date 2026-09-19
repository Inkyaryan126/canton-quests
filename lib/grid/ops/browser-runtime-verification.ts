import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { chromium } from 'playwright';

export type GridBrowserRuntimeStatus = 'PENDING' | 'VERIFIED' | 'FAILED' | 'SKIPPED';

export interface GridBrowserRuntimeViewport {
  width: number;
  height: number;
}

export interface GridBrowserRuntimeCase {
  name: string;
  requestedPath: string;
  expectedPath: string;
  finalUrl: string | null;
  finalPath: string | null;
  httpStatus: number | null;
  title: string | null;
  heading: string | null;
  consoleErrors: string[];
  pageErrors: string[];
  overlayCount: number;
  viewport: GridBrowserRuntimeViewport;
  startedAt: string;
  finishedAt: string;
  error?: string;
}

export interface GridBrowserRuntimeReport {
  status: GridBrowserRuntimeStatus;
  verifiedAt: string;
  browser: { kind: 'playwright' | 'chrome'; executablePath: string } | null;
  cases: GridBrowserRuntimeCase[];
  skippedReasons: string[];
  serverCleanup: { attempted: boolean; completed: boolean };
}

export interface GridBrowserRuntimePageLocator {
  count(): Promise<number>;
  first(): { textContent(): Promise<string | null> };
}

export interface GridBrowserRuntimePage {
  url(): string;
  title(): Promise<string>;
  locator(selector: string): GridBrowserRuntimePageLocator;
}

export interface GridBrowserRuntimeTarget {
  name: string;
  requestedPath: string;
  expectedPath: string;
  expectedHeading: string;
}

export interface GridBrowserRuntimeCollectionContext {
  httpStatus: number | null;
  consoleErrors: string[];
  pageErrors: string[];
  timestamps: { startedAt: string; finishedAt: string };
  viewport: GridBrowserRuntimeViewport;
  error?: string;
}

export interface VerifyGridBrowserRuntimeOptions {
  cwd?: string;
  startupTimeoutMs?: number;
  navigationTimeoutMs?: number;
  viewport?: GridBrowserRuntimeViewport;
}

export interface GridRuntimeProcessLike {
  exitCode: number | null;
  signalCode: NodeJS.Signals | null;
  kill(signal: NodeJS.Signals): boolean;
  once(event: 'exit', listener: () => void): unknown;
}

const REQUIRED_CASES: GridBrowserRuntimeTarget[] = [
  {
    name: 'grid-entry',
    requestedPath: '/grid/play',
    expectedPath: '/grid',
    expectedHeading: 'THE GRID',
  },
  {
    name: 'grid-public-shell',
    requestedPath: '/grid',
    expectedPath: '/grid',
    expectedHeading: 'THE GRID',
  },
  {
    name: 'grid-protected-contracts-shell',
    requestedPath: '/grid/contracts',
    expectedPath: '/grid/contracts',
    expectedHeading: 'CONTRACTS',
  },
];

export async function collectGridBrowserRuntimeEvidence(
  page: GridBrowserRuntimePage,
  target: GridBrowserRuntimeTarget,
  context: GridBrowserRuntimeCollectionContext,
): Promise<GridBrowserRuntimeCase> {
  const finalUrl = page.url();
  const parsedUrl = new URL(finalUrl);
  const heading = (await page.locator('h1').first().textContent())?.trim() || null;
  const overlayCount = await page
    .locator('[data-nextjs-dialog-overlay], [data-nextjs-toast]')
    .count();

  return {
    name: target.name,
    requestedPath: target.requestedPath,
    expectedPath: target.expectedPath,
    finalUrl,
    finalPath: `${parsedUrl.pathname}${parsedUrl.search}`,
    httpStatus: context.httpStatus,
    title: await page.title(),
    heading,
    consoleErrors: [...context.consoleErrors],
    pageErrors: [...context.pageErrors],
    overlayCount,
    viewport: { ...context.viewport },
    startedAt: context.timestamps.startedAt,
    finishedAt: context.timestamps.finishedAt,
    ...(context.error ? { error: context.error } : {}),
  };
}

export function evaluateGridBrowserRuntimeReport(report: GridBrowserRuntimeReport): {
  status: Exclude<GridBrowserRuntimeStatus, 'PENDING'>;
  reasons: string[];
} {
  if (report.status === 'SKIPPED') {
    return { status: 'SKIPPED', reasons: [...report.skippedReasons] };
  }

  const reasons = [...report.skippedReasons];
  if (!report.serverCleanup.completed) reasons.push('local Next server cleanup did not complete');

  for (const target of REQUIRED_CASES) {
    const evidence = report.cases.find((item) => item.name === target.name);
    if (!evidence) {
      reasons.push(`${target.name}: required browser case was not collected`);
      continue;
    }
    if (evidence.error) reasons.push(`${target.name}: ${evidence.error}`);
    if (evidence.httpStatus === null || evidence.httpStatus < 200 || evidence.httpStatus >= 400) {
      reasons.push(`${target.name}: final HTTP status was ${String(evidence.httpStatus)}`);
    }
    if (evidence.finalPath !== target.expectedPath) {
      reasons.push(`${target.name}: final path was ${String(evidence.finalPath)}, expected ${target.expectedPath}`);
    }
    if (!evidence.heading?.toUpperCase().includes(target.expectedHeading)) {
      reasons.push(`${target.name}: heading did not contain ${target.expectedHeading}`);
    }
    if (evidence.consoleErrors.length > 0) {
      reasons.push(`${target.name}: browser console errors were captured`);
    }
    if (evidence.pageErrors.length > 0) {
      reasons.push(`${target.name}: page errors were captured`);
    }
    if (evidence.overlayCount > 0) {
      reasons.push(`${target.name}: Next error overlay count was ${evidence.overlayCount}`);
    }
  }

  return reasons.length > 0
    ? { status: 'FAILED', reasons }
    : { status: 'VERIFIED', reasons: [] };
}

export async function stopGridRuntimeProcess(
  child: GridRuntimeProcessLike,
  timeoutMs: number,
): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([
    new Promise<void>((resolve) => child.once('exit', resolve)),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
  if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
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
        reject(new Error('Could not reserve a loopback port'));
        return;
      }
      server.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });
}

function findExecutable(candidates: string[]): string | null {
  for (const candidate of candidates) if (fs.existsSync(candidate)) return candidate;
  for (const command of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
    try {
      const result = execFileSync('which', [command], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      if (result && fs.existsSync(result)) return result;
    } catch {
      // Continue through the local executable candidates.
    }
  }
  return null;
}

export function resolveGridBrowserExecutable(): { kind: 'playwright' | 'chrome'; executablePath: string } | null {
  const playwrightPath = chromium.executablePath();
  if (playwrightPath && fs.existsSync(playwrightPath)) {
    return { kind: 'playwright', executablePath: playwrightPath };
  }
  const chromePath = findExecutable([
    process.env.GOOGLE_CHROME_BIN ?? '',
    process.env.CHROME_BIN ?? '',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ]);
  return chromePath ? { kind: 'chrome', executablePath: chromePath } : null;
}

function appendLog(current: string, chunk: Buffer | string): string {
  const next = current + chunk.toString();
  return next.length > 16_000 ? next.slice(-16_000) : next;
}

async function waitForServer(origin: string, child: ChildProcess, deadline: number, logs: () => string): Promise<void> {
  let lastError = 'no response';
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`local Next server exited before browser verification (${String(child.exitCode ?? child.signalCode)}).\n${logs()}`);
    }
    try {
      const response = await fetch(`${origin}/grid/play`, { redirect: 'manual', cache: 'no-store' });
      if (response.status >= 200 && response.status < 400) return;
      lastError = `status ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`local Next server did not become ready: ${lastError}\n${logs()}`);
}

function localOnlyEnvironment(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    GRID_WORLD_READ_ENABLED: '0',
    NEXT_PUBLIC_SUPABASE_URL: '',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: '',
    NEXT_PUBLIC_SITE_URL: '',
    NEXT_PUBLIC_APP_URL: '',
    SUPABASE_SERVICE_ROLE_KEY: '',
    SUPABASE_URL: '',
    SUPABASE_ANON_KEY: '',
    SUPABASE_SERVICE_ROLE: '',
  };
}

async function runBrowserCase(
  page: GridBrowserRuntimePage & { goto?: (url: string, options: { waitUntil: 'domcontentloaded'; timeout: number }) => Promise<{ status(): number } | null>; on?: (event: string, listener: (...args: any[]) => void) => void; waitForTimeout?: (ms: number) => Promise<void> },
  origin: string,
  target: GridBrowserRuntimeTarget,
  viewport: GridBrowserRuntimeViewport,
  timeoutMs: number,
): Promise<GridBrowserRuntimeCase> {
  const startedAt = new Date().toISOString();
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on?.('console', (message: { type(): string; text(): string }) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on?.('pageerror', (error: Error) => pageErrors.push(error.message));
  try {
    const response = await page.goto?.(`${origin}${target.requestedPath}`, {
      waitUntil: 'domcontentloaded',
      timeout: timeoutMs,
    });
    await page.waitForTimeout?.(250);
    return await collectGridBrowserRuntimeEvidence(page, target, {
      httpStatus: response?.status() ?? null,
      consoleErrors,
      pageErrors,
      timestamps: { startedAt, finishedAt: new Date().toISOString() },
      viewport,
    });
  } catch (error) {
    return {
      name: target.name,
      requestedPath: target.requestedPath,
      expectedPath: target.expectedPath,
      finalUrl: page.url(),
      finalPath: (() => {
        try { const url = new URL(page.url()); return `${url.pathname}${url.search}`; } catch { return null; }
      })(),
      httpStatus: null,
      title: null,
      heading: null,
      consoleErrors,
      pageErrors,
      overlayCount: 0,
      viewport,
      startedAt,
      finishedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function verifyGridBrowserRuntime(
  options: VerifyGridBrowserRuntimeOptions = {},
): Promise<GridBrowserRuntimeReport> {
  const cwd = options.cwd ?? process.cwd();
  const viewport = options.viewport ?? { width: 390, height: 844 };
  const browserExecutable = resolveGridBrowserExecutable();
  if (!browserExecutable) {
    return {
      status: 'SKIPPED',
      verifiedAt: new Date().toISOString(),
      browser: null,
      cases: [],
      skippedReasons: ['No installed Playwright Chromium or local Chrome/Chromium executable found'],
      serverCleanup: { attempted: false, completed: true },
    };
  }

  let port: number;
  try {
    port = await reservePort();
  } catch (error) {
    return {
      status: 'SKIPPED',
      verifiedAt: new Date().toISOString(),
      browser: browserExecutable,
      cases: [],
      skippedReasons: [`Could not bind a local loopback port: ${error instanceof Error ? error.message : String(error)}`],
      serverCleanup: { attempted: false, completed: true },
    };
  }
  const origin = `http://127.0.0.1:${port}`;
  const nextBin = path.join(cwd, 'node_modules', 'next', 'dist', 'bin', 'next');
  let logs = '';
  const child = spawn(process.execPath, [nextBin, 'dev', '-H', '127.0.0.1', '-p', String(port)], {
    cwd,
    env: localOnlyEnvironment(),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout?.on('data', (chunk) => { logs = appendLog(logs, chunk); });
  child.stderr?.on('data', (chunk) => { logs = appendLog(logs, chunk); });

  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
  const cases: GridBrowserRuntimeCase[] = [];
  let failure: Error | null = null;
  try {
    await waitForServer(origin, child, Date.now() + (options.startupTimeoutMs ?? 45_000), () => logs);
    browser = await chromium.launch({ headless: true, executablePath: browserExecutable.executablePath });
    const context = await browser.newContext({ viewport });
    try {
      for (const target of REQUIRED_CASES) {
        const page = await context.newPage();
        try {
          cases.push(await runBrowserCase(page, origin, target, viewport, options.navigationTimeoutMs ?? 20_000));
        } finally {
          await page.close();
        }
      }
    } finally {
      await context.close();
    }
  } catch (error) {
    failure = error instanceof Error ? error : new Error(String(error));
  } finally {
    if (browser) await browser.close().catch(() => undefined);
  }

  let cleanupCompleted = true;
  try {
    await stopGridRuntimeProcess(child, 4_000);
  } catch {
    cleanupCompleted = false;
  }
  if (failure) {
    cases.push({
      name: 'harness', requestedPath: '', expectedPath: '', finalUrl: null, finalPath: null,
      httpStatus: null, title: null, heading: null, consoleErrors: [], pageErrors: [], overlayCount: 0,
      viewport, startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(), error: `${failure.message}\n${logs}`,
    });
  }

  const report: GridBrowserRuntimeReport = {
    status: 'PENDING',
    verifiedAt: new Date().toISOString(),
    browser: browserExecutable,
    cases,
    skippedReasons: [],
    serverCleanup: { attempted: true, completed: cleanupCompleted },
  };
  const evaluation = evaluateGridBrowserRuntimeReport(report);
  return { ...report, status: evaluation.status };
}

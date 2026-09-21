import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { coordinationRoot } from '../../agent-control';
import { resolveIntegrationRef } from '../master-board/collect';
import { GRID_V1_FEATURES } from './catalog';
import type { GridV1FeatureDefinition, GridV1TestVerificationRecord } from './types';

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

export function gridV1TestEvidenceFile(cwd = process.cwd()): string {
  return path.join(coordinationRoot(cwd), 'evidence', 'completion-board-tests.json');
}

export function readGridV1TestVerification(cwd = process.cwd()): GridV1TestVerificationRecord | null {
  const filename = gridV1TestEvidenceFile(cwd);
  try {
    const parsed = JSON.parse(fs.readFileSync(filename, 'utf8')) as GridV1TestVerificationRecord;
    return parsed.version === 1 && parsed.kind === 'completion-board-tests' ? parsed : null;
  } catch {
    return null;
  }
}

export function verifyGridV1FeatureTests(options: {
  cwd?: string;
  integrationRef?: string;
  definitions?: GridV1FeatureDefinition[];
} = {}): GridV1TestVerificationRecord {
  const cwd = options.cwd ?? process.cwd();
  const integrationRef = resolveIntegrationRef(cwd, options.integrationRef);
  if (!integrationRef) throw new Error('Cannot verify Grid V1 tests without a canonical integration ref.');
  const integrationCommit = git(cwd, ['rev-parse', integrationRef]);
  const checkoutCommit = git(cwd, ['rev-parse', 'HEAD']);
  if (checkoutCommit !== integrationCommit) {
    throw new Error(
      'Grid V1 verification must run from the exact canonical integration commit. '
      + `Checkout/detach ${integrationRef} before recording evidence.`,
    );
  }
  const definitions = options.definitions ?? GRID_V1_FEATURES;
  const tests = Array.from(new Set(definitions.flatMap((item) => item.testPaths))).sort();
  const missing = tests.filter((testPath) => !fs.existsSync(path.join(cwd, testPath)));
  if (missing.length > 0) {
    throw new Error(`Cannot run Grid V1 verification; declared test files are missing from this checkout: ${missing.join(', ')}`);
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'grid-v1-tests-'));
  const outputFile = path.join(tempDir, 'vitest.json');
  const vitest = path.join(cwd, 'node_modules', '.bin', 'vitest');
  let commandFailure = '';
  try {
    execFileSync(vitest, ['run', '--reporter=json', `--outputFile=${outputFile}`, ...tests], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'ignore', 'pipe'],
      maxBuffer: 16 * 1024 * 1024,
    });
  } catch (error) {
    commandFailure = error instanceof Error ? error.message : String(error);
  }

  let payload: {
    success?: boolean;
    testResults?: Array<{ name?: string; status?: string; message?: string }>;
  } = {};
  try {
    payload = JSON.parse(fs.readFileSync(outputFile, 'utf8')) as typeof payload;
  } catch {
    payload = {};
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  const results = new Map<string, { status: 'PASS' | 'FAIL'; detail?: string }>();
  for (const result of payload.testResults ?? []) {
    if (!result.name) continue;
    const relative = path.relative(cwd, result.name).replaceAll(path.sep, '/');
    results.set(relative, {
      status: result.status === 'passed' ? 'PASS' : 'FAIL',
      detail: result.status === 'passed' ? undefined : result.message?.slice(0, 500),
    });
  }
  for (const testPath of tests) {
    if (!results.has(testPath)) {
      results.set(testPath, {
        status: 'FAIL',
        detail: commandFailure || 'Vitest did not return a result for this declared test file.',
      });
    }
  }

  const failed = [...results.values()].filter((item) => item.status === 'FAIL').length;
  const record: GridV1TestVerificationRecord = {
    version: 1,
    kind: 'completion-board-tests',
    integrationRef,
    integrationCommit,
    recordedAt: new Date().toISOString(),
    status: failed === 0 && payload.success !== false ? 'PASS' : 'FAIL',
    summary: failed === 0
      ? `Grid V1 focused verification passed for ${tests.length}/${tests.length} declared test files.`
      : `Grid V1 focused verification has ${failed} failing or unreported test file(s) out of ${tests.length}.`,
    tests: Object.fromEntries(results),
  };
  const filename = gridV1TestEvidenceFile(cwd);
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, `${JSON.stringify(record, null, 2)}\n`);
  return record;
}

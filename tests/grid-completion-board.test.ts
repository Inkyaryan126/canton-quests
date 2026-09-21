import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { coordinationRoot } from '../lib/agent-control';
import { collectGridV1CompletionBoard } from '../lib/grid/completion-board/collect';
import { GRID_V1_FEATURES } from '../lib/grid/completion-board/catalog';
import {
  gridV1TestEvidenceFile,
  readGridV1TestVerification,
  verifyGridV1FeatureTests,
} from '../lib/grid/completion-board/verify';
import type { GridV1FeatureDefinition, GridV1TestVerificationRecord } from '../lib/grid/completion-board/types';

const dirs: string[] = [];

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function makeRepo(): string {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'grid-v1-board-'));
  dirs.push(cwd);
  git(cwd, 'init', '-b', 'main');
  git(cwd, 'config', 'user.email', 'grid@test.local');
  git(cwd, 'config', 'user.name', 'Grid Test');
  fs.writeFileSync(path.join(cwd, 'README.md'), 'base\n');
  git(cwd, 'add', '.');
  git(cwd, 'commit', '-m', 'base');
  git(cwd, 'checkout', '-b', 'grid-canonical-integration-20260921');
  return cwd;
}

function add(cwd: string, filePath: string): void {
  const filename = path.join(cwd, filePath);
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, 'ok\n');
}

function commitAll(cwd: string, message = 'feature'): string {
  git(cwd, 'add', '.');
  git(cwd, 'commit', '-m', message);
  return git(cwd, 'rev-parse', 'HEAD');
}

function feature(overrides: Partial<GridV1FeatureDefinition> = {}): GridV1FeatureDefinition {
  return {
    id: 'feature.one',
    title: 'Feature One',
    area: 'Gameplay',
    phase: 'gameplay',
    priority: 50,
    dependsOn: [],
    codePaths: ['lib/feature.ts'],
    testPaths: ['tests/feature.test.ts'],
    scopeHints: ['lib/feature.ts', 'tests/feature.test.ts'],
    acceptanceCriteria: ['works'],
    ...overrides,
  };
}

function recordTests(cwd: string, commit: string, statuses: Record<string, 'PASS' | 'FAIL'>): void {
  const record: GridV1TestVerificationRecord = {
    version: 1,
    kind: 'completion-board-tests',
    integrationRef: 'grid-canonical-integration-20260921',
    integrationCommit: commit,
    recordedAt: new Date().toISOString(),
    status: Object.values(statuses).every((status) => status === 'PASS') ? 'PASS' : 'FAIL',
    summary: 'fixture',
    tests: Object.fromEntries(
      Object.entries(statuses).map(([testPath, status]) => [testPath, { status }]),
    ),
  };
  const filename = gridV1TestEvidenceFile(cwd);
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, JSON.stringify(record));
}

afterEach(() => {
  while (dirs.length) fs.rmSync(dirs.pop()!, { recursive: true, force: true });
});
describe('Canonical Grid V1 Completion Board', () => {
  it('requires code and current passing test evidence for COMPLETE', () => {
    const cwd = makeRepo();
    add(cwd, 'lib/feature.ts');
    add(cwd, 'tests/feature.test.ts');
    const commit = commitAll(cwd);
    recordTests(cwd, commit, { 'tests/feature.test.ts': 'PASS' });

    const board = collectGridV1CompletionBoard({ cwd, definitions: [feature()] });

    expect(board.summary).toMatchObject({ complete: 1, total: 1, remaining: 0, percent: 100 });
    expect(board.features[0]).toMatchObject({ status: 'COMPLETE', missingCode: [], missingTests: [] });
    expect(board.features[0].testEvidence[0]).toMatchObject({
      status: 'PASS',
      current: true,
      satisfied: true,
    });
  });

  it('refuses stale or failing test proof', () => {
    const cwd = makeRepo();
    add(cwd, 'lib/feature.ts');
    add(cwd, 'tests/feature.test.ts');
    const first = commitAll(cwd, 'first');
    recordTests(cwd, first, { 'tests/feature.test.ts': 'PASS' });
    add(cwd, 'later.txt');
    const current = commitAll(cwd, 'later');

    let board = collectGridV1CompletionBoard({ cwd, definitions: [feature()] });
    expect(board.features[0].status).toBe('NEEDS_VERIFICATION');
    expect(board.features[0].testEvidence[0].current).toBe(false);

    recordTests(cwd, current, { 'tests/feature.test.ts': 'FAIL' });
    board = collectGridV1CompletionBoard({ cwd, definitions: [feature()] });
    expect(board.features[0].status).toBe('NEEDS_VERIFICATION');
    expect(board.features[0].testEvidence[0].status).toBe('FAIL');
  });

  it('distinguishes missing artifacts from missing verification', () => {
    const cwd = makeRepo();
    add(cwd, 'lib/feature.ts');
    const commit = commitAll(cwd);
    recordTests(cwd, commit, { 'tests/feature.test.ts': 'PASS' });

    const board = collectGridV1CompletionBoard({ cwd, definitions: [feature()] });

    expect(board.features[0].status).toBe('PARTIAL');
    expect(board.features[0].missingTests).toEqual(['tests/feature.test.ts']);
  });

  it('blocks a complete downstream feature on an incomplete dependency', () => {
    const cwd = makeRepo();
    for (const file of ['lib/a.ts', 'tests/a.test.ts', 'lib/b.ts', 'tests/b.test.ts']) add(cwd, file);
    const commit = commitAll(cwd);
    recordTests(cwd, commit, { 'tests/a.test.ts': 'FAIL', 'tests/b.test.ts': 'PASS' });
    const definitions = [
      feature({ id: 'a', codePaths: ['lib/a.ts'], testPaths: ['tests/a.test.ts'], scopeHints: ['lib/a.ts'] }),
      feature({
        id: 'b',
        codePaths: ['lib/b.ts'],
        testPaths: ['tests/b.test.ts'],
        scopeHints: ['lib/b.ts'],
        dependsOn: ['a'],
      }),
    ];

    const board = collectGridV1CompletionBoard({ cwd, definitions });

    expect(board.features.find((item) => item.id === 'a')?.status).toBe('NEEDS_VERIFICATION');
    expect(board.features.find((item) => item.id === 'b')).toMatchObject({
      status: 'BLOCKED',
      blockedBy: ['a'],
    });
  });

  it('maps a live Control Tower claim to IN_PROGRESS without mutating it', () => {
    const cwd = makeRepo();
    add(cwd, 'lib/feature.ts');
    add(cwd, 'tests/feature.test.ts');
    const commit = commitAll(cwd);
    recordTests(cwd, commit, { 'tests/feature.test.ts': 'PASS' });
    const claims = path.join(coordinationRoot(cwd), 'claims');
    fs.mkdirSync(claims, { recursive: true });
    const now = new Date().toISOString();
    const claimFile = path.join(claims, 'feature-one.json');
    fs.writeFileSync(claimFile, JSON.stringify({
      version: 1,
      lane: 'feature-one',
      owner: 'claude',
      goal: 'finish feature.one',
      scope: ['lib/feature.ts'],
      worktree: cwd,
      branch: 'feature-one',
      claimedAt: now,
      heartbeatAt: now,
    }));
    const before = fs.readFileSync(claimFile, 'utf8');

    const board = collectGridV1CompletionBoard({ cwd, definitions: [feature()] });

    expect(board.features[0]).toMatchObject({ status: 'IN_PROGRESS', activeClaim: 'feature-one' });
    expect(fs.readFileSync(claimFile, 'utf8')).toBe(before);
  });

  it('requires current runtime evidence when declared', () => {
    const cwd = makeRepo();
    add(cwd, 'lib/feature.ts');
    add(cwd, 'tests/feature.test.ts');
    const commit = commitAll(cwd);
    recordTests(cwd, commit, { 'tests/feature.test.ts': 'PASS' });
    const evidenceDir = path.join(coordinationRoot(cwd), 'evidence');
    fs.mkdirSync(evidenceDir, { recursive: true });
    fs.writeFileSync(path.join(evidenceDir, 'release-gate.json'), JSON.stringify({
      version: 1,
      kind: 'release-gate',
      status: 'FAIL',
      integrationCommit: commit,
      summary: 'failed',
    }));

    const board = collectGridV1CompletionBoard({
      cwd,
      definitions: [feature({ runtimeEvidence: [{ kind: 'release-gate', acceptedStatuses: ['PASS'] }] })],
    });

    expect(board.features[0].status).toBe('NEEDS_VERIFICATION');
    expect(board.features[0].runtime[0]).toMatchObject({ status: 'FAIL', current: true, satisfied: false });
  });

  it('refuses to record canonical test evidence from a different checkout commit', () => {
    const cwd = makeRepo();
    git(cwd, 'checkout', '-b', 'feature-work');
    add(cwd, 'lib/feature.ts');
    add(cwd, 'tests/feature.test.ts');
    commitAll(cwd);

    expect(() => verifyGridV1FeatureTests({
      cwd,
      integrationRef: 'grid-canonical-integration-20260921',
      definitions: [feature()],
    })).toThrow('exact canonical integration commit');
    expect(readGridV1TestVerification(cwd)).toBeNull();
  });

  it('has a stable unique feature catalog and shared evidence location', () => {
    expect(GRID_V1_FEATURES.length).toBeGreaterThanOrEqual(45);
    expect(new Set(GRID_V1_FEATURES.map((item) => item.id)).size).toBe(GRID_V1_FEATURES.length);
    expect(GRID_V1_FEATURES.every((item) =>
      item.codePaths.length > 0 && item.testPaths.length > 0 && item.acceptanceCriteria.length > 0,
    )).toBe(true);

    const cwd = makeRepo();
    expect(readGridV1TestVerification(cwd)).toBeNull();
    expect(gridV1TestEvidenceFile(cwd)).toContain('grid-agent-control');
  });
});

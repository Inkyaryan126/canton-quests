import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildGridReleaseGateEvidenceRecord,
  writeGridReleaseGateEvidence,
} from '../lib/grid/ops/release-gate-evidence';

const tempDirs: string[] = [];

function makeRepo(): string {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'grid-release-gate-evidence-'));
  tempDirs.push(cwd);
  execFileSync('git', ['init', '-q', '-b', 'grid-canonical-integration-20260918'], { cwd });
  execFileSync('git', ['config', 'user.email', 'grid@example.test'], { cwd });
  execFileSync('git', ['config', 'user.name', 'Grid Test'], { cwd });
  fs.writeFileSync(path.join(cwd, 'README.md'), 'grid\n');
  execFileSync('git', ['add', 'README.md'], { cwd });
  execFileSync('git', ['commit', '-qm', 'initial'], { cwd });
  return cwd;
}

afterEach(() => {
  while (tempDirs.length) {
    const dir = tempDirs.pop();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});
describe('Grid release gate evidence', () => {
  it('records PASS only for a successful gate that included the production build', () => {
    const evidence = buildGridReleaseGateEvidenceRecord({
      passed: true,
      buildIncluded: true,
      completedSteps: ['coordination', 'typecheck', 'lint', 'build'],
      recordedAt: '2026-09-20T03:10:00.000Z',
    }, {
      integrationRef: 'grid-canonical-integration-20260918',
      integrationCommit: 'abc123def456',
    });

    expect(evidence).toMatchObject({
      kind: 'release-gate',
      status: 'PASS',
      sourceStatus: 'PASS',
      buildIncluded: true,
      integrationCommit: 'abc123def456',
    });
    expect(evidence.summary).toContain('production build');
  });

  it('never certifies a run that skipped the production build', () => {
    const evidence = buildGridReleaseGateEvidenceRecord({
      passed: true,
      buildIncluded: false,
      completedSteps: ['coordination', 'typecheck', 'lint'],
      recordedAt: '2026-09-20T03:10:00.000Z',
    }, {
      integrationRef: 'grid-canonical-integration-20260918',
      integrationCommit: 'abc123def456',
    });
    expect(evidence.status).toBe('FAIL');
    expect(evidence.sourceStatus).toBe('FAIL');
    expect(evidence.summary).toContain('production build was skipped');
  });

  it('writes commit-bound evidence to git-common bookkeeping without dirtying the repo', () => {
    const cwd = makeRepo();
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim();

    const evidence = writeGridReleaseGateEvidence({
      passed: false,
      buildIncluded: true,
      completedSteps: ['coordination', 'diagnostics'],
      failedStep: 'typecheck',
      recordedAt: '2026-09-20T03:10:00.000Z',
    }, cwd);

    expect(evidence.integrationCommit).toBe(head);
    expect(evidence.status).toBe('FAIL');
    expect(evidence.failedStep).toBe('typecheck');

    const commonDir = execFileSync('git', ['rev-parse', '--git-common-dir'], {
      cwd,
      encoding: 'utf8',
    }).trim();
    const evidencePath = path.resolve(cwd, commonDir, 'grid-agent-control', 'evidence', 'release-gate.json');
    expect(JSON.parse(fs.readFileSync(evidencePath, 'utf8'))).toMatchObject({
      kind: 'release-gate',
      integrationCommit: head,
      failedStep: 'typecheck',
    });
    expect(execFileSync('git', ['status', '--porcelain'], { cwd, encoding: 'utf8' }).trim()).toBe('');
  });
});
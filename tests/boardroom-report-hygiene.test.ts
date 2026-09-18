import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import { getBudgetState } from '../lib/boardroom/budget';
import { writeMorningReport, writeMorningReportExport } from '../lib/boardroom/report';
import { morningReportFile, morningReportExportFile } from '../lib/boardroom/paths';

const roots: string[] = [];

function tempRepo(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'boardroom-report-hygiene-'));
  roots.push(root);
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 'Test User'], { cwd: root });
  fs.mkdirSync(path.join(root, 'boardroom', 'reports'), { recursive: true });
  fs.writeFileSync(path.join(root, 'boardroom', 'reports', 'MORNING_REPORT.md'), 'tracked baseline\n');
  execFileSync('git', ['add', '.'], { cwd: root });
  execFileSync('git', ['commit', '-q', '-m', 'baseline'], { cwd: root });
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

const input = {
  run: {
    runId: 'R1',
    branch: 'boardroom/test',
    baseCommit: 'abc123',
    startedAt: 't0',
    endedAt: 't1',
    sleepPrevention: { active: false, reason: 'not active' },
    stopReason: 'MANUAL_TEST',
  },
  tasks: [],
  budget: undefined,
  commits: [],
  actionsRequired: [],
  touchedThisRunTaskIds: [],
};

describe('Boardroom generated report storage', () => {
  it('writes autonomous reports to Git-common coordination storage without dirtying the checkout', () => {
    const root = tempRepo();
    writeMorningReport({ ...input, budget: getBudgetState(root) }, root);

    expect(fs.existsSync(morningReportFile(root))).toBe(true);
    expect(fs.readFileSync(morningReportExportFile(root), 'utf8')).toBe('tracked baseline\n');
    expect(execFileSync('git', ['status', '--short'], { cwd: root, encoding: 'utf8' })).toBe('');
    expect(morningReportFile(root)).not.toBe(morningReportExportFile(root));
  });

  it('only updates the tracked report through the explicit export writer', () => {
    const root = tempRepo();
    writeMorningReportExport({ ...input, budget: getBudgetState(root) }, root);

    expect(fs.readFileSync(morningReportExportFile(root), 'utf8')).toContain('# CANTON QUESTS — BOARDROOM MORNING REPORT');
    expect(execFileSync('git', ['status', '--short'], { cwd: root, encoding: 'utf8' })).toContain(' M boardroom/reports/MORNING_REPORT.md');
  });
});

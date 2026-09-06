// Canton Quests Boardroom V2 — handoff doc + morning report generation tests.

import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTask, recordDecision, recordTestResult, checkpoint, getTask, updateTaskStatus } from '../lib/boardroom/tasks';
import { recordAttempt } from '../lib/boardroom/attempts';
import { renderHandoff, writeHandoff } from '../lib/boardroom/handoff';
import { renderMorningReport, writeMorningReport } from '../lib/boardroom/report';
import { handoffFile, morningReportFile } from '../lib/boardroom/paths';
import { getBudgetState, selfReportAllowance } from '../lib/boardroom/budget';

let root: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'boardroom-docs-'));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('renderHandoff / writeHandoff', () => {
  it('includes every required section even for a brand-new task', () => {
    const task = createTask({ title: 'New feature', goal: 'Build the thing', priority: 'HIGH', phase: 'PHASE_2_CORE_EXPERIENCE_SYSTEM', primaryAgent: 'AGY', root });
    const content = renderHandoff(task);
    for (const heading of ['## TASK', '## GOAL', '## DECISIONS ALREADY MADE', '## STARTING COMMIT', '## LAST GOOD COMMIT', '## FILES TOUCHED', '## WHAT WAS IMPLEMENTED', '## TESTS PASSING', '## TESTS FAILING', '## ATTEMPTS THAT FAILED', '## WHY THEY FAILED', '## CURRENT BLOCKER', '## EXACT REMAINING WORK', '## CONFIDENCE', '## DO NOT RECONSIDER']) {
      expect(content).toContain(heading);
    }
    expect(content).toContain('New feature');
    expect(content).toContain('Build the thing');
  });

  it('surfaces decisions, failed attempts, and blockers accurately', () => {
    const task = createTask({ title: 'T', goal: 'G', priority: 'MEDIUM', phase: 'PHASE_1_RECON', primaryAgent: 'CLAUDE', root });
    recordDecision(task.taskId, { by: 'DUSTIN', summary: 'Use honor-system verification' }, root);
    recordAttempt(task.taskId, { agent: 'CLAUDE', approachSummary: 'Tried approach A', outcome: 'FAILED', whyFailed: 'Broke test X' }, root);
    recordTestResult(task.taskId, { command: 'npm test', passed: false, summary: '1 failing' }, root);
    checkpoint(task.taskId, { summary: 'Got partway', remainingWork: 'Finish approach B' }, root);

    const updated = getTask(task.taskId, root)!;
    const content = renderHandoff(updated);

    expect(content).toContain('Use honor-system verification');
    expect(content).toContain('Tried approach A');
    expect(content).toContain('Broke test X');
    expect(content).toContain('Finish approach B');
    expect(content).toContain('1 failing');
  });

  it('writeHandoff writes to boardroom/handoffs/<TASK_ID>.md under the given root', () => {
    const task = createTask({ title: 'T', goal: 'G', priority: 'LOW', phase: 'PHASE_1_RECON', primaryAgent: 'AGY', root });
    writeHandoff(task, root);
    const filePath = handoffFile(task.taskId, root);
    expect(fs.existsSync(filePath)).toBe(true);
    expect(fs.readFileSync(filePath, 'utf8')).toContain(task.taskId);
  });
});

describe('renderMorningReport / writeMorningReport', () => {
  it('never invents a usage number when none was self-reported', () => {
    const content = renderMorningReport({
      run: { runId: 'R1', branch: 'boardroom/astra-overnight-R1', baseCommit: 'abc123', startedAt: 't0', endedAt: 't1', sleepPrevention: { active: true, reason: 'ACTIVE (caffeinate -w 123)' }, stopReason: 'NO_MORE_READY_TASKS' },
      tasks: [],
      budget: getBudgetState(root),
      commits: [],
      actionsRequired: [],
    });
    expect(content).toMatch(/No self-report was recorded this run/);
    expect(content).not.toMatch(/\d+% remaining/);
  });

  it('reports a real self-reported allowance verbatim, not a derived guess', () => {
    const budget = selfReportAllowance(63, 'DUSTIN', root);
    const content = renderMorningReport({
      run: { runId: 'R1', branch: 'b', baseCommit: 'abc', startedAt: 't0', endedAt: 't1', sleepPrevention: { active: false, reason: 'NOT ACTIVE (not macOS)' }, stopReason: 'NO_MORE_READY_TASKS' },
      tasks: [],
      budget,
      commits: [],
      actionsRequired: [],
    });
    expect(content).toContain('63%');
    expect(content).toContain('CONSERVE');
  });

  it('surfaces ACTION REQUIRED items prominently', () => {
    const content = renderMorningReport({
      run: { runId: 'R1', branch: 'b', baseCommit: 'abc', startedAt: 't0', endedAt: 't1', sleepPrevention: { active: false, reason: 'NOT ACTIVE (not macOS)' }, stopReason: 'ALL_AGENTS_UNAVAILABLE' },
      tasks: [],
      budget: getBudgetState(root),
      commits: [],
      actionsRequired: ['ACTION REQUIRED: ASTRA RESET CREDIT #1.'],
    });
    expect(content).toContain('## ACTION REQUIRED');
    expect(content).toContain('ACTION REQUIRED: ASTRA RESET CREDIT #1.');
  });

  it('summarizes per-task status counts and lists commits made this run', () => {
    const t1 = createTask({ title: 'Done thing', goal: 'G', priority: 'HIGH', phase: 'PHASE_1_RECON', primaryAgent: 'CLAUDE', taskId: 'TASK-DONE', root });
    checkpoint(t1.taskId, { summary: 'Finished', remainingWork: 'None', status: 'DONE' }, root);
    const t2 = createTask({ title: 'Blocked thing', goal: 'G', priority: 'LOW', phase: 'PHASE_1_RECON', primaryAgent: 'AGY', taskId: 'TASK-BLOCKED', root });
    updateTaskStatus(t2.taskId, 'BLOCKED', root);

    const content = renderMorningReport({
      run: { runId: 'R1', branch: 'b', baseCommit: 'abc', startedAt: 't0', endedAt: 't1', sleepPrevention: { active: false, reason: 'NOT ACTIVE (not macOS)' }, stopReason: 'NO_MORE_READY_TASKS' },
      tasks: [getTask(t1.taskId, root)!, getTask(t2.taskId, root)!],
      budget: getBudgetState(root),
      commits: [{ hash: 'deadbeefcafefeed', subject: 'Did the thing' }],
      actionsRequired: [],
    });

    expect(content).toContain('Tasks done: 1');
    expect(content).toContain('Tasks blocked: 1');
    expect(content).toContain('Did the thing');
    expect(content).toContain('TASK-DONE');
    expect(content).toContain('TASK-BLOCKED');
  });

  it('writeMorningReport writes to boardroom/reports/MORNING_REPORT.md under the given root', () => {
    writeMorningReport(
      { run: { runId: 'R1', branch: 'b', baseCommit: 'abc', startedAt: 't0', endedAt: 't1', sleepPrevention: { active: false, reason: 'NOT ACTIVE (not macOS)' }, stopReason: 'NO_MORE_READY_TASKS' }, tasks: [], budget: getBudgetState(root), commits: [], actionsRequired: [] },
      root
    );
    expect(fs.existsSync(morningReportFile(root))).toBe(true);
  });
});

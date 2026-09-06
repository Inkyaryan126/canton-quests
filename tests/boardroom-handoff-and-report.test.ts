// Canton Quests Boardroom V2 — handoff doc + morning report generation tests.

import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTask, recordDecision, recordTestResult, checkpoint, getTask, updateTaskStatus, recordSalvage } from '../lib/boardroom/tasks';
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
    for (const heading of ['## TASK', '## GOAL', '## ACCEPTANCE CRITERIA', '## CHECKPOINT EXPECTATIONS', '## DECISIONS ALREADY MADE', '## STARTING COMMIT', '## LAST GOOD COMMIT', '## FILES TOUCHED', '## WHAT WAS IMPLEMENTED', '## TESTS PASSING', '## TESTS FAILING', '## ATTEMPTS THAT FAILED', '## WHY THEY FAILED', '## CURRENT BLOCKER', '## SALVAGED WORK', '## EXACT REMAINING WORK', '## CONFIDENCE', '## DO NOT RECONSIDER']) {
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

  it('reports "none" for salvaged work when nothing was ever salvaged, and renders real entries when present', () => {
    const task = createTask({ title: 'T', goal: 'G', priority: 'MEDIUM', phase: 'PHASE_1_RECON', primaryAgent: 'AGY', root });
    expect(renderHandoff(task)).toContain('none — no uncommitted edits from this task have ever needed salvaging');

    recordSalvage(task.taskId, { agent: 'AGY', attempt: 1, stashLabel: 'boardroom-salvage-x', tagRef: 'boardroom-salvage/TASK-x-attempt1', commitHash: 'deadbeef', pathsSalvaged: ['app/foo.tsx'], reason: 'BLOCKED: out-of-scope changes (app/foo.tsx)' }, root);
    const content = renderHandoff(getTask(task.taskId, root)!);
    expect(content).toContain('boardroom-salvage/TASK-x-attempt1');
    expect(content).toContain('app/foo.tsx');
    expect(content).toContain('git stash apply boardroom-salvage/TASK-x-attempt1');
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
      touchedThisRunTaskIds: [],
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
      touchedThisRunTaskIds: [],
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
      touchedThisRunTaskIds: [],
    });
    expect(content).toContain('## ACTION REQUIRED');
    expect(content).toContain('ACTION REQUIRED: ASTRA RESET CREDIT #1.');
  });

  it('counts SUMMARY only from tasks touched this run, never from prior/old history', () => {
    // Simulates the real bug: two old "rehearsal" tasks sit DONE/BLOCKED in the
    // ledger from a previous run, and this run only actually touches one new task.
    const oldDone = createTask({ title: 'Old rehearsal, done weeks ago', goal: 'G', priority: 'LOW', phase: 'PHASE_1_RECON', primaryAgent: 'AGY', taskId: 'TASK-OLD-DONE', root });
    checkpoint(oldDone.taskId, { summary: 'Finished long ago', remainingWork: 'None', status: 'DONE' }, root);
    const oldBlocked = createTask({ title: 'Old rehearsal, blocked weeks ago', goal: 'G', priority: 'LOW', phase: 'PHASE_1_RECON', primaryAgent: 'AGY', taskId: 'TASK-OLD-BLOCKED', root });
    updateTaskStatus(oldBlocked.taskId, 'BLOCKED', root);

    const thisRunTask = createTask({ title: 'Real task this run', goal: 'G', priority: 'HIGH', phase: 'PHASE_2_CORE_EXPERIENCE_SYSTEM', primaryAgent: 'CLAUDE', taskId: 'TASK-THIS-RUN', root });
    checkpoint(thisRunTask.taskId, { summary: 'Committed', remainingWork: 'None', status: 'DONE' }, root);

    const content = renderMorningReport({
      run: { runId: 'R2', branch: 'b', baseCommit: 'abc', startedAt: 't0', endedAt: 't1', sleepPrevention: { active: false, reason: 'NOT ACTIVE (not macOS)' }, stopReason: 'NO_MORE_READY_TASKS' },
      tasks: [getTask(oldDone.taskId, root)!, getTask(oldBlocked.taskId, root)!, getTask(thisRunTask.taskId, root)!],
      budget: getBudgetState(root),
      commits: [{ hash: 'deadbeefcafefeed', subject: 'Real commit this run' }],
      actionsRequired: [],
      touchedThisRunTaskIds: ['TASK-THIS-RUN'], // only the real task was actually picked up this run
    });

    // SUMMARY must reflect only the one task this run actually touched, not all 3.
    expect(content).toContain('Tasks completed this run: 1');
    expect(content).toContain('Tasks blocked this run: 0');
    expect(content).toContain('SUMMARY (this run only — 1 task(s) touched)');

    // The all-time QUEUE STATE section is where the old tasks show up instead.
    expect(content).toContain('Done (any run, ever): 2');
    expect(content).toContain('Blocked (any run, ever): 1');

    // Per-task sections are split accordingly.
    expect(content).toContain('## TASKS TOUCHED THIS RUN');
    expect(content).toContain('## OTHER TASKS IN THE QUEUE');
    const touchedSectionIdx = content.indexOf('## TASKS TOUCHED THIS RUN');
    const otherSectionIdx = content.indexOf('## OTHER TASKS IN THE QUEUE');
    const touchedSection = content.slice(touchedSectionIdx, otherSectionIdx);
    const otherSection = content.slice(otherSectionIdx);
    expect(touchedSection).toContain('TASK-THIS-RUN');
    expect(touchedSection).not.toContain('TASK-OLD-DONE');
    expect(touchedSection).not.toContain('TASK-OLD-BLOCKED');
    expect(otherSection).toContain('TASK-OLD-DONE');
    expect(otherSection).toContain('TASK-OLD-BLOCKED');
  });

  it('writeMorningReport writes to boardroom/reports/MORNING_REPORT.md under the given root', () => {
    writeMorningReport(
      { run: { runId: 'R1', branch: 'b', baseCommit: 'abc', startedAt: 't0', endedAt: 't1', sleepPrevention: { active: false, reason: 'NOT ACTIVE (not macOS)' }, stopReason: 'NO_MORE_READY_TASKS' }, tasks: [], budget: getBudgetState(root), commits: [], actionsRequired: [], touchedThisRunTaskIds: [] },
      root
    );
    expect(fs.existsSync(morningReportFile(root))).toBe(true);
  });
});

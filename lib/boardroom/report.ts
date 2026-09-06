/**
 * Canton Quests Boardroom V2 — morning executive report (Section 17).
 *
 * One consolidated report, not raw transcripts. Pure function of explicit
 * inputs so it's fully testable and can never invent a number (usage %,
 * reset-credit count, sleep-prevention state) that wasn't actually
 * self-reported or observed elsewhere in the run — every field here traces
 * back to a real Task/AstraBudgetState/AutonomousRunMarker value.
 */
import { morningReportFile } from './paths';
import { writeFileAtomic } from './atomicFile';
import type { Task, AstraBudgetState, TaskStatus } from './types';

export interface RunSummary {
  runId: string;
  branch: string;
  baseCommit: string;
  startedAt: string;
  endedAt: string;
  sleepPrevention: { active: boolean; reason: string };
  stopReason: string;
}

export interface MorningReportInput {
  run: RunSummary;
  tasks: Task[];
  budget: AstraBudgetState;
  /** Real commit log entries made by Boardroom during this run (hash + subject), newest last. */
  commits: Array<{ hash: string; subject: string }>;
  actionsRequired: string[];
}

function countByStatus(tasks: Task[], status: TaskStatus): number {
  return tasks.filter((t) => t.status === status).length;
}

export function renderMorningReport(input: MorningReportInput): string {
  const { run, tasks, budget, commits, actionsRequired } = input;
  const lines: string[] = [];

  lines.push('# CANTON QUESTS — BOARDROOM MORNING REPORT');
  lines.push('');
  lines.push(`Run: \`${run.runId}\` on branch \`${run.branch}\` (base \`${run.baseCommit.slice(0, 12)}\`)`);
  lines.push(`Window: ${run.startedAt} → ${run.endedAt}`);
  lines.push(`Sleep prevention: ${run.sleepPrevention.active ? 'ACTIVE' : 'NOT ACTIVE'} — ${run.sleepPrevention.reason}`);
  lines.push(`Stop reason: ${run.stopReason}`);
  lines.push('');

  lines.push('## ACTION REQUIRED');
  if (actionsRequired.length === 0) {
    lines.push('None. Nothing needs Dustin to act before reviewing results below.');
  } else {
    for (const a of actionsRequired) lines.push(`- ${a}`);
  }
  lines.push('');

  lines.push('## SUMMARY');
  lines.push(`- Tasks done: ${countByStatus(tasks, 'DONE')}`);
  lines.push(`- Tasks checkpointed (in progress, resumable): ${countByStatus(tasks, 'CHECKPOINTED')}`);
  lines.push(`- Tasks blocked: ${countByStatus(tasks, 'BLOCKED')}`);
  lines.push(`- Tasks rejected: ${countByStatus(tasks, 'REJECTED')}`);
  lines.push(`- Tasks still queued: ${countByStatus(tasks, 'QUEUED')}`);
  lines.push(`- Commits made by Boardroom this run: ${commits.length}`);
  lines.push('');

  lines.push('## ASTRA USAGE (self-reported only — never inferred)');
  lines.push(
    budget.allowanceRemainingPct === null
      ? '- No self-report was recorded this run. Treat Astra allowance as unknown, not full.'
      : `- Last self-reported allowance: ${budget.allowanceRemainingPct}% (tier ${budget.tier}), reported by ${budget.lastSelfReportedBy} at ${budget.lastSelfReportedAt}.`
  );
  lines.push(`- Reset credits used: ${budget.resetCreditsUsed}/${budget.resetCreditsTotal}.`);
  if (budget.resetHistory.length > 0) {
    for (const r of budget.resetHistory) lines.push(`  - Reset #${r.which} confirmed by ${r.confirmedBy} at ${r.confirmedAt}.`);
  }
  lines.push('');

  lines.push('## COMMITS THIS RUN');
  lines.push(commits.length ? commits.map((c) => `- \`${c.hash.slice(0, 12)}\` ${c.subject}`).join('\n') : '_none_');
  lines.push('');

  lines.push('## PER-TASK DETAIL');
  if (tasks.length === 0) {
    lines.push('_No tasks were queued this run._');
  } else {
    for (const t of tasks) {
      lines.push(`### ${t.taskId} — ${t.title}`);
      lines.push(`- Status: ${t.status} | Confidence: ${t.confidence} | Priority: ${t.priority} | Phase: ${t.phase}`);
      lines.push(`- Primary agent: ${t.primaryAgent}${t.fallbackAgent1 ? ` (fallback: ${t.fallbackAgent1}${t.fallbackAgent2 ? `, ${t.fallbackAgent2}` : ''})` : ''}`);
      if (t.currentCommit) lines.push(`- Current commit: \`${t.currentCommit.slice(0, 12)}\``);
      if (t.checkpointSummary) lines.push(`- What was done: ${t.checkpointSummary}`);
      if (t.remainingWork) lines.push(`- Remaining work: ${t.remainingWork}`);
      if (t.blockers.length) lines.push(`- Blockers: ${t.blockers.join('; ')}`);
      const failedAttempts = t.attempts.filter((a) => a.outcome === 'FAILED');
      if (failedAttempts.length) lines.push(`- Failed attempts: ${failedAttempts.length} (see handoff doc for detail)`);
      lines.push(`- Handoff doc: \`boardroom/handoffs/${t.taskId}.md\``);
      lines.push('');
    }
  }

  return lines.join('\n');
}

export function writeMorningReport(input: MorningReportInput, root?: string): string {
  const content = renderMorningReport(input);
  writeFileAtomic(morningReportFile(root), content);
  return content;
}

/**
 * Canton Quests Boardroom V2 — handoff doc generation (Section 4).
 *
 * Written only at a real handoff/completion event (agent unavailable,
 * task done, or explicit checkpoint requested) — not on every ledger
 * mutation, so boardroom/handoffs/ stays a small set of meaningful,
 * durable snapshots rather than git noise. Reads directly from the task's
 * CHECKPOINT_SUMMARY/REMAINING_WORK so a checkpoint and its handoff doc
 * can never drift apart.
 */
import { handoffFile } from './paths';
import { writeFileAtomic } from './atomicFile';
import type { Task } from './types';

export function renderHandoff(task: Task): string {
  const lines: string[] = [];
  lines.push(`# HANDOFF — ${task.taskId}: ${task.title}`);
  lines.push('');
  lines.push('## TASK');
  lines.push(task.title);
  lines.push('');
  lines.push('## GOAL');
  lines.push(task.goal);
  lines.push('');
  lines.push('## ACCEPTANCE CRITERIA');
  lines.push(task.acceptanceCriteria.length ? task.acceptanceCriteria.map((c) => `- ${c}`).join('\n') : '_none declared_');
  lines.push('');
  lines.push('## CHECKPOINT EXPECTATIONS');
  lines.push(task.checkpointExpectations || '_none declared_');
  lines.push('');
  lines.push('## DECISIONS ALREADY MADE');
  if (task.decisions.length === 0) {
    lines.push('_None recorded yet._');
  } else {
    for (const d of task.decisions) lines.push(`- [${d.at}] (${d.by}) ${d.summary}`);
  }
  lines.push('');
  lines.push('## STARTING COMMIT');
  lines.push(task.startingCommit || '_unknown_');
  lines.push('');
  lines.push('## LAST GOOD COMMIT');
  lines.push(task.currentCommit || '_none yet_');
  lines.push('');
  lines.push('## FILES TOUCHED');
  lines.push(task.filesTouched.length ? task.filesTouched.map((f) => `- ${f}`).join('\n') : '_none yet_');
  lines.push('');
  lines.push('## WHAT WAS IMPLEMENTED');
  lines.push(task.checkpointSummary || '_no checkpoint summary recorded_');
  lines.push('');
  lines.push('## TESTS PASSING');
  const passing = task.testResults.filter((t) => t.passed);
  lines.push(passing.length ? passing.map((t) => `- ${t.command}: ${t.summary}`).join('\n') : '_none recorded_');
  lines.push('');
  lines.push('## TESTS FAILING');
  const failing = task.testResults.filter((t) => !t.passed);
  lines.push(failing.length ? failing.map((t) => `- ${t.command}: ${t.summary}`).join('\n') : '_none_');
  lines.push('');
  lines.push('## ATTEMPTS THAT FAILED');
  const failedAttempts = task.attempts.filter((a) => a.outcome === 'FAILED');
  lines.push(
    failedAttempts.length
      ? failedAttempts.map((a) => `- [${a.at}] (${a.agent}) ${a.approachSummary}`).join('\n')
      : '_none recorded_'
  );
  lines.push('');
  lines.push('## WHY THEY FAILED');
  const whys = failedAttempts.filter((a) => a.whyFailed);
  lines.push(whys.length ? whys.map((a) => `- ${a.approachSummary}: ${a.whyFailed}`).join('\n') : '_not recorded_');
  lines.push('');
  lines.push('## CURRENT BLOCKER');
  lines.push(task.blockers.length ? task.blockers.map((b) => `- ${b}`).join('\n') : '_none_');
  lines.push('');
  lines.push('## EXACT REMAINING WORK');
  lines.push(task.remainingWork || '_not recorded_');
  lines.push('');
  lines.push('## CONFIDENCE');
  lines.push(task.confidence);
  lines.push('');
  lines.push('## DO NOT RECONSIDER');
  const settled = task.decisions.map((d) => d.summary);
  lines.push(settled.length ? settled.map((s) => `- ${s}`).join('\n') : '_no settled decisions recorded_');
  lines.push('');
  return lines.join('\n');
}

export function writeHandoff(task: Task, root?: string): string {
  const content = renderHandoff(task);
  writeFileAtomic(handoffFile(task.taskId, root), content);
  return content;
}

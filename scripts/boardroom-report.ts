/**
 * Regenerates boardroom/reports/MORNING_REPORT.md on demand from the
 * current task ledger and budget state, without running the supervisor.
 * Useful to check the report mid-run or after a manual intervention.
 *
 *   npm run boardroom:report
 */
import { execFileSync } from 'child_process';
import { listTasks } from '../lib/boardroom/tasks';
import { getBudgetState } from '../lib/boardroom/budget';
import { getMarker } from '../lib/boardroom/runLifecycle';
import { writeMorningReport } from '../lib/boardroom/report';

function currentCommit(): string {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

function main() {
  const tasks = listTasks();
  const budget = getBudgetState();
  const marker = getMarker();
  const head = currentCommit();

  const content = writeMorningReport({
    run: {
      runId: marker?.runId ?? '(no active run)',
      branch: marker?.branch ?? '(unknown)',
      baseCommit: head,
      startedAt: marker?.startedAt ?? '(unknown)',
      endedAt: new Date().toISOString(),
      sleepPrevention: { active: false, reason: 'Report regenerated on demand — sleep-prevention state reflects the run, not this command.' },
      stopReason: marker ? 'RUN_STILL_ACTIVE (report regenerated mid-run)' : 'MANUAL_REGENERATION',
    },
    tasks,
    budget,
    commits: [],
    actionsRequired: [],
  });

  console.log(content);
}

main();

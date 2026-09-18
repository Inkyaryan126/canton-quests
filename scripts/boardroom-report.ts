/**
 * Renders the current task ledger and budget state on demand, without
 * running the supervisor. By default this is preview-only; use --export when
 * a human deliberately wants to update the tracked checkout report.
 *
 *   npm run boardroom:report
 *   npm run boardroom:report -- --export
 */
import { execFileSync } from 'child_process';
import { listTasks } from '../lib/boardroom/tasks';
import { getBudgetState } from '../lib/boardroom/budget';
import { getMarker } from '../lib/boardroom/runLifecycle';
import { renderMorningReport, writeMorningReportExport } from '../lib/boardroom/report';

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

  const input = {
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
    // This is a manual, out-of-band regeneration, not a real runSupervisor()
    // call — it has no way to know which tasks a real run would have picked
    // up, so every task is honestly reported as "other" (untouched by any
    // run this command knows about) rather than guessing.
    touchedThisRunTaskIds: [],
  };

  const content = process.argv.includes('--export')
    ? writeMorningReportExport(input)
    : renderMorningReport(input);

  console.log(content);
}

main();

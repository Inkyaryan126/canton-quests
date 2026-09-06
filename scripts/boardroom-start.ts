/**
 * Canton Quests Boardroom V2 — the one command.
 *
 *   npm run boardroom:start
 *   npm run boardroom:start -- --override-branch-check --i-understand-this-runs-on-main
 *
 * Runs the full supervisor loop against the REAL repo, real git, and the
 * real codex/claude/agy CLIs. Do not run this against a repo with
 * uncommitted work you care about without reading boardroom/BOARDROOM.md
 * first — bootstrap refuses to proceed on a dirty tree, but it's still a
 * real autonomous run once it starts.
 */
import { runSupervisor } from '../lib/boardroom/supervisor';

async function main() {
  const args = process.argv.slice(2);
  const overrideBranchCheck = args.includes('--override-branch-check');
  const overrideConfirmed = args.includes('--i-understand-this-runs-on-main');
  const branchFlagIdx = args.indexOf('--branch');
  const branchOverrideName = branchFlagIdx !== -1 ? args[branchFlagIdx + 1] : undefined;

  const result = await runSupervisor({
    bootstrapOptions: { overrideBranchCheck, overrideConfirmed, branchOverrideName },
  });

  console.log('\n=== BOARDROOM RUN COMPLETE ===');
  console.log(`Stop reason: ${result.stopReason}`);
  console.log(`Run: ${result.runId ?? '(none — stopped before bootstrap)'}  Branch: ${result.branch ?? '(n/a)'}`);
  console.log(`Iterations: ${result.iterations}`);
  if (result.actionsRequired.length) {
    console.log('\nACTION REQUIRED:');
    for (const a of result.actionsRequired) console.log(`  - ${a}`);
  }
  if (result.reportPath) console.log(`\nFull report: ${result.reportPath}`);

  process.exit(result.ok ? 0 : 1);
}

main().catch((err) => {
  console.error('[boardroom:start] fatal error:', err);
  process.exit(1);
});

import fs from 'node:fs';
import path from 'node:path';
import { executeGridLaunchVerification, type LaunchReadinessReport, type VerificationStatus } from './grid-integration-verify';

// ANSI color codes
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const MAGENTA = '\x1b[35m';
const GRAY = '\x1b[90m';

function badgeFor(status: VerificationStatus): string {
  switch (status) {
    case 'PASS':
      return `${GREEN}${BOLD}[ PASS ]${RESET}`;
    case 'REAL_REGRESSION':
      return `${RED}${BOLD}[ REGRESSION ]${RESET}`;
    case 'BLOCKED_BY_ACTIVE_WORK':
      return `${YELLOW}${BOLD}[ BLOCKED ]${RESET}`;
    case 'FEATURE_NOT_INTEGRATED_YET':
      return `${CYAN}${BOLD}[ NOT YET ]${RESET}`;
    case 'KNOWN_PREEXISTING_FAILURE':
      return `${MAGENTA}${BOLD}[ KNOWN BASELINE ]${RESET}`;
  }
}

function printHumanDashboard(report: LaunchReadinessReport): void {
  console.log(`\n${BOLD}================================================================================${RESET}`);
  console.log(`${BOLD}                 THE GRID: LAUNCH READINESS VERIFICATION REPORT                 ${RESET}`);
  console.log(`${BOLD}================================================================================${RESET}`);
  console.log(`${GRAY}Timestamp : ${report.timestamp}`);
  console.log(`Base      : ${report.baseBranch}`);
  console.log(`Claims    : ${report.activeClaimsCount} active agent claims detected in Git registry${RESET}\n`);

  // KPI Bar
  const passStr = `${GREEN}${BOLD}${report.summary.PASS} PASS${RESET}`;
  const regStr = report.summary.REAL_REGRESSION > 0
    ? `${RED}${BOLD}${report.summary.REAL_REGRESSION} REGRESSIONS${RESET}`
    : `${GRAY}0 REGRESSIONS${RESET}`;
  const blockedStr = `${YELLOW}${BOLD}${report.summary.BLOCKED_BY_ACTIVE_WORK} BLOCKED BY ACTIVE WORK${RESET}`;
  const notYetStr = `${CYAN}${report.summary.FEATURE_NOT_INTEGRATED_YET} NOT INTEGRATED YET${RESET}`;
  const legacyStr = `${MAGENTA}${report.summary.KNOWN_PREEXISTING_FAILURE} KNOWN BASELINE FAILURES${RESET}`;

  console.log(`Summary: ${passStr} | ${regStr} | ${blockedStr} | ${notYetStr} | ${legacyStr}\n`);

  console.log(`${BOLD}--- VERIFICATION CHECKS & SUBSYSTEM AUDIT ---${RESET}`);
  for (const check of report.checks) {
    console.log(`  ${badgeFor(check.status)} ${BOLD}${check.name}${RESET}`);
    console.log(`           ${GRAY}Subsystem : ${check.subsystem}${RESET}`);
    console.log(`           ${GRAY}Evidence  : ${check.evidence}${RESET}`);
  }

  console.log(`\n${BOLD}--- INTEGRATION VERDICT ---${RESET}`);
  if (report.summary.REAL_REGRESSION > 0) {
    console.log(`${RED}${BOLD}❌ LAUNCH BLOCKED: ${report.summary.REAL_REGRESSION} real regression(s) detected.${RESET}`);
    console.log(`${RED}Please review and resolve real regressions before promoting branch.${RESET}\n`);
  } else {
    console.log(`${GREEN}${BOLD}✅ LAUNCH INTEGRATION CHECKPOINT READY${RESET}`);
    console.log(`${GREEN}All verified subsystems passed invariants. Active streams and unintegrated features are cleanly isolated.${RESET}\n`);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const jsonMode = args.includes('--json');

  const report = await executeGridLaunchVerification(process.cwd());

  // Save report artifact to .grid-output
  try {
    const outDir = path.resolve(process.cwd(), '.grid-output');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(
      path.join(outDir, 'launch-readiness-report.json'),
      JSON.stringify(report, null, 2),
      'utf8',
    );
  } catch (err) {
    // Non-fatal if output directory cannot be written
  }

  if (jsonMode) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printHumanDashboard(report);
  }

  process.exit(report.readyForIntegration ? 0 : 1);
}

main().catch((err) => {
  console.error('Fatal error during launch verification:', err);
  process.exit(1);
});

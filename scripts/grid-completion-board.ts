import { collectGridV1CompletionBoard } from '../lib/grid/completion-board/collect';
import { verifyGridV1FeatureTests } from '../lib/grid/completion-board/verify';

function value(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
}

function run(args: string[]): void {
  const json = args.includes('--json');
  const verifyTests = args.includes('--verify-tests');
  const integrationRef = value(args, '--integration-ref');
  if (verifyTests) verifyGridV1FeatureTests({ integrationRef });
  const board = collectGridV1CompletionBoard({ integrationRef });

  if (json) {
    process.stdout.write(JSON.stringify(board, null, 2) + '\n');
    return;
  }

  const s = board.summary;
  const lines = [
    'THE GRID — CANONICAL V1 COMPLETION BOARD',
    `Canonical: ${board.canonicalRef ?? 'unresolved'} @ ${board.canonicalCommit?.slice(0, 8) ?? 'unknown'}`,
    `Verified complete: ${s.complete}/${s.total} (${s.percent}%)`,
    `Remaining: ${s.remaining} | in progress ${s.inProgress} | verify ${s.needsVerification} | partial ${s.partial} | missing ${s.missing} | blocked ${s.blocked}`,
    '',
  ];
  for (const feature of board.features) {
    lines.push(`${feature.status.padEnd(18)} ${feature.id} — ${feature.title}`);
    lines.push(`  evidence: ${feature.evidence.join('; ')}`);
    if (feature.missingCode.length) lines.push(`  missing code: ${feature.missingCode.join(', ')}`);
    if (feature.missingTests.length) lines.push(`  missing tests: ${feature.missingTests.join(', ')}`);
    const failedTests = feature.testEvidence.filter((item) => !item.satisfied);
    if (failedTests.length) lines.push(`  test evidence: ${failedTests.map((item) => `${item.path}=${item.status}${item.current ? '' : '(stale)'}`).join(', ')}`);
    if (feature.blockedBy.length) lines.push(`  blocked by: ${feature.blockedBy.join(', ')}`);
  }
  if (board.warnings.length) lines.push('', ...board.warnings.map((warning) => `WARNING: ${warning}`));
  process.stdout.write(lines.join('\n') + '\n');
}

try {
  run(process.argv.slice(2));
} catch (error) {
  process.stderr.write((error instanceof Error ? error.message : String(error)) + '\n');
  process.exitCode = 1;
}

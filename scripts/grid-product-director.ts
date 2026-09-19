import { readClaims } from '../lib/agent-control';
import { collectGridMasterBoard } from '../lib/grid/master-board/collect';
import { collectPlayableLoopScore } from '../lib/grid/ops/playable-loop-score';
import { recommendGridProductWork } from '../lib/grid/ops/product-director';

function value(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
}

function run(args: string[]): void {
  const json = args.includes('--json');
  const limitValue = value(args, '--limit');
  const limit = limitValue === undefined ? 3 : Number(limitValue);
  if (!Number.isInteger(limit) || limit < 1) throw new Error('--limit requires a positive integer');
  const integrationRef = value(args, '--integration-ref');
  const board = collectGridMasterBoard({ integrationRef });
  const result = recommendGridProductWork({
    masterBoard: board,
    claims: readClaims(),
    limit,
    playableLoopScore: collectPlayableLoopScore({ cwd: process.cwd(), board }),
  });

  if (json) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return;
  }

  const lines = [
    'THE GRID — PRODUCT DIRECTOR',
    result.directorSummary,
    'Recommendations: ' + result.recommendations.length + '/' + result.limit,
  ];
  result.recommendations.forEach((item, index) => {
    lines.push(
      '',
      String(index + 1) + '. ' + item.title + ' [' + item.id + '] — ' + item.actionType,
      '   why now: ' + item.whyNow,
      '   dependency context: ' + item.dependencyContext.join('; '),
      '   evidence: ' + item.evidence.join('; '),
      '   specialization: ' + item.specialization,
      '   acceptance: ' + item.acceptanceCriteria.join('; '),
      '   scope: ' + (item.scopeHints.length ? item.scopeHints.join(', ') : 'derive exact file scope before claim; do not guess'),
    );
  });
  process.stdout.write(lines.join('\n') + '\n');
}

try {
  run(process.argv.slice(2));
} catch (error) {
  process.stderr.write((error instanceof Error ? error.message : String(error)) + '\n');
  process.exitCode = 1;
}

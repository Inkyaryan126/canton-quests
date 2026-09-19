import { collectGridMasterBoard } from '../lib/grid/master-board/collect';
import { prioritizeGridMasterBoard } from '../lib/grid/master-board/prioritize';

interface ParsedArgs {
  json: boolean;
  limit: number;
  integrationRef?: string;
}

function parseArgs(args: string[]): ParsedArgs {
  let json = false;
  let limit = 5;
  let integrationRef: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--json') {
      json = true;
    } else if (arg === '--limit') {
      const value = Number(args[index + 1]);
      if (!Number.isInteger(value) || value < 1) throw new Error('--limit requires a positive integer');
      limit = value;
      index += 1;
    } else if (arg === '--integration-ref') {
      integrationRef = args[index + 1];
      if (!integrationRef) throw new Error('--integration-ref requires a ref value');
      index += 1;
    } else {
      throw new Error(`Unknown Grid prioritizer option: ${arg}`);
    }
  }
  return { json, limit, integrationRef };
}

export function renderGridPrioritizerText(result: ReturnType<typeof prioritizeGridMasterBoard>): string {
  const lines = [
    'THE GRID — TASK PRIORITIES',
    `Generated: ${result.generatedAt}`,
    `Integration ref: ${result.integrationRef ?? 'UNKNOWN'}`,
    `Actionable statuses: ${result.actionableStatuses.join(', ')}`,
    `Top ${result.recommendations.length} of limit ${result.limit}`,
  ];
  result.recommendations.forEach((item, index) => {
    const b = item.score.breakdown;
    lines.push(
      '',
      `${index + 1}. ${item.title} [${item.id}] — score ${item.score.total} (${item.status})`,
      `   score: player=${b.playerImpact} unlock=${b.dependencyUnlock} launch=${b.launchValue} urgency=${b.urgency} phase=${b.phaseWeight} risk=-${b.coordinationRiskPenalty}`,
      `   dependencies: ${item.dependencies.length > 0 ? item.dependencies.map((id) => `${id}=${item.dependencyStatuses[id]}`).join(', ') : 'none'}`,
      `   downstream unlocks: ${item.downstreamUnlocks.length > 0 ? item.downstreamUnlocks.join(', ') : 'none'}`,
      `   why now: ${item.whyNow}`,
    );
  });
  return `${lines.join('\n')}\n`;
}

export function runGridPrioritizeCli(args: string[]): number {
  const parsed = parseArgs(args);
  const board = collectGridMasterBoard({ integrationRef: parsed.integrationRef });
  const result = prioritizeGridMasterBoard(board, undefined, { limit: parsed.limit });
  process.stdout.write(parsed.json ? `${JSON.stringify(result, null, 2)}\n` : renderGridPrioritizerText(result));
  return 0;
}

try {
  const code = runGridPrioritizeCli(process.argv.slice(2));
  if (code !== 0) process.exitCode = code;
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

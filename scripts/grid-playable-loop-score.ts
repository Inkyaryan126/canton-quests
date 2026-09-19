import { collectGridMasterBoard } from '../lib/grid/master-board/collect';
import { collectPlayableLoopScore } from '../lib/grid/ops/playable-loop-score';

interface Options {
  json: boolean;
  integrationRef?: string;
}

function parseArgs(args: string[]): Options {
  let json = false;
  let integrationRef: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--json') {
      json = true;
    } else if (arg === '--integration-ref') {
      integrationRef = args[index + 1];
      if (!integrationRef) throw new Error('--integration-ref requires a ref value');
      index += 1;
    } else if (arg !== '--text') {
      throw new Error(`Unknown Grid Playable Loop Score option: ${arg}`);
    }
  }
  return { json, integrationRef };
}

function renderText(score: ReturnType<typeof collectPlayableLoopScore>): string {
  const lines = [
    `THE GRID — PLAYABLE LOOP SCORE: ${score.score}/100 (${score.status})`,
    `Integration ref: ${score.integrationRef ?? 'UNKNOWN'}`,
    '',
    ...score.stages.map((stage) =>
      `${stage.status.padEnd(6)} ${String(stage.contribution).padStart(4)}/${stage.weight} ${stage.title} — ${stage.evidence.join('; ')} [${stage.verification}]`,
    ),
  ];
  if (score.highestValueBrokenLink) {
    lines.push(
      '',
      `HIGHEST-VALUE BROKEN LINK: ${score.highestValueBrokenLink.title} (-${score.highestValueBrokenLink.lostPoints})`,
      `NEXT REPAIR: ${score.highestValueBrokenLink.recommendation}`,
    );
  } else {
    lines.push('', 'HIGHEST-VALUE BROKEN LINK: none');
  }
  return `${lines.join('\n')}\n`;
}

try {
  const options = parseArgs(process.argv.slice(2));
  const board = collectGridMasterBoard({
    cwd: process.cwd(),
    integrationRef: options.integrationRef,
  });
  const score = collectPlayableLoopScore({ cwd: process.cwd(), board });
  process.stdout.write(options.json ? `${JSON.stringify(score, null, 2)}\n` : renderText(score));
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}

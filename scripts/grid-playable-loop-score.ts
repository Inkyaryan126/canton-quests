import { collectGridMasterBoard } from '../lib/grid/master-board/collect';
import {
  collectPlayableLoopScore,
  type PlayableLoopStageEvidence,
} from '../lib/grid/ops/playable-loop-score';
import {
  runtimeEvidenceFromGridPlayerEntryReport,
  verifyGridPlayerEntryRuntime,
} from '../lib/grid/ops/player-entry-runtime';

interface Options {
  json: boolean;
  verifyEntryRuntime: boolean;
  integrationRef?: string;
}

function parseArgs(args: string[]): Options {
  let json = false;
  let verifyEntryRuntime = false;
  let integrationRef: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--json') {
      json = true;
    } else if (arg === '--verify-entry-runtime') {
      verifyEntryRuntime = true;
    } else if (arg === '--integration-ref') {
      integrationRef = args[index + 1];
      if (!integrationRef) throw new Error('--integration-ref requires a ref value');
      index += 1;
    } else if (arg !== '--text') {
      throw new Error(`Unknown Grid Playable Loop Score option: ${arg}`);
    }
  }
  return { json, verifyEntryRuntime, integrationRef };
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

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const board = collectGridMasterBoard({
    cwd: process.cwd(),
    integrationRef: options.integrationRef,
  });

  let entryRuntimeEvidence: PlayableLoopStageEvidence | undefined;
  if (options.verifyEntryRuntime) {
    const report = await verifyGridPlayerEntryRuntime({ cwd: process.cwd() });
    entryRuntimeEvidence = runtimeEvidenceFromGridPlayerEntryReport(report);
  }

  const score = collectPlayableLoopScore({
    cwd: process.cwd(),
    board,
    runtimeEvidence: entryRuntimeEvidence
      ? { entry: entryRuntimeEvidence }
      : undefined,
  });
  process.stdout.write(
    options.json ? `${JSON.stringify(score, null, 2)}\n` : renderText(score),
  );
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

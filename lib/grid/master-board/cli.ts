import { collectGridMasterBoard } from './collect';
import {
  renderMasterBoardMarkdown,
  renderMasterBoardText,
  serializeMasterBoardJson,
  writeMasterBoardSnapshot,
} from './render';

export interface GridMasterBoardCliIo {
  cwd: string;
  stdout: (value: string) => void;
  stderr: (value: string) => void;
}

interface ParsedArgs {
  format: 'text' | 'json' | 'markdown';
  snapshot: boolean;
  integrationRef?: string;
}

function parseArgs(args: string[]): ParsedArgs {
  let format: ParsedArgs['format'] = 'text';
  let formatExplicit = false;
  let snapshot = false;
  let integrationRef: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--snapshot') {
      snapshot = true;
      continue;
    }
    if (arg === '--json' || arg === '--markdown') {
      if (formatExplicit) throw new Error('Choose only one output format: --json or --markdown');
      format = arg === '--json' ? 'json' : 'markdown';
      formatExplicit = true;
      continue;
    }
    if (arg === '--integration-ref') {
      const value = args[index + 1];
      if (!value) throw new Error('--integration-ref requires a ref value');
      integrationRef = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown Grid Master Board option: ${arg}`);
  }

  return { format, snapshot, integrationRef };
}

export function runGridMasterBoardCli(
  args: string[],
  io: GridMasterBoardCliIo = {
    cwd: process.cwd(),
    stdout: (value) => process.stdout.write(value),
    stderr: (value) => process.stderr.write(value),
  },
): number {
  const parsed = parseArgs(args);
  const board = collectGridMasterBoard({ cwd: io.cwd, integrationRef: parsed.integrationRef });

  const output = parsed.format === 'json'
    ? serializeMasterBoardJson(board)
    : parsed.format === 'markdown'
      ? renderMasterBoardMarkdown(board)
      : renderMasterBoardText(board);
  io.stdout(output);

  if (parsed.snapshot) {
    const snapshot = writeMasterBoardSnapshot(board, io.cwd);
    io.stderr(`Snapshot JSON: ${snapshot.jsonPath}\nSnapshot Markdown: ${snapshot.markdownPath}\n`);
  }

  return 0;
}

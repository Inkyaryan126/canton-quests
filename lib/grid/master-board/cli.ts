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
  watchIterations?: number;
}

interface ParsedArgs {
  format: 'text' | 'json' | 'markdown';
  snapshot: boolean;
  deep: boolean;
  hygiene: boolean;
  watch: boolean;
  watchOnce: boolean;
  interval?: number;
  integrationRef?: string;
}

function parseArgs(args: string[]): ParsedArgs {
  let format: ParsedArgs['format'] = 'text';
  let formatExplicit = false;
  let snapshot = false;
  let deep = false;
  let hygiene = false;
  let watch = false;
  let watchOnce = false;
  let interval: number | undefined;
  let integrationRef: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--snapshot') {
      snapshot = true;
      continue;
    }
    if (arg === '--deep') {
      deep = true;
      continue;
    }
    if (arg === '--hygiene') {
      hygiene = true;
      continue;
    }
    if (arg === '--watch') {
      watch = true;
      continue;
    }
    if (arg === '--once' || arg === '--watch-once') {
      watchOnce = true;
      continue;
    }
    if (arg === '--interval') {
      const val = parseInt(args[index + 1], 10);
      if (Number.isNaN(val) || val <= 0) throw new Error('--interval requires a positive integer');
      interval = val;
      index += 1;
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

  return { format, snapshot, deep, hygiene, watch, watchOnce, interval, integrationRef };
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

  if (parsed.watch) {
    const intervalSec = parsed.interval ?? 3;
    const maxIterations = io.watchIterations ?? (parsed.watchOnce ? 1 : Infinity);
    let iterations = 0;

    const renderTick = () => {
      const board = collectGridMasterBoard({
        cwd: io.cwd,
        integrationRef: parsed.integrationRef,
        deep: parsed.deep,
        includeHygiene: parsed.hygiene,
      });
      if (typeof process !== 'undefined' && process.stdout && process.stdout.isTTY) {
        io.stdout('\x1b[2J\x1b[H');
      }
      io.stdout(renderMasterBoardText(board));
    };

    renderTick();
    iterations += 1;
    if (iterations >= maxIterations) {
      return 0;
    }

    const timer = setInterval(() => {
      renderTick();
      iterations += 1;
      if (iterations >= maxIterations) {
        clearInterval(timer);
      }
    }, intervalSec * 1000);

    const cleanup = () => {
      clearInterval(timer);
      process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    return 0;
  }

  const board = collectGridMasterBoard({
    cwd: io.cwd,
    integrationRef: parsed.integrationRef,
    deep: parsed.deep,
    includeHygiene: parsed.hygiene,
  });

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

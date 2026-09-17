import { runGridMasterBoardCli } from '../lib/grid/master-board/cli';

try {
  const code = runGridMasterBoardCli(process.argv.slice(2));
  if (code !== 0) process.exitCode = code;
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

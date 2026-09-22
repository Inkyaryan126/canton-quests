import path from 'node:path';
import { issueGridBuilderLaunchToken } from '../lib/grid/ops/grid-builder-os';

function flag(name: string): string | undefined {
  const args = process.argv.slice(2);
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
}

const cwd = path.resolve(flag('cwd') ?? process.cwd());
process.stdout.write(issueGridBuilderLaunchToken(cwd));

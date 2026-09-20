import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export interface PreferredLocalBinaryOptions {
  homeDir?: string;
  pathEnv?: string;
  override?: string | null;
  fallbackCandidates?: string[];
}

function nodeVersionParts(value: string): number[] {
  const match = value.match(/^v?(\d+)\.(\d+)\.(\d+)/);
  return match ? match.slice(1).map(Number) : [0, 0, 0];
}

function compareNodeVersionsDesc(a: string, b: string): number {
  const av = nodeVersionParts(a);
  const bv = nodeVersionParts(b);
  for (let index = 0; index < 3; index += 1) {
    if (av[index] !== bv[index]) return bv[index] - av[index];
  }
  return b.localeCompare(a);
}

function executable(filename: string): boolean {
  try {
    fs.accessSync(filename, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export function resolvePreferredLocalBinary(
  name: string,
  options: PreferredLocalBinaryOptions = {},
): string | null {
  const homeDir = options.homeDir ?? os.homedir();
  const pathEnv = options.pathEnv ?? process.env.PATH ?? '';
  const candidates: string[] = [];
  if (options.override) candidates.push(options.override);

  const nvmVersions = path.join(homeDir, '.nvm', 'versions', 'node');
  try {
    for (const version of fs.readdirSync(nvmVersions).sort(compareNodeVersionsDesc)) {
      candidates.push(path.join(nvmVersions, version, 'bin', name));
    }
  } catch {
    // NVM is optional. PATH and fallback candidates remain available.
  }

  for (const directory of pathEnv.split(path.delimiter).filter(Boolean)) {
    candidates.push(path.join(directory, name));
  }
  candidates.push(...(options.fallbackCandidates ?? []));

  for (const candidate of Array.from(new Set(candidates))) {
    if (executable(candidate)) return candidate;
  }
  return null;
}

export function resolvePreferredLocalNodeBinary(
  options: Omit<PreferredLocalBinaryOptions, 'override' | 'fallbackCandidates'> & {
    env?: NodeJS.ProcessEnv;
    currentExecPath?: string;
  } = {},
): string {
  const env = options.env ?? process.env;
  return resolvePreferredLocalBinary('node', {
    homeDir: options.homeDir,
    pathEnv: options.pathEnv ?? env.PATH,
    override: env.GRID_RUNTIME_NODE_BIN,
    fallbackCandidates: [options.currentExecPath ?? process.execPath],
  }) ?? (options.currentExecPath ?? process.execPath);
}

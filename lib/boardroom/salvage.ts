/**
 * Canton Quests Boardroom V2 — contamination-safe salvage.
 *
 * Every blocked/failed task's source edits are quarantined before another
 * agent may run. The snapshot is verified by identity and by a clean-path
 * check; Boardroom stops if any part of the preservation cannot be proven.
 */
import type { GitOps } from './supervisor';
import type { AgentName, SalvageEntry } from './types';

export interface SalvageParams {
  taskId: string;
  agent: AgentName;
  attempt: number;
  runId: string;
  paths: string[];
  reason: string;
}

function safeRevParse(git: GitOps, ref: string): string {
  try {
    return git.run(['rev-parse', '-q', '--verify', ref]).trim();
  } catch {
    return '';
  }
}

export function salvageWorkingTree(git: GitOps, params: SalvageParams): Omit<SalvageEntry, 'at'> | null {
  const paths = Array.from(new Set(params.paths)).filter(Boolean);
  if (paths.length === 0) return null;

  const stashLabel = `boardroom-salvage-${params.taskId}-${params.agent}-attempt${params.attempt}-${params.runId}`;
  const priorStash = safeRevParse(git, 'refs/stash');

  git.run(['stash', 'push', '-u', '-m', stashLabel, '--', ...paths]);

  const commitHash = safeRevParse(git, 'refs/stash');
  if (!commitHash || commitHash === priorStash) {
    throw new Error(`git stash did not create a new recovery object for ${params.taskId}; refusing to reuse an older stash`);
  }

  const tagRef = `boardroom-salvage/${params.runId}/${params.taskId}-attempt${params.attempt}`;
  // Deliberately NO -f: overwriting an earlier recovery pointer would destroy provenance.
  git.run(['tag', tagRef, commitHash]);

  const verifiedTag = safeRevParse(git, `refs/tags/${tagRef}`);
  if (verifiedTag !== commitHash) {
    throw new Error(`recovery tag verification failed for ${params.taskId}`);
  }

  const stillDirty = git.run(['status', '--short', '--', ...paths]).trim();
  if (stillDirty) {
    throw new Error(`recovery object ${commitHash.slice(0, 12)} exists, but salvaged paths are still dirty: ${stillDirty.replace(/\n/g, ', ')}`);
  }

  return {
    agent: params.agent,
    attempt: params.attempt,
    stashLabel,
    tagRef,
    commitHash,
    pathsSalvaged: paths,
    reason: params.reason,
  };
}

export function describeSalvage(entry: Omit<SalvageEntry, 'at'>): string {
  return `Edits preserved — inspect with \`git stash show -p -u ${entry.tagRef}\`; recover deliberately with \`git stash apply ${entry.tagRef}\` (never auto-applied by Boardroom). Paths: ${entry.pathsSalvaged.join(', ')}.`;
}

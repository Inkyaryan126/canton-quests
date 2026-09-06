/**
 * Canton Quests Boardroom V2 — contamination-safe salvage.
 *
 * Fixes a real bug from the first overnight run: a blocked/failed task left
 * its uncommitted edits sitting in the shared working tree, and every
 * subsequent task's `git status` picked them up too, so their own
 * out-of-scope check blamed files a completely different agent had written.
 * The fix is mechanical, not a policy reminder: BEFORE the next task can
 * run, the current task's edits are moved into a Boardroom-owned git stash
 * (which, as a side effect of `git stash push`, also restores the working
 * tree to the last clean commit) and a stable tag is left pointing at it so
 * the snapshot survives independently of the shifting `stash@{N}` index —
 * never silently discarded, never left behind to contaminate the next run.
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

/**
 * Stashes exactly the given paths (tracked + untracked, via `-u`) under a
 * unique, human-readable label, tags the resulting stash commit with a
 * stable ref, and returns the record to attach to the task. Returns null
 * only when there was nothing to salvage (paths is empty) — never swallows
 * a real git failure, which is thrown so the caller can stop the run rather
 * than silently proceed on a tree that might still be dirty.
 */
export function salvageWorkingTree(git: GitOps, params: SalvageParams): Omit<SalvageEntry, 'at'> | null {
  if (params.paths.length === 0) return null;

  const stashLabel = `boardroom-salvage-${params.taskId}-${params.agent}-attempt${params.attempt}-${params.runId}`;
  git.run(['stash', 'push', '-u', '-m', stashLabel, '--', ...params.paths]);

  const commitHash = git.run(['rev-parse', 'stash@{0}']).trim();
  const tagRef = `boardroom-salvage/${params.taskId}-attempt${params.attempt}`;
  git.run(['tag', '-f', tagRef, commitHash]);

  return {
    agent: params.agent,
    attempt: params.attempt,
    stashLabel,
    tagRef,
    commitHash,
    pathsSalvaged: params.paths,
    reason: params.reason,
  };
}

/**
 * Human-readable recovery instructions for a salvage entry, used in
 * blockers/handoff text. A stash is a multi-parent merge-style commit, so
 * `git stash show` (not plain `git show`, which shows no diffstat for a
 * merge by default) is the command that actually displays its content.
 */
export function describeSalvage(entry: Omit<SalvageEntry, 'at'>): string {
  return `Edits preserved — inspect with \`git stash show -p -u ${entry.tagRef}\` (the \`-u\` matters if any of these paths were brand-new/untracked files; omit \`-p\` for just a stat summary); recover deliberately with \`git stash apply ${entry.tagRef}\` (never auto-applied by Boardroom). Paths: ${entry.pathsSalvaged.join(', ')}.`;
}

/**
 * Canton Quests Boardroom V2 — Boardroom owns every commit.
 *
 * Agents edit files while holding the write lease; they never stage or
 * commit their own work. This is the pure decision function the
 * supervisor calls immediately after an agent's turn, BEFORE running any
 * validation — an out-of-scope result is blocked on the spot rather than
 * wasting a test run on work that's about to be rejected anyway.
 */

export interface CommitGateResult {
  decision: 'COMMIT' | 'BLOCK';
  inScope: string[];
  outOfScope: string[];
}

/**
 * A changed path is in-scope if writeScope is empty/undeclared (open task,
 * everything is accepted but still explicitly enumerated — never `-A`), or
 * if it starts with one of the declared scope prefixes.
 */
function pathInScope(changedPath: string, writeScope: string[]): boolean {
  if (writeScope.length === 0) return true;
  return writeScope.some((scope) => changedPath === scope || changedPath.startsWith(scope.endsWith('/') ? scope : scope + '/') || changedPath.startsWith(scope));
}

/**
 * Boardroom's own bookkeeping writes (handoff docs, the morning report) are
 * never subject to an agent's WRITE_SCOPE — an agent didn't produce them,
 * Boardroom did, after the agent's turn. Without this exclusion, a handoff
 * doc written for one task would show up as an "out-of-scope" change on the
 * very next task's gate check within the same run. `.boardroom/runtime/` is
 * additionally gitignored in the real repo so it never reaches `git status`
 * at all; this check also covers it defensively for any environment where
 * that ignore rule isn't present (e.g. an isolated test repo).
 */
export function isBoardroomBookkeepingPath(changedPath: string): boolean {
  return changedPath.startsWith('.boardroom/') || changedPath.startsWith('boardroom/handoffs/') || changedPath.startsWith('boardroom/reports/');
}

export function evaluateChangedPaths(writeScope: string[], actualChangedPaths: string[]): CommitGateResult {
  const inScope: string[] = [];
  const outOfScope: string[] = [];
  for (const p of actualChangedPaths) {
    if (pathInScope(p, writeScope)) inScope.push(p);
    else outOfScope.push(p);
  }
  return {
    decision: outOfScope.length > 0 ? 'BLOCK' : 'COMMIT',
    inScope,
    outOfScope,
  };
}

/**
 * Parses `git status --short` output into a flat list of changed paths
 * (staged or unstaged, added/modified/deleted/renamed). Renames ("R  old ->
 * new") are reported as the new path, since that's what needs `git add`.
 */
export function parseGitStatusShort(output: string): string[] {
  return output
    .split('\n')
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map((line) => {
      const rest = line.slice(3); // two status chars + one space
      const arrowIdx = rest.indexOf(' -> ');
      return arrowIdx === -1 ? rest.trim() : rest.slice(arrowIdx + 4).trim();
    });
}

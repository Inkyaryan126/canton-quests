import { execFileSync } from 'node:child_process';
import {
  boardroomSummary,
  coordinationIssues,
  listWorktreeStates,
  readClaims,
  staleClaim,
} from '../../agent-control';
import type { AgentClaim, BoardroomTaskSummary, WorktreeState } from '../../agent-control';
import { classifyMilestone } from './classify';
import { GRID_MILESTONES } from './milestones';
import type {
  GridBranchEvidence,
  GridCommitEvidence,
  GridMasterBoard,
  GridMilestoneDefinition,
  GridMilestoneEvidence,
} from './types';

function git(cwd: string, args: string[], allowFailure = false): string | null {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch (error) {
    if (allowFailure) return null;
    throw error;
  }
}

function refExists(cwd: string, ref: string): boolean {
  return git(cwd, ['rev-parse', '--verify', '--quiet', ref], true) !== null;
}

function containsPattern(value: string, patterns: string[]): boolean {
  const haystack = value.toLowerCase();
  return patterns.some((pattern) => haystack.includes(pattern.toLowerCase()));
}
function localBranches(cwd: string): string[] {
  const raw = git(cwd, ['for-each-ref', '--format=%(refname:short)', 'refs/heads']) ?? '';
  return raw.split('\n').map((line) => line.trim()).filter(Boolean);
}

function commitsForRef(cwd: string, ref: string, cache: Map<string, GridCommitEvidence[]>): GridCommitEvidence[] {
  const cached = cache.get(ref);
  if (cached) return cached;
  const raw = git(cwd, ['log', '--format=%H%x09%s', ref], true) ?? '';
  const commits = raw.split('\n').filter(Boolean).map((line) => {
    const tab = line.indexOf('\t');
    const commit = tab === -1 ? line : line.slice(0, tab);
    const subject = tab === -1 ? '' : line.slice(tab + 1);
    return { commit, subject, onLocalMain: false, onOriginMain: false };
  });
  cache.set(ref, commits);
  return commits;
}

function isAncestor(cwd: string, commit: string, ref: string | null): boolean {
  if (!ref) return false;
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', commit, ref], { cwd, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function resolveIntegrationRef(cwd: string, explicitRef?: string): string | null {
  if (explicitRef) return refExists(cwd, explicitRef) ? explicitRef : null;
  const candidates = localBranches(cwd).filter((branch) => /^grid-integration-\d{8}$/.test(branch)).sort();
  return candidates.at(-1) ?? null;
}
function firstCompletionMatch(
  commits: GridCommitEvidence[],
  milestone: GridMilestoneDefinition,
): GridCommitEvidence | undefined {
  return commits.find((commit) => containsPattern(commit.subject, milestone.integrationCommitSignals));
}

function milestoneEvidence(
  cwd: string,
  milestone: GridMilestoneDefinition,
  integrationRef: string | null,
  localMainRef: string | null,
  originMainRef: string | null,
  commitCache: Map<string, GridCommitEvidence[]>,
  claims: AgentClaim[],
  worktrees: WorktreeState[],
  boardroom: BoardroomTaskSummary,
  allBranches: string[],
): GridMilestoneEvidence {
  const worktreeByBranch = new Map(worktrees.map((item) => [item.branch, item]));

  const activeClaims = claims
    .filter((claim) => containsPattern(claim.lane, milestone.lanePatterns) || containsPattern(claim.branch, milestone.branchPatterns))
    .map((claim) => ({ lane: claim.lane, owner: claim.owner, branch: claim.branch, stale: staleClaim(claim) }));

  const branches: GridBranchEvidence[] = [];
  for (const branch of allBranches.filter((name) => containsPattern(name, milestone.branchPatterns))) {
    if (branch === integrationRef) continue;
    const match = firstCompletionMatch(commitsForRef(cwd, branch, commitCache), milestone);
    if (!match) continue;
    const worktree = worktreeByBranch.get(branch);
    branches.push({
      branch,
      clean: !worktree || worktree.dirtyPaths.length === 0,
      completionCommit: match.commit,
      completionSubject: match.subject,
      mergedIntoIntegration: isAncestor(cwd, match.commit, integrationRef),
      onLocalMain: isAncestor(cwd, match.commit, localMainRef),
      onOriginMain: isAncestor(cwd, match.commit, originMainRef),
    });
  }
  const integrationMatches: GridCommitEvidence[] = [];
  if (integrationRef) {
    const match = firstCompletionMatch(commitsForRef(cwd, integrationRef, commitCache), milestone);
    if (match) {
      integrationMatches.push({
        ...match,
        onLocalMain: isAncestor(cwd, match.commit, localMainRef),
        onOriginMain: isAncestor(cwd, match.commit, originMainRef),
      });
    }
  }

  const blockers = boardroom.blocked
    .filter((task) => containsPattern(task.taskId, [milestone.id, ...milestone.lanePatterns]) || containsPattern(task.title, [milestone.title, milestone.id]))
    .map((task) => `${task.taskId}: ${task.title}`);

  return {
    activeClaims,
    branches,
    integrationMatches,
    blockers,
    warnings: [],
    contradictions: [],
  };
}

export function collectGridMasterBoard(options: {
  cwd?: string;
  integrationRef?: string;
  now?: Date;
} = {}): GridMasterBoard {
  const cwd = options.cwd ?? process.cwd();
  const now = options.now ?? new Date();
  const integrationRef = resolveIntegrationRef(cwd, options.integrationRef);
  const localMainRef = refExists(cwd, 'refs/heads/main') ? 'main' : null;
  const originMainRef = refExists(cwd, 'refs/remotes/origin/main') ? 'origin/main' : null;
  const integrationCommit = integrationRef ? git(cwd, ['rev-parse', integrationRef], true) : null;
  const claims = readClaims(cwd);
  const worktrees = listWorktreeStates(cwd);
  const boardroom = boardroomSummary(cwd);
  const issues = coordinationIssues(claims, worktrees, boardroom);
  const commitCache = new Map<string, GridCommitEvidence[]>();
  const allBranches = localBranches(cwd);

  const milestones = GRID_MILESTONES.map((milestone) => classifyMilestone(
    milestone,
    milestoneEvidence(
      cwd, milestone, integrationRef, localMainRef, originMainRef, commitCache,
      claims, worktrees, boardroom, allBranches,
    ),
  ));

  return {
    version: 1,
    health: {
      generatedAt: now.toISOString(),
      integrationRef,
      integrationCommit,
      localMainAvailable: localMainRef !== null,
      originMainAvailable: originMainRef !== null,
      boardroomAutonomousRunActive: boardroom.autonomousRunActive,
      liveClaimCount: claims.length,
      staleClaimCount: claims.filter((claim) => staleClaim(claim)).length,
      coordinationWarnings: issues.map((issue) => ({ code: issue.code, message: issue.message })),
    },
    milestones,
  };
}

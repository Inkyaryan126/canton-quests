import { execFileSync } from 'node:child_process';
import path from 'node:path';
import {
  auditWorkspaceHygiene,
  boardroomSummary,
  coordinationIssues,
  isAncestor as gitIsAncestor,
  listWorktreeStates,
  readClaims,
  staleClaim,
} from '../../agent-control';
import type { AgentClaim, BoardroomTaskSummary, WorkspaceHygieneReport, WorktreeState } from '../../agent-control';
import { applyDependencyBlockers, classifyMilestone, promoteSafeNextWork } from './classify';
import { GRID_MILESTONES } from './milestones';
import type {
  GridBoardHealth,
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

const CANONICAL_INTEGRATION_PATTERN = /^grid-canonical-integration-\d{8}$/;
const LEGACY_INTEGRATION_PATTERN = /^grid-integration-\d{8}$/;

// Canonical integration branches supersede the legacy naming convention; only fall
// back to legacy candidates when no canonical branch exists, so evidence collection
// never resolves to a stale integration ref while newer canonical history exists.
function integrationCandidatesFrom(branches: string[]): string[] {
  const canonical = branches.filter((branch) => CANONICAL_INTEGRATION_PATTERN.test(branch)).sort();
  if (canonical.length > 0) return canonical;
  return branches.filter((branch) => LEGACY_INTEGRATION_PATTERN.test(branch)).sort();
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

function cachedIsAncestor(
  cwd: string,
  commit: string,
  ref: string | null,
  ancestorCache: Map<string, boolean>,
  commitCache: Map<string, GridCommitEvidence[]>,
): boolean {
  if (!ref || !commit) return false;
  const key = `${commit}:${ref}`;
  const existing = ancestorCache.get(key);
  if (existing !== undefined) return existing;

  const refCommits = commitCache.get(ref);
  if (refCommits) {
    const isPresent = refCommits.some((c) => c.commit === commit);
    ancestorCache.set(key, isPresent);
    return isPresent;
  }

  const commits = commitsForRef(cwd, ref, commitCache);
  const isPresent = commits.some((c) => c.commit === commit);
  ancestorCache.set(key, isPresent);
  return isPresent;
}

interface RefInfo {
  allBranches: string[];
  headSubjects: Map<string, string>;
  headCommits: Map<string, string>;
  localMainRef: string | null;
  originMainRef: string | null;
  integrationCandidates: string[];
}

function loadRefs(cwd: string): RefInfo {
  const raw = git(cwd, ['for-each-ref', '--format=%(objectname)%09%(refname)%09%(contents:subject)', 'refs/heads', 'refs/remotes/origin/main'], true) ?? '';
  const allBranches: string[] = [];
  const headSubjects = new Map<string, string>();
  const headCommits = new Map<string, string>();
  let localMainRef: string | null = null;
  let originMainRef: string | null = null;

  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    const parts = line.split('\t');
    const commit = parts[0] ?? '';
    const refname = parts[1] ?? '';
    const subject = parts.slice(2).join('\t');

    if (refname.startsWith('refs/heads/')) {
      const branch = refname.slice('refs/heads/'.length);
      allBranches.push(branch);
      headSubjects.set(branch, subject);
      headCommits.set(branch, commit);
      if (branch === 'main') {
        localMainRef = 'main';
      }
    } else if (refname === 'refs/remotes/origin/main') {
      originMainRef = 'origin/main';
      headCommits.set('origin/main', commit);
      headSubjects.set('origin/main', subject);
    }
  }

  const integrationCandidates = integrationCandidatesFrom(allBranches);

  return {
    allBranches,
    headSubjects,
    headCommits,
    localMainRef,
    originMainRef,
    integrationCandidates,
  };
}

export function resolveIntegrationRef(cwd: string, explicitRef?: string): string | null {
  if (explicitRef) {
    if (!refExists(cwd, explicitRef)) {
      throw new Error(`Integration ref does not exist: ${explicitRef}`);
    }
    return explicitRef;
  }
  const candidates = integrationCandidatesFrom(localBranches(cwd));
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
  ancestorCache: Map<string, boolean>,
  claims: AgentClaim[],
  worktrees: WorktreeState[],
  boardroom: BoardroomTaskSummary,
  allBranches: string[],
  refInfo: RefInfo,
  options: { deep?: boolean } = {},
): GridMilestoneEvidence {
  const isDeep = options.deep === true;
  const worktreeByBranch = new Map(worktrees.map((item) => [item.branch, item]));
  const claimedPaths = new Set(claims.map((c) => path.resolve(c.worktree)));

  const activeClaims = claims
    .filter((claim) => containsPattern(claim.lane, milestone.lanePatterns) || containsPattern(claim.branch, milestone.branchPatterns))
    .map((claim) => ({ lane: claim.lane, owner: claim.owner, branch: claim.branch, stale: staleClaim(claim) }));

  const integrationMatches: GridCommitEvidence[] = [];
  if (integrationRef) {
    const match = firstCompletionMatch(commitsForRef(cwd, integrationRef, commitCache), milestone);
    if (match) {
      integrationMatches.push({
        ...match,
        onLocalMain: cachedIsAncestor(cwd, match.commit, localMainRef, ancestorCache, commitCache),
        onOriginMain: cachedIsAncestor(cwd, match.commit, originMainRef, ancestorCache, commitCache),
      });
    }
  }

  const branches: GridBranchEvidence[] = [];
  if (isDeep || integrationMatches.length === 0) {
    for (const branch of allBranches.filter((name) => containsPattern(name, milestone.branchPatterns))) {
      if (branch === integrationRef) continue;
      let match: GridCommitEvidence | undefined;
      const headSubject = refInfo.headSubjects.get(branch);
      const headCommit = refInfo.headCommits.get(branch);
      if (headSubject && headCommit && containsPattern(headSubject, milestone.integrationCommitSignals)) {
        match = { commit: headCommit, subject: headSubject, onLocalMain: false, onOriginMain: false };
      } else {
        match = firstCompletionMatch(commitsForRef(cwd, branch, commitCache), milestone);
      }
      if (!match) continue;
      const worktree = worktreeByBranch.get(branch);
      let isClean = true;
      let dirtyCount = 0;
      if (worktree) {
        if (!isDeep && worktree.dirtyPaths.length === 0 && !claimedPaths.has(path.resolve(worktree.path))) {
          try {
            const out = execFileSync('git', ['status', '--short'], {
              cwd: worktree.path,
              encoding: 'utf8',
              stdio: ['ignore', 'pipe', 'ignore'],
            }).trim();
            worktree.dirtyPaths = out ? out.split('\n').filter(Boolean) : [];
          } catch {
            worktree.dirtyPaths = [];
          }
        }
        isClean = worktree.dirtyPaths.length === 0;
        dirtyCount = worktree.dirtyPaths.length;
      }
      branches.push({
        branch,
        clean: isClean,
        dirtyCount,
        completionCommit: match.commit,
        completionSubject: match.subject,
        mergedIntoIntegration: cachedIsAncestor(cwd, match.commit, integrationRef, ancestorCache, commitCache),
        onLocalMain: cachedIsAncestor(cwd, match.commit, localMainRef, ancestorCache, commitCache),
        onOriginMain: cachedIsAncestor(cwd, match.commit, originMainRef, ancestorCache, commitCache),
      });
    }
  }

  const blockers = (boardroom.blocked ?? [])
    .filter((task) => containsPattern(task.taskId, [milestone.id, ...milestone.lanePatterns]) || containsPattern(task.title, [milestone.title, milestone.id]))
    .map((task) => `${task.taskId}: ${task.title}${task.reason ? ` (${task.reason})` : ''}`);

  const rejected = (boardroom.rejected ?? [])
    .filter((task) => containsPattern(task.taskId, [milestone.id, ...milestone.lanePatterns]) || containsPattern(task.title, [milestone.title, milestone.id]))
    .map((task) => `${task.taskId}: ${task.title}${task.reason ? ` (${task.reason})` : ''}`);

  return {
    activeClaims,
    branches,
    integrationMatches,
    blockers,
    rejected,
    warnings: [],
    contradictions: [],
  };
}

export interface CollectGridMasterBoardOptions {
  cwd?: string;
  integrationRef?: string;
  now?: Date;
  deep?: boolean;
  includeHygiene?: boolean;
}

export function collectGridMasterBoard(options: CollectGridMasterBoardOptions = {}): GridMasterBoard {
  const cwd = options.cwd ?? process.cwd();
  const now = options.now ?? new Date();
  const isDeep = options.deep === true;

  const refInfo = loadRefs(cwd);
  let integrationRef: string | null;
  if (options.integrationRef) {
    if (!refExists(cwd, options.integrationRef)) {
      throw new Error(`Integration ref does not exist: ${options.integrationRef}`);
    }
    integrationRef = options.integrationRef;
  } else {
    integrationRef = refInfo.integrationCandidates.at(-1) ?? null;
  }
  const localMainRef = refInfo.localMainRef;
  const originMainRef = refInfo.originMainRef;
  const integrationCommit = integrationRef
    ? (refInfo.headCommits.get(integrationRef) ?? git(cwd, ['rev-parse', integrationRef], true))
    : null;
  const claims = readClaims(cwd);
  const worktrees = listWorktreeStates(cwd, { fast: !isDeep, deep: isDeep });
  const boardroom = boardroomSummary(cwd);
  const issues = coordinationIssues(claims, worktrees, boardroom);
  const commitCache = new Map<string, GridCommitEvidence[]>();
  const ancestorCache = new Map<string, boolean>();
  const allBranches = refInfo.allBranches;

  const classifiedMilestones = GRID_MILESTONES.map((milestone) => classifyMilestone(
    milestone,
    milestoneEvidence(
      cwd, milestone, integrationRef, localMainRef, originMainRef, commitCache,
      ancestorCache, claims, worktrees, boardroom, allBranches, refInfo, { deep: isDeep },
    ),
  ));
  const blockedMilestones = applyDependencyBlockers(GRID_MILESTONES, classifiedMilestones);
  const milestones = promoteSafeNextWork(GRID_MILESTONES, blockedMilestones);

  const safeNextWorkCount = milestones.filter((m) => m.status === 'SAFE_NEXT_WORK').length;
  const dirtyDormantCount = milestones.filter((m) => m.status === 'DIRTY_DORMANT').length;

  let hygieneReport: WorkspaceHygieneReport | undefined;
  let hygieneHealth: GridBoardHealth['hygiene'];

  if (isDeep || options.includeHygiene) {
    hygieneReport = auditWorkspaceHygiene(cwd, { integrationRef: integrationRef ?? undefined });
    hygieneHealth = {
      totalWorktrees: hygieneReport.totalWorktrees,
      safeToPruneCount: hygieneReport.counts.SAFE_TO_PRUNE,
      dirtyDormantCount: hygieneReport.counts.DIRTY_DORMANT,
      unmergedDormantCount: hygieneReport.counts.UNMERGED_DORMANT,
    };
  }

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
      safeNextWorkCount,
      dirtyDormantCount,
      coordinationWarnings: issues.map((issue) => ({ code: issue.code, message: issue.message })),
      deepScan: isDeep,
      hygiene: hygieneHealth,
    },
    milestones,
    hygiene: hygieneReport,
  };
}

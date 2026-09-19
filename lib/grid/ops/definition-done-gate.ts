import { execFileSync } from 'node:child_process';
import {
  dirtyStatusPath,
  isAncestor,
  readClaims,
  repoRoot,
  scopesOverlap,
  type AgentClaim,
} from '../../agent-control';

export type DefinitionDoneStatus = 'NOT_READY' | 'WORKER_READY' | 'INTEGRATION_READY' | 'INTEGRATED';

export type DefinitionDoneBlocker =
  | 'OUT_OF_SCOPE'
  | 'DIRTY_WORKTREE'
  | 'VERIFICATION_MISSING'
  | 'VERIFICATION_FAILED'
  | 'BRANCH_NOT_PUSHED'
  | 'CLAIM_NOT_ACTIVE_OR_RELEASED'
  | 'INTEGRATION_WORKTREE_DIRTY';

export interface DefinitionDoneVerificationEvidence {
  focusedTests?: boolean;
  diffCheck?: boolean;
  typecheck?: boolean;
  lint?: boolean;
  build?: boolean;
}

export interface DefinitionDoneGateInput {
  branch: string;
  lane?: string;
  integrationRef?: string;
  scope: { clean: boolean; outOfScope: boolean };
  verification: { present: boolean; passed: boolean };
  branchState: { pushed: boolean; claimed: boolean; released: boolean };
  integrationState?: { clean: boolean };
  sourceCommit: string;
  integrationCommit: string;
  sourceIsAncestorOfIntegration: boolean;
}

export interface DefinitionDoneGateResult {
  branch: string;
  lane?: string;
  integrationRef?: string;
  status: DefinitionDoneStatus;
  blockers: DefinitionDoneBlocker[];
  nextAction: string;
  sourceCommit: string;
  integrationCommit: string;
  verification: { present: boolean; passed: boolean };
}

const blockerOrder: DefinitionDoneBlocker[] = [
  'OUT_OF_SCOPE',
  'DIRTY_WORKTREE',
  'VERIFICATION_MISSING',
  'VERIFICATION_FAILED',
  'BRANCH_NOT_PUSHED',
  'CLAIM_NOT_ACTIVE_OR_RELEASED',
  'INTEGRATION_WORKTREE_DIRTY',
];

const nextActionFor = (status: DefinitionDoneStatus, blockers: DefinitionDoneBlocker[]): string => {
  if (status === 'WORKER_READY') return 'Release the lane claim while preserving verification evidence, then run the merge conveyor.';
  if (status === 'INTEGRATION_READY') return 'Run the guarded merge conveyor into the dedicated Grid integration branch.';
  if (status === 'INTEGRATED') return 'Run targeted canonical re-verification, then retire/archive the source lane when safe.';
  const first = blockers[0];
  const actions: Partial<Record<DefinitionDoneBlocker, string>> = {
    OUT_OF_SCOPE: 'Move or revert edits outside the lane claim before handoff.',
    DIRTY_WORKTREE: 'Commit or intentionally revert all source-worktree edits before handoff.',
    VERIFICATION_MISSING: 'Supply focused-test and git-diff-check verification evidence.',
    VERIFICATION_FAILED: 'Fix the failing verification before handoff.',
    BRANCH_NOT_PUSHED: 'Push the source commit to the matching origin branch.',
    CLAIM_NOT_ACTIVE_OR_RELEASED: 'Resolve the lane claim state before handoff.',
    INTEGRATION_WORKTREE_DIRTY: 'Finish or clear current integration work before merging this lane.',
  };
  return first ? (actions[first] ?? 'Resolve the reported blocker.') : 'Collect completion evidence.';
};

export function evaluateDefinitionDoneGate(input: DefinitionDoneGateInput): DefinitionDoneGateResult {
  const integrationDirtyMatters = input.sourceIsAncestorOfIntegration || input.branchState.released;
  const blockers = blockerOrder.filter((blocker) => {
    if (blocker === 'OUT_OF_SCOPE') return input.scope.outOfScope;
    if (blocker === 'DIRTY_WORKTREE') return !input.scope.clean;
    if (blocker === 'VERIFICATION_MISSING') return !input.verification.present;
    if (blocker === 'VERIFICATION_FAILED') return input.verification.present && !input.verification.passed;
    if (blocker === 'BRANCH_NOT_PUSHED') return !input.branchState.pushed;
    if (blocker === 'CLAIM_NOT_ACTIVE_OR_RELEASED') return !input.branchState.claimed && !input.branchState.released;
    return integrationDirtyMatters && input.integrationState?.clean === false;
  });

  let status: DefinitionDoneStatus = 'NOT_READY';
  if (blockers.length === 0) {
    if (input.sourceIsAncestorOfIntegration) status = 'INTEGRATED';
    else if (input.branchState.released) status = 'INTEGRATION_READY';
    else if (input.branchState.claimed) status = 'WORKER_READY';
  }

  return {
    branch: input.branch,
    ...(input.lane ? { lane: input.lane } : {}),
    ...(input.integrationRef ? { integrationRef: input.integrationRef } : {}),
    status,
    blockers,
    nextAction: nextActionFor(status, blockers),
    sourceCommit: input.sourceCommit,
    integrationCommit: input.integrationCommit,
    verification: input.verification,
  };
}

function git(cwd: string, args: string[], allowFailure = false): string {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch (error) {
    if (allowFailure) return '';
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error('git ' + args.join(' ') + ' failed: ' + detail);
  }
}

function branchExists(cwd: string, branch: string): boolean {
  return Boolean(git(cwd, ['show-ref', '--verify', '--quiet', 'refs/heads/' + branch], true));
}

function claimForBranch(cwd: string, branch: string, lane?: string): AgentClaim | undefined {
  return readClaims(cwd).find((claim) => claim.branch === branch && (!lane || claim.lane === lane));
}

interface WorktreeEntry {
  path: string;
  branch: string;
}

function worktrees(cwd: string): WorktreeEntry[] {
  const raw = git(cwd, ['worktree', 'list', '--porcelain']);
  return raw.split(/\n\n+/).filter(Boolean).map((block) => ({
    path: block.match(/^worktree (.+)$/m)?.[1] ?? '',
    branch: block.match(/^branch refs\/heads\/(.+)$/m)?.[1] ?? '(detached)',
  }));
}

function dirtyPaths(worktreePath: string | undefined): string[] {
  if (!worktreePath) return [];
  return git(worktreePath, ['status', '--short']).split('\n').filter(Boolean);
}

function resolveDedicatedIntegrationRef(cwd: string, explicit?: string): string {
  if (explicit) {
    if (!/^grid-(?:canonical-)?integration-\d{8}$/.test(explicit)) {
      throw new Error('refuses non-dedicated integration ref: ' + explicit);
    }
    if (!branchExists(cwd, explicit)) throw new Error('integration ref does not exist: ' + explicit);
    return explicit;
  }
  const refs = git(cwd, ['for-each-ref', '--format=%(refname:short)', 'refs/heads'])
    .split('\n')
    .map((value) => value.trim())
    .filter((value) => /^grid-(?:canonical-)?integration-\d{8}$/.test(value))
    .sort();
  const ref = refs.at(-1);
  if (!ref) throw new Error('dedicated Grid integration ref could not be resolved; pass --integration-ref');
  return ref;
}

function normalizeVerification(evidence?: DefinitionDoneVerificationEvidence): { present: boolean; passed: boolean } {
  const present = typeof evidence?.focusedTests === 'boolean' && typeof evidence?.diffCheck === 'boolean';
  const optional = [evidence?.typecheck, evidence?.lint, evidence?.build].filter((value): value is boolean => typeof value === 'boolean');
  const passed = present && evidence?.focusedTests === true && evidence?.diffCheck === true && optional.every(Boolean);
  return { present, passed };
}

export interface InspectDefinitionDoneGateOptions {
  cwd?: string;
  branch: string;
  lane?: string;
  integrationRef?: string;
  verification?: DefinitionDoneVerificationEvidence;
}

export function inspectDefinitionDoneGate(options: InspectDefinitionDoneGateOptions): DefinitionDoneGateResult {
  const cwd = options.cwd ?? process.cwd();
  const root = repoRoot(cwd);
  if (!branchExists(root, options.branch)) throw new Error('source branch does not exist: ' + options.branch);

  const integrationRef = resolveDedicatedIntegrationRef(root, options.integrationRef);
  if (integrationRef === options.branch) throw new Error('source branch and integration ref must differ');

  const sourceCommit = git(root, ['rev-parse', 'refs/heads/' + options.branch]);
  const integrationCommit = git(root, ['rev-parse', integrationRef]);
  const claim = claimForBranch(root, options.branch, options.lane);
  const entries = worktrees(root);
  const sourceTree = entries.find((entry) => entry.branch === options.branch);
  const integrationTree = entries.find((entry) => entry.branch === integrationRef);
  if (!integrationTree) throw new Error('integration ref has no dedicated worktree: ' + integrationRef);

  const sourceDirty = dirtyPaths(sourceTree?.path);
  const integrationDirty = dirtyPaths(integrationTree.path);
  const outOfScope = sourceDirty.some((line) => {
    if (!claim) return true;
    const file = dirtyStatusPath(line);
    return !claim.scope.some((scope) => scopesOverlap(scope, file));
  });

  const originRef = 'origin/' + options.branch;
  const pushed = Boolean(git(root, ['rev-parse', '--verify', '--quiet', originRef], true))
    && isAncestor(sourceCommit, originRef, root);
  const sourceIsAncestorOfIntegration = isAncestor(sourceCommit, integrationRef, root);

  return evaluateDefinitionDoneGate({
    branch: options.branch,
    lane: options.lane,
    integrationRef,
    scope: { clean: sourceDirty.length === 0, outOfScope },
    verification: normalizeVerification(options.verification),
    branchState: { pushed, claimed: Boolean(claim), released: !claim },
    integrationState: { clean: integrationDirty.length === 0 },
    sourceCommit,
    integrationCommit,
    sourceIsAncestorOfIntegration,
  });
}

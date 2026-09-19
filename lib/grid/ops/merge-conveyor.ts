import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  canonicalPath,
  readClaims,
  resolveIntegrationBranch,
  scopesOverlap,
  type AgentClaim,
} from '../../agent-control';

export interface MergeConveyorOptions {
  cwd?: string;
  branch?: string;
  integrationRef?: string;
  execute?: boolean;
  push?: boolean;
  retireSource?: boolean;
  verification?: string | string[];
}

export interface MergeConveyorPlan {
  mode: 'plan';
  canExecute: true;
  sourceBranch: string;
  integrationRef: string;
  sourceWorktree: string;
  integrationWorktree: string;
  sourceCommit: string;
  integrationCommit: string;
  changedPaths: string[];
  focusedTests: string[];
  verification: string[];
  retireSource: boolean;
}

export interface MergeConveyorResult extends Omit<MergeConveyorPlan, 'mode'> {
  mode: 'execute';
  executed: true;
  mergeCommit: string;
  archiveTag?: string;
  pushed: boolean;
}

interface WorktreeEntry {
  path: string;
  branch: string;
}

function git(cwd: string, args: string[], allowFailure = false): string {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  } catch (error) {
    if (allowFailure) return '';
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`git ${args.join(' ')} failed: ${detail}`);
  }
}

function gitSucceeds(cwd: string, args: string[]): boolean {
  try {
    execFileSync('git', args, { cwd, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function requireBranch(cwd: string, branch: string): string {
  if (!gitSucceeds(cwd, ['show-ref', '--verify', '--quiet', `refs/heads/${branch}`])) {
    throw new Error(`source branch does not exist: ${branch}`);
  }
  return git(cwd, ['rev-parse', `refs/heads/${branch}`]);
}

function worktrees(cwd: string): WorktreeEntry[] {
  const raw = git(cwd, ['worktree', 'list', '--porcelain']);
  return raw.split(/\n\n+/).filter(Boolean).map((block) => {
    const worktree = block.match(/^worktree (.+)$/m)?.[1] ?? '';
    const branch = block.match(/^branch refs\/heads\/(.+)$/m)?.[1] ?? '(detached)';
    return { path: worktree, branch };
  });
}

function worktreeForBranch(cwd: string, branch: string): WorktreeEntry {
  const match = worktrees(cwd).find((entry) => entry.branch === branch);
  if (!match) throw new Error(`branch has no dedicated worktree: ${branch}`);
  return match;
}

function dirty(cwd: string): string[] {
  return git(cwd, ['status', '--porcelain']).split('\n').filter(Boolean);
}

function changedPaths(cwd: string, target: string, source: string): string[] {
  return git(cwd, ['diff', '--name-only', `${target}...${source}`])
    .split('\n')
    .map((value) => value.trim())
    .filter(Boolean);
}

function focusedTests(paths: string[]): string[] {
  return paths.filter((value) => /(^|\/)tests\/.*\.test\.[cm]?[jt]sx?$/.test(value));
}

function verificationCommands(tests: string[], supplied?: string | string[]): string[] {
  const commands = tests.length > 0
    ? [`./node_modules/.bin/vitest run ${tests.map((test) => JSON.stringify(test)).join(' ')}`]
    : [];
  if (supplied) commands.push(...(Array.isArray(supplied) ? supplied : [supplied]));
  commands.push('git diff --check', 'git diff --cached --check');
  return commands;
}

function activeClaimForSource(cwd: string, sourceBranch: string, sourcePath: string): AgentClaim | undefined {
  const source = canonicalPath(sourcePath);
  return readClaims(cwd).find((claim) => claim.branch === sourceBranch || canonicalPath(claim.worktree) === source);
}

function assertNoOverlappingClaims(cwd: string, changed: string[], sourceBranch: string): void {
  const overlaps = readClaims(cwd)
    .filter((claim) => claim.branch !== sourceBranch)
    .filter((claim) => claim.scope.some((scope) => changed.some((file) => scopesOverlap(scope, file))));
  if (overlaps.length > 0) {
    throw new Error(`changed paths overlap active claim scope: ${overlaps.map((claim) => claim.lane).join(', ')}`);
  }
}

function assertConflictFree(cwd: string, target: string, source: string): void {
  try {
    execFileSync('git', ['merge-tree', '--write-tree', target, source], { cwd, stdio: 'ignore' });
  } catch {
    throw new Error(`merge conflict preflight failed for ${source} into ${target}`);
  }
}

function resolveTarget(cwd: string, explicit?: string): { ref: string; worktree: WorktreeEntry } {
  const ref = explicit ?? resolveIntegrationBranch(cwd) ?? '';
  if (!ref) throw new Error('integration ref could not be resolved; pass --integration-ref');
  if (!/^grid-(?:canonical-)?integration-\d{8}$/.test(ref)) {
    throw new Error(`refuses non-dedicated integration target: ${ref}`);
  }
  if (!gitSucceeds(cwd, ['show-ref', '--verify', '--quiet', `refs/heads/${ref}`])) {
    throw new Error(`integration ref does not exist: ${ref}`);
  }
  const target = worktreeForBranch(cwd, ref);
  if (target.branch !== ref || !fs.existsSync(target.path)) {
    throw new Error(`integration target is not a dedicated worktree: ${ref}`);
  }
  return { ref, worktree: target };
}

export function planMergeConveyor(options: MergeConveyorOptions): MergeConveyorPlan {
  const cwd = options.cwd ?? process.cwd();
  if (!options.branch?.trim()) throw new Error('an explicit --branch source branch is required');
  const sourceBranch = options.branch;
  const target = resolveTarget(cwd, options.integrationRef);
  if (sourceBranch === target.ref) throw new Error('source and integration target are the same branch');
  const sourceCommit = requireBranch(cwd, sourceBranch);
  const sourceTree = worktreeForBranch(cwd, sourceBranch);
  if (sourceTree.branch === target.ref) throw new Error('source and integration target are the same worktree');
  const sourceClaim = activeClaimForSource(cwd, sourceBranch, sourceTree.path);
  if (sourceClaim) throw new Error(`source has an active claim: ${sourceClaim.lane}`);
  const sourceDirty = dirty(sourceTree.path);
  if (sourceDirty.length > 0) throw new Error(`source worktree is dirty: ${sourceDirty.join(', ')}`);
  const targetDirty = dirty(target.worktree.path);
  if (targetDirty.length > 0) throw new Error(`target worktree is dirty: ${targetDirty.join(', ')}`);
  if (gitSucceeds(cwd, ['merge-base', '--is-ancestor', sourceCommit, target.ref])) {
    throw new Error(`source is already merged into ${target.ref}`);
  }
  const paths = changedPaths(cwd, target.ref, sourceBranch);
  assertNoOverlappingClaims(cwd, paths, sourceBranch);
  assertConflictFree(target.worktree.path, target.ref, sourceBranch);
  return {
    mode: 'plan',
    canExecute: true,
    sourceBranch,
    integrationRef: target.ref,
    sourceWorktree: sourceTree.path,
    integrationWorktree: target.worktree.path,
    sourceCommit,
    integrationCommit: git(cwd, ['rev-parse', target.ref]),
    changedPaths: paths,
    focusedTests: focusedTests(paths),
    verification: verificationCommands(focusedTests(paths), options.verification),
    retireSource: options.retireSource === true,
  };
}

function runVerification(cwd: string, commands: string[]): void {
  for (const command of commands) {
    const result = spawnSync(command, { cwd, shell: true, stdio: 'inherit', env: process.env });
    if (result.status !== 0) throw new Error(`verification failed: ${command}`);
  }
}

function archiveTag(sourceBranch: string, sourceCommit: string, cwd: string): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const base = `grid-archive/${sourceBranch}/${stamp}`;
  let candidate = base;
  let suffix = 2;
  while (gitSucceeds(cwd, ['show-ref', '--tags', '--verify', `refs/tags/${candidate}`])) candidate = `${base}-${suffix++}`;
  git(cwd, ['tag', candidate, sourceCommit]);
  return candidate;
}

export function executeMergeConveyor(options: MergeConveyorOptions): MergeConveyorResult {
  const cwd = options.cwd ?? process.cwd();
  const plan = planMergeConveyor(options);
  const target = plan.integrationWorktree;
  try {
    git(target, ['merge', '--no-ff', '--no-commit', plan.sourceBranch]);
    runVerification(target, plan.verification);
    git(target, ['commit', '-m', `Merge branch '${plan.sourceBranch}' into ${plan.integrationRef}`]);
  } catch (error) {
    if (gitSucceeds(target, ['rev-parse', '--verify', 'MERGE_HEAD'])) git(target, ['merge', '--abort'], true);
    throw error;
  }
  const mergeCommit = git(target, ['rev-parse', 'HEAD']);
  let pushed = false;
  if (options.push) {
    git(target, ['push', 'origin', plan.integrationRef]);
    pushed = true;
  }
  let tag: string | undefined;
  if (options.retireSource) {
    if (dirty(plan.sourceWorktree).length > 0) throw new Error('source became dirty before retirement');
    tag = archiveTag(plan.sourceBranch, plan.sourceCommit, cwd);
    git(cwd, ['worktree', 'remove', plan.sourceWorktree]);
    git(target, ['branch', '-d', plan.sourceBranch]);
  }
  return { ...plan, mode: 'execute', executed: true, mergeCommit, archiveTag: tag, pushed };
}

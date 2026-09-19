import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  boardroomSummary,
  coordinationIssues,
  listWorktreeStates,
  readClaims,
  resolveIntegrationBranch,
  staleClaim,
  type AgentClaim,
  type CoordinationIssue,
  type WorktreeState,
} from '../../agent-control';
import { collectGridMasterBoard } from '../master-board/collect';
import type { GridMasterBoard, GridMilestoneState } from '../master-board/types';
import {
  evaluateGridProductionActivation,
  GRID_PRODUCTION_RELEASE_GATE_COMMAND,
  type GridProductionActivationBlocker,
  type GridProductionActivationReport,
} from '../operations/production-activation';
import {
  collectPlayableLoopScore,
  type PlayableLoopScore,
} from './playable-loop-score';
import {
  recommendGridProductWork,
  type GridProductDirectorResult,
} from './product-director';

export type ReleaseCandidateStatus =
  | 'NOT_READY'
  | 'READY_FOR_VERIFICATION'
  | 'READY_FOR_HUMAN_RELEASE_DECISION';

export type VerificationEvidenceStatus = 'VERIFIED' | 'FAILED' | 'MISSING' | 'PENDING';

export interface VerificationEvidenceItem {
  id: string;
  name: string;
  status: VerificationEvidenceStatus;
  detail: string;
  recordedAt?: string;
  source?: string;
  metadata?: Record<string, unknown>;
}

export type ReleaseCandidateEvidenceProvider = (context: {
  cwd: string;
  integrationRef: string | null;
  integrationCommit: string | null;
  env: Record<string, string | undefined>;
}) => VerificationEvidenceItem | VerificationEvidenceItem[] | null | undefined;

export interface ReleaseCandidateGitState {
  integrationRef: string | null;
  integrationCommit: string | null;
  commitSubject: string | null;
  clean: boolean;
  dirtyFilesCount: number;
  dirtyFiles: string[];
  worktreePath: string;
}

export interface ReleaseCandidateClaimSummary {
  lane: string;
  owner: string;
  branch: string;
  goal: string;
  stale: boolean;
}

export interface ReleaseCandidateCoordinationState {
  liveClaimsCount: number;
  staleClaimsCount: number;
  claims: ReleaseCandidateClaimSummary[];
  coordinationWarningsCount: number;
  coordinationWarnings: Array<{
    code: string;
    message: string;
  }>;
  boardroomStatus: 'active' | 'inactive';
}

export interface ReleaseCandidateUnintegratedMilestone {
  id: string;
  title: string;
  status: string;
  detail: string;
}

export interface ReleaseCandidateMilestonesSummary {
  total: number;
  integrated: number;
  percentIntegrated: number;
  byStatus: Record<string, number>;
  unintegrated: ReleaseCandidateUnintegratedMilestone[];
}

export interface ReleaseCandidatePlayableLoopSummary {
  score: number;
  status: string;
  stagesCount: number;
  stagesGreen: number;
  stagesYellow: number;
  stagesRed: number;
  highestValueBrokenLink: {
    stageId: string;
    title: string;
    lostPoints: number;
    recommendation: string;
  } | null;
  runtimeVerificationSummary: {
    verifiedStages: number;
    unverifiedStages: number;
    missingEvidenceStages: number;
  };
}

export interface ReleaseCandidateProductDirectorRecommendation {
  id: string;
  title: string;
  actionType: string;
  whyNow: string;
  specialization: string;
}

export interface ReleaseCandidateProductDirectorSummary {
  recommendationsCount: number;
  directorSummary: string;
  bottleneck: string | null;
  recommendations: ReleaseCandidateProductDirectorRecommendation[];
}

export interface ReleaseCandidateActivationPreflightSummary {
  status: 'READY_FOR_RELEASE_GATE' | 'BLOCKED';
  readyForReleaseGate: boolean;
  blockersCount: number;
  blockers: Array<{
    kind: string;
    key: string;
    detail: string;
  }>;
  releaseGateCommand: string;
}

export interface ReleaseGateStepPlan {
  id: string;
  label: string;
  kind: 'command' | 'diagnostics' | 'playable-loop';
  command?: string;
  env?: Record<string, string>;
}

export interface ReleaseGatePlanSummary {
  cleanWorktreeRequired: boolean;
  skipBuild: boolean;
  stepsCount: number;
  steps: ReleaseGateStepPlan[];
}

export interface CanonicalCommitSummary {
  commit: string;
  at: string;
  summary: string;
}

export interface ReleaseCandidateManifest {
  version: 1;
  generatedAt: string;
  status: ReleaseCandidateStatus;
  statusSummary: string;
  operatorNextAction: string;
  git: ReleaseCandidateGitState;
  coordination: ReleaseCandidateCoordinationState;
  milestones: ReleaseCandidateMilestonesSummary;
  playableLoop: ReleaseCandidatePlayableLoopSummary;
  productDirector: ReleaseCandidateProductDirectorSummary;
  activationPreflight: ReleaseCandidateActivationPreflightSummary;
  verificationEvidence: VerificationEvidenceItem[];
  releaseGatePlan: ReleaseGatePlanSummary;
  recentCanonicalCommits: CanonicalCommitSummary[];
}

export interface CollectGridReleaseCandidateOptions {
  cwd?: string;
  env?: Record<string, string | undefined>;
  integrationRef?: string;
  skipBuild?: boolean;
  // Dependency injection for pure testing
  cleanWorktree?: boolean;
  dirtyFiles?: string[];
  integrationCommit?: string;
  commitSubject?: string;
  recentCommits?: CanonicalCommitSummary[];
  claims?: AgentClaim[];
  worktrees?: WorktreeState[];
  coordinationIssues?: CoordinationIssue[];
  boardroomActive?: boolean;
  masterBoard?: GridMasterBoard;
  playableLoopScore?: PlayableLoopScore;
  productDirector?: GridProductDirectorResult;
  productionActivation?: GridProductionActivationReport;
  verificationEvidence?: VerificationEvidenceItem[];
  evidenceProviders?: ReleaseCandidateEvidenceProvider[];
}

function runGit(args: string[], cwd: string): string {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

export function resolveReleaseCandidateIntegrationRef(cwd: string): string | null {
  try {
    const raw = runGit(['for-each-ref', '--format=%(refname:short)', 'refs/heads'], cwd);
    if (raw) {
      const branches = raw
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
      const canonical = branches.filter((branch) => /^grid-canonical-integration-\d{8}$/.test(branch)).sort();
      if (canonical.length > 0) return canonical[canonical.length - 1];
    }
  } catch {
    // fall through to resolver below
  }
  return resolveIntegrationBranch(cwd);
}

function inspectWorktreeCleanliness(cwd: string): { clean: boolean; dirtyFiles: string[] } {
  const output = runGit(['status', '--porcelain'], cwd);
  if (!output) return { clean: true, dirtyFiles: [] };
  const dirtyFiles = output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[MADRCU?!]{1,2}\s+/, '').trim());
  return { clean: dirtyFiles.length === 0, dirtyFiles };
}

function collectRecentCanonicalCommits(cwd: string, ref: string | null): CanonicalCommitSummary[] {
  if (!ref) return [];
  const logOutput = runGit(['log', '-6', '--format=%h%x09%cI%x09%s', ref], cwd);
  if (!logOutput) return [];
  return logOutput
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [commit, at, ...summaryParts] = line.split('\t');
      return {
        commit: commit ?? '',
        at: at ?? '',
        summary: summaryParts.join('\t'),
      };
    })
    .filter((item) => item.commit.length > 0);
}

export function getReleaseGatePlan(options: { skipBuild?: boolean } = {}): ReleaseGatePlanSummary {
  const skipBuild = Boolean(options.skipBuild);
  const steps: ReleaseGateStepPlan[] = [
    {
      id: 'coordination',
      label: 'Control Tower coordination preflight',
      kind: 'command',
      command: 'npm run grid:agents -- check',
    },
    {
      id: 'diagnostics',
      label: 'Grid launch diagnostics',
      kind: 'diagnostics',
    },
    {
      id: 'playable-loop',
      label: 'Playable-loop evidence safety check',
      kind: 'playable-loop',
    },
    {
      id: 'integration-tests',
      label: 'Integration, security, and deterministic season tests',
      kind: 'command',
      command:
        './node_modules/.bin/vitest run tests/grid-integration-journey.test.ts tests/grid-integration-security.test.ts tests/grid-season-simulation.test.ts',
    },
    {
      id: 'typecheck',
      label: 'TypeScript typecheck',
      kind: 'command',
      command: './node_modules/.bin/tsc --noEmit',
    },
    {
      id: 'lint',
      label: 'Next.js lint',
      kind: 'command',
      command: 'npm run lint',
    },
    {
      id: 'diff-check',
      label: 'Git whitespace/conflict-marker check',
      kind: 'command',
      command: 'git diff --check HEAD',
    },
  ];

  if (!skipBuild) {
    steps.push({
      id: 'build',
      label: 'Production Next.js build',
      kind: 'command',
      command: 'npm run build',
      env: { NODE_ENV: 'production' },
    });
  }

  return {
    cleanWorktreeRequired: true,
    skipBuild,
    stepsCount: steps.length,
    steps,
  };
}

export function collectDefaultVerificationEvidence(context: {
  cwd: string;
  integrationRef: string | null;
  integrationCommit: string | null;
  env: Record<string, string | undefined>;
}): VerificationEvidenceItem[] {
  const items: VerificationEvidenceItem[] = [];

  // 1. Browser Runtime Journey Verification
  const browserModule = path.resolve(context.cwd, 'lib/grid/ops/browser-runtime-verification.ts');
  const browserEvidenceFile = path.resolve(context.cwd, '.git/grid-agent-control/evidence/browser-runtime.json');
  if (fs.existsSync(browserEvidenceFile)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(browserEvidenceFile, 'utf8'));
      items.push({
        id: 'browser-runtime',
        name: 'Browser Runtime Verification',
        status: parsed.status === 'PASS' ? 'VERIFIED' : 'FAILED',
        detail: parsed.summary ?? 'Recorded browser runtime verification report.',
        recordedAt: parsed.recordedAt,
        source: 'evidence-file',
      });
    } catch {
      items.push({
        id: 'browser-runtime',
        name: 'Browser Runtime Verification',
        status: 'FAILED',
        detail: 'Corrupted browser runtime verification record.',
        source: 'evidence-file',
      });
    }
  } else {
    items.push({
      id: 'browser-runtime',
      name: 'Browser Runtime Verification',
      status: 'MISSING',
      detail: fs.existsSync(browserModule)
        ? 'Browser verification harness is present on disk but no canonical runtime execution evidence has been recorded.'
        : 'No canonical browser runtime verification evidence found. Local-only browser journey verification not yet integrated.',
    });
  }

  // 2. Database Migration Safety Gate
  const migrationModule = path.resolve(context.cwd, 'lib/grid/ops/migration-safety.ts');
  const migrationEvidenceFile = path.resolve(context.cwd, '.git/grid-agent-control/evidence/migration-safety.json');
  if (fs.existsSync(migrationEvidenceFile)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(migrationEvidenceFile, 'utf8'));
      items.push({
        id: 'migration-safety',
        name: 'Database Migration Safety Gate',
        status: parsed.status === 'PASS' ? 'VERIFIED' : 'FAILED',
        detail: parsed.summary ?? 'Recorded database migration safety gate report.',
        recordedAt: parsed.recordedAt,
        source: 'evidence-file',
      });
    } catch {
      items.push({
        id: 'migration-safety',
        name: 'Database Migration Safety Gate',
        status: 'FAILED',
        detail: 'Corrupted database migration safety record.',
        source: 'evidence-file',
      });
    }
  } else {
    items.push({
      id: 'migration-safety',
      name: 'Database Migration Safety Gate',
      status: 'MISSING',
      detail: fs.existsSync(migrationModule)
        ? 'Migration safety harness is present on disk but no canonical execution evidence has been recorded.'
        : 'No canonical migration safety evidence found. Supabase schema migration safety analysis not yet integrated.',
    });
  }

  // 3. Full Release Gate Verification
  items.push({
    id: 'release-gate',
    name: 'Full Grid Release Gate',
    status: 'PENDING',
    detail: 'Full release gate verification (tests, typecheck, lint, build) has not yet been executed for this candidate commit.',
  });

  return items;
}

export function evaluateReleaseCandidateStatus(input: {
  gitClean: boolean;
  dirtyFilesCount: number;
  integrationRef: string | null;
  integrationCommit: string | null;
  liveClaimsCount: number;
  coordinationWarningsCount: number;
  unintegratedMilestonesCount: number;
  unintegratedMilestones: ReleaseCandidateUnintegratedMilestone[];
  playableLoopScore: number;
  playableLoopStatus: string;
  playableLoopBrokenLink: { title: string } | null;
  activationPreflightStatus: 'READY_FOR_RELEASE_GATE' | 'BLOCKED';
  activationBlockersCount: number;
  verificationEvidence: VerificationEvidenceItem[];
}): {
  status: ReleaseCandidateStatus;
  statusSummary: string;
  operatorNextAction: string;
} {
  const notReadyReasons: string[] = [];
  let primaryNextAction: string | null = null;

  if (!input.gitClean) {
    notReadyReasons.push(`Working tree has ${input.dirtyFilesCount} uncommitted modification(s).`);
    primaryNextAction = 'Commit, stash, or reconcile uncommitted changes in the worktree before proceeding.';
  }

  if (!input.integrationRef || !input.integrationCommit) {
    notReadyReasons.push('Canonical integration ref or commit is unresolved.');
    primaryNextAction = primaryNextAction ?? 'Establish a valid canonical integration ref and commit before evaluating release candidate.';
  }

  if (input.liveClaimsCount > 0) {
    notReadyReasons.push(`${input.liveClaimsCount} active Control Tower claim(s) remain open.`);
    primaryNextAction = primaryNextAction ?? 'Wait for active coding streams to complete and release their Control Tower claims before cutting a candidate.';
  }

  if (input.coordinationWarningsCount > 0) {
    notReadyReasons.push(`${input.coordinationWarningsCount} Control Tower coordination warning(s) detected.`);
    primaryNextAction = primaryNextAction ?? 'Resolve Control Tower coordination warnings before proceeding with release evaluation.';
  }

  if (input.unintegratedMilestonesCount > 0) {
    const sample = input.unintegratedMilestones.slice(0, 3).map((m) => m.title).join(', ');
    const suffix = input.unintegratedMilestonesCount > 3 ? ', ...' : '';
    notReadyReasons.push(`${input.unintegratedMilestonesCount} milestone(s) are not integrated (${sample}${suffix}).`);
    primaryNextAction = primaryNextAction ?? 'Merge and integrate remaining milestone branches into canonical ref before cutting release candidate.';
  }

  if (input.playableLoopStatus !== 'GREEN' || input.playableLoopScore < 100) {
    const link = input.playableLoopBrokenLink ? ` [broken link: ${input.playableLoopBrokenLink.title}]` : '';
    notReadyReasons.push(`Playable loop is ${input.playableLoopStatus} (${input.playableLoopScore}/100)${link}.`);
    primaryNextAction = primaryNextAction ?? (input.playableLoopBrokenLink
      ? `Repair the playable loop bottleneck (${input.playableLoopBrokenLink.title}) before release verification.`
      : 'Achieve 100/100 GREEN playable loop readiness before release verification.');
  }

  if (input.activationPreflightStatus === 'BLOCKED' || input.activationBlockersCount > 0) {
    notReadyReasons.push(`Production activation preflight is BLOCKED with ${input.activationBlockersCount} blocker(s).`);
    primaryNextAction = primaryNextAction ?? 'Resolve production activation preflight blockers (set required production environment variables and verify secrets).';
  }

  const failedEvidence = input.verificationEvidence.filter((item) => item.status === 'FAILED');
  if (failedEvidence.length > 0) {
    const failedNames = failedEvidence.map((item) => item.name).join(', ');
    notReadyReasons.push(`Verification gate(s) failed: ${failedNames}.`);
    primaryNextAction = primaryNextAction ?? `Investigate and resolve failed verification gate(s): ${failedNames}.`;
  }

  if (notReadyReasons.length > 0) {
    return {
      status: 'NOT_READY',
      statusSummary: `Release candidate is NOT READY: ${notReadyReasons[0]}`,
      operatorNextAction: primaryNextAction ?? 'Inspect and resolve listed readiness blockers.',
    };
  }

  // Preflight prerequisites are fully satisfied. Now evaluate verification evidence.
  const pendingOrMissing = input.verificationEvidence.filter(
    (item) => item.status === 'MISSING' || item.status === 'PENDING',
  );

  if (pendingOrMissing.length > 0) {
    const names = pendingOrMissing.map((item) => item.name).join(', ');
    return {
      status: 'READY_FOR_VERIFICATION',
      statusSummary: `Canonical integration and activation preflight are clean. Mandatory verification evidence is pending or missing: ${names}.`,
      operatorNextAction: "Run 'npm run grid:release-gate' and execute browser runtime verification and migration safety checks.",
    };
  }

  // All verification evidence items are VERIFIED.
  const commitSnippet = input.integrationCommit ? ` (${input.integrationCommit.slice(0, 8)})` : '';
  return {
    status: 'READY_FOR_HUMAN_RELEASE_DECISION',
    statusSummary: 'All canonical milestones, activation preflights, and verification evidence gates are satisfied with empirical proof.',
    operatorNextAction: `Submit candidate commit${commitSnippet} to human release authority for sign-off. Never auto-deploy.`,
  };
}

export function collectGridReleaseCandidate(
  options: CollectGridReleaseCandidateOptions = {},
): ReleaseCandidateManifest {
  const cwd = options.cwd ?? process.cwd();
  const env = options.env ?? process.env;

  // 1. Canonical Git & Worktree
  const integrationRef = options.integrationRef ?? resolveReleaseCandidateIntegrationRef(cwd);
  const commitSha = options.integrationCommit
    ?? (integrationRef ? runGit(['rev-parse', integrationRef], cwd) || runGit(['rev-parse', 'HEAD'], cwd) : null);
  const commitSubject = options.commitSubject
    ?? (commitSha ? runGit(['log', '-1', '--format=%s', commitSha], cwd) : null);

  const cleanliness = options.cleanWorktree !== undefined
    ? { clean: options.cleanWorktree, dirtyFiles: options.dirtyFiles ?? [] }
    : inspectWorktreeCleanliness(cwd);

  const recentCommits = options.recentCommits ?? collectRecentCanonicalCommits(cwd, integrationRef);

  // 2. Control Tower Coordination
  const claims = options.claims ?? readClaims(cwd);
  const worktrees = options.worktrees ?? (options.claims !== undefined ? [] : listWorktreeStates(cwd, { fast: true }));
  const boardroom = options.boardroomActive !== undefined
    ? { autonomousRunActive: options.boardroomActive }
    : boardroomSummary(cwd);
  const issues = options.coordinationIssues ?? (options.claims !== undefined && options.worktrees === undefined
    ? []
    : coordinationIssues(claims, worktrees, boardroom));

  const liveClaims = claims.filter((claim) => !staleClaim(claim));
  const staleClaims = claims.filter((claim) => staleClaim(claim));

  const coordinationState: ReleaseCandidateCoordinationState = {
    liveClaimsCount: liveClaims.length,
    staleClaimsCount: staleClaims.length,
    claims: claims.map((claim) => ({
      lane: claim.lane,
      owner: claim.owner,
      branch: claim.branch,
      goal: claim.goal,
      stale: staleClaim(claim),
    })),
    coordinationWarningsCount: issues.length,
    coordinationWarnings: issues.map((issue) => ({
      code: issue.code,
      message: issue.message,
    })),
    boardroomStatus: boardroom.autonomousRunActive ? 'active' : 'inactive',
  };

  // 3. Master Board Milestones
  const masterBoard = options.masterBoard ?? collectGridMasterBoard({
    cwd,
    integrationRef: integrationRef ?? undefined,
  });

  const milestoneByStatus: Record<string, number> = {};
  const unintegratedMilestones: ReleaseCandidateUnintegratedMilestone[] = [];
  let integratedMilestonesCount = 0;

  for (const milestone of masterBoard.milestones) {
    milestoneByStatus[milestone.status] = (milestoneByStatus[milestone.status] ?? 0) + 1;
    if (milestone.status === 'INTEGRATED') {
      integratedMilestonesCount += 1;
    } else {
      unintegratedMilestones.push({
        id: milestone.id,
        title: milestone.title,
        status: milestone.status,
        detail: milestone.detail,
      });
    }
  }

  const totalMilestones = masterBoard.milestones.length;
  const milestonesSummary: ReleaseCandidateMilestonesSummary = {
    total: totalMilestones,
    integrated: integratedMilestonesCount,
    percentIntegrated: totalMilestones === 0 ? 0 : Math.round((integratedMilestonesCount / totalMilestones) * 100),
    byStatus: milestoneByStatus,
    unintegrated: unintegratedMilestones,
  };

  // 4. Playable Loop Readiness
  const playableLoopScore = options.playableLoopScore ?? collectPlayableLoopScore({
    cwd,
    board: masterBoard,
  });

  let stagesGreen = 0;
  let stagesYellow = 0;
  let stagesRed = 0;
  let verifiedStages = 0;
  let unverifiedStages = 0;
  let missingEvidenceStages = 0;

  for (const stage of playableLoopScore.stages) {
    if (stage.status === 'GREEN') stagesGreen += 1;
    else if (stage.status === 'YELLOW') stagesYellow += 1;
    else if (stage.status === 'RED') stagesRed += 1;

    if (stage.verification === 'browser/runtime verified') verifiedStages += 1;
    else if (stage.verification === 'browser/runtime not yet verified') unverifiedStages += 1;
    else missingEvidenceStages += 1;
  }

  const playableLoopSummary: ReleaseCandidatePlayableLoopSummary = {
    score: playableLoopScore.score,
    status: playableLoopScore.status,
    stagesCount: playableLoopScore.stages.length,
    stagesGreen,
    stagesYellow,
    stagesRed,
    highestValueBrokenLink: playableLoopScore.highestValueBrokenLink
      ? {
          stageId: playableLoopScore.highestValueBrokenLink.stageId,
          title: playableLoopScore.highestValueBrokenLink.title,
          lostPoints: playableLoopScore.highestValueBrokenLink.lostPoints,
          recommendation: playableLoopScore.highestValueBrokenLink.recommendation,
        }
      : null,
    runtimeVerificationSummary: {
      verifiedStages,
      unverifiedStages,
      missingEvidenceStages,
    },
  };

  // 5. Product Director
  const productDirectorResult = options.productDirector ?? recommendGridProductWork({
    masterBoard,
    claims,
    limit: 3,
    playableLoopScore,
  });

  const productDirectorSummary: ReleaseCandidateProductDirectorSummary = {
    recommendationsCount: productDirectorResult.recommendations.length,
    directorSummary: productDirectorResult.directorSummary,
    bottleneck: productDirectorResult.bottleneck?.title ?? null,
    recommendations: productDirectorResult.recommendations.map((rec) => ({
      id: rec.id,
      title: rec.title,
      actionType: rec.actionType,
      whyNow: rec.whyNow,
      specialization: rec.specialization,
    })),
  };

  // 6. Production Activation Preflight (Pure Evaluator)
  const productionActivationReport = options.productionActivation ?? evaluateGridProductionActivation({
    board: masterBoard,
    env,
    cleanWorktree: cleanliness.clean,
  });

  const activationPreflightSummary: ReleaseCandidateActivationPreflightSummary = {
    status: productionActivationReport.status,
    readyForReleaseGate: productionActivationReport.readyForReleaseGate,
    blockersCount: productionActivationReport.blockers.length,
    blockers: productionActivationReport.blockers.map((b) => ({
      kind: b.kind,
      key: b.key,
      detail: b.detail,
    })),
    releaseGateCommand: productionActivationReport.releaseGateCommand,
  };

  // 7. Verification Evidence
  let verificationEvidence = options.verificationEvidence
    ? [...options.verificationEvidence]
    : collectDefaultVerificationEvidence({
        cwd,
        integrationRef,
        integrationCommit: commitSha,
        env,
      });

  if (options.evidenceProviders) {
    for (const provider of options.evidenceProviders) {
      try {
        const result = provider({
          cwd,
          integrationRef,
          integrationCommit: commitSha,
          env,
        });
        if (result) {
          const list = Array.isArray(result) ? result : [result];
          for (const item of list) {
            const existingIndex = verificationEvidence.findIndex((e) => e.id === item.id);
            if (existingIndex >= 0) {
              verificationEvidence[existingIndex] = item;
            } else {
              verificationEvidence.push(item);
            }
          }
        }
      } catch {
        // Provider failures must not crash the read-only manifest
      }
    }
  }

  // 8. Release Gate Planned Steps
  const releaseGatePlan = getReleaseGatePlan({ skipBuild: options.skipBuild });

  // 9. Status & Operator Next Action
  const evaluated = evaluateReleaseCandidateStatus({
    gitClean: cleanliness.clean,
    dirtyFilesCount: cleanliness.dirtyFiles.length,
    integrationRef,
    integrationCommit: commitSha,
    liveClaimsCount: liveClaims.length,
    coordinationWarningsCount: issues.length,
    unintegratedMilestonesCount: unintegratedMilestones.length,
    unintegratedMilestones,
    playableLoopScore: playableLoopSummary.score,
    playableLoopStatus: playableLoopSummary.status,
    playableLoopBrokenLink: playableLoopSummary.highestValueBrokenLink,
    activationPreflightStatus: activationPreflightSummary.status,
    activationBlockersCount: activationPreflightSummary.blockersCount,
    verificationEvidence,
  });

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    status: evaluated.status,
    statusSummary: evaluated.statusSummary,
    operatorNextAction: evaluated.operatorNextAction,
    git: {
      integrationRef,
      integrationCommit: commitSha,
      commitSubject,
      clean: cleanliness.clean,
      dirtyFilesCount: cleanliness.dirtyFiles.length,
      dirtyFiles: cleanliness.dirtyFiles,
      worktreePath: cwd,
    },
    coordination: coordinationState,
    milestones: milestonesSummary,
    playableLoop: playableLoopSummary,
    productDirector: productDirectorSummary,
    activationPreflight: activationPreflightSummary,
    verificationEvidence,
    releaseGatePlan,
    recentCanonicalCommits: recentCommits,
  };
}

export function renderReleaseCandidateText(manifest: ReleaseCandidateManifest): string {
  const lines: string[] = [
    '# THE GRID — RELEASE CANDIDATE MANIFEST',
    `Generated: ${manifest.generatedAt}`,
    `Candidate Status: ${manifest.status}`,
    '',
    `Summary: ${manifest.statusSummary}`,
    `Conservative Operator Next Action: ${manifest.operatorNextAction}`,
    '',
    '## 1. Canonical Integration & Git State',
    `- Integration Ref: ${manifest.git.integrationRef ?? 'MISSING'} @ ${manifest.git.integrationCommit ? manifest.git.integrationCommit.slice(0, 10) : 'MISSING'}`,
    `- Commit Subject: ${manifest.git.commitSubject ?? 'none'}`,
    `- Worktree: ${manifest.git.worktreePath} [${manifest.git.clean ? 'CLEAN' : `DIRTY (${manifest.git.dirtyFilesCount} files)`}]`,
  ];

  if (!manifest.git.clean && manifest.git.dirtyFiles.length > 0) {
    lines.push('  Dirty Paths:');
    for (const file of manifest.git.dirtyFiles.slice(0, 5)) {
      lines.push(`  - ${file}`);
    }
    if (manifest.git.dirtyFiles.length > 5) {
      lines.push(`  - ... and ${manifest.git.dirtyFiles.length - 5} more`);
    }
  }

  lines.push(
    '',
    '## 2. Control Tower Coordination',
    `- Active Claims: ${manifest.coordination.liveClaimsCount} live, ${manifest.coordination.staleClaimsCount} stale`,
  );

  if (manifest.coordination.claims.length > 0) {
    for (const claim of manifest.coordination.claims) {
      const staleBadge = claim.stale ? ' [STALE]' : '';
      lines.push(`  - [${claim.lane}] ${claim.owner}${staleBadge}: ${claim.goal}`);
    }
  }

  lines.push(
    `- Coordination Warnings: ${manifest.coordination.coordinationWarningsCount}`,
  );
  if (manifest.coordination.coordinationWarnings.length > 0) {
    for (const warning of manifest.coordination.coordinationWarnings) {
      lines.push(`  - [${warning.code}] ${warning.message}`);
    }
  }
  lines.push(`- Boardroom Autonomous Run: ${manifest.coordination.boardroomStatus}`);

  lines.push(
    '',
    '## 3. Master Board Milestones',
    `- Integration Progress: ${manifest.milestones.integrated}/${manifest.milestones.total} integrated (${manifest.milestones.percentIntegrated}%)`,
    `- Status Breakdown: ${Object.entries(manifest.milestones.byStatus).map(([status, count]) => `${status}: ${count}`).join(', ')}`,
  );

  if (manifest.milestones.unintegrated.length > 0) {
    lines.push('  Unintegrated Milestones:');
    for (const item of manifest.milestones.unintegrated.slice(0, 5)) {
      lines.push(`  - [${item.status}] ${item.title}: ${item.detail}`);
    }
    if (manifest.milestones.unintegrated.length > 5) {
      lines.push(`  - ... and ${manifest.milestones.unintegrated.length - 5} more`);
    }
  }

  lines.push(
    '',
    '## 4. Playable Loop Readiness',
    `- Score: ${manifest.playableLoop.score}/100 (${manifest.playableLoop.status})`,
    `- Stage Breakdown: ${manifest.playableLoop.stagesGreen} GREEN, ${manifest.playableLoop.stagesYellow} YELLOW, ${manifest.playableLoop.stagesRed} RED across ${manifest.playableLoop.stagesCount} stages`,
    `- Highest-Value Broken Link: ${manifest.playableLoop.highestValueBrokenLink ? `${manifest.playableLoop.highestValueBrokenLink.title} (-${manifest.playableLoop.highestValueBrokenLink.lostPoints} pts)` : 'none'}`,
  );
  if (manifest.playableLoop.highestValueBrokenLink) {
    lines.push(`  Recommended Repair: ${manifest.playableLoop.highestValueBrokenLink.recommendation}`);
  }
  lines.push(
    `- Runtime Verification: ${manifest.playableLoop.runtimeVerificationSummary.verifiedStages} verified, ${manifest.playableLoop.runtimeVerificationSummary.unverifiedStages} pending verification`,
  );

  lines.push(
    '',
    '## 5. Product Director',
    `- Active Recommendations: ${manifest.productDirector.recommendationsCount}`,
    `- Director Briefing: ${manifest.productDirector.directorSummary}`,
  );
  if (manifest.productDirector.recommendations.length > 0) {
    for (const rec of manifest.productDirector.recommendations) {
      lines.push(`  - [${rec.actionType}] ${rec.title} (${rec.specialization}): ${rec.whyNow}`);
    }
  }

  lines.push(
    '',
    '## 6. Production Activation Preflight',
    `- Status: ${manifest.activationPreflight.status} (ready for release gate: ${manifest.activationPreflight.readyForReleaseGate ? 'YES' : 'NO'})`,
    `- Blockers Count: ${manifest.activationPreflight.blockersCount}`,
  );
  if (manifest.activationPreflight.blockers.length > 0) {
    for (const blocker of manifest.activationPreflight.blockers.slice(0, 5)) {
      lines.push(`  - [${blocker.kind}] ${blocker.key}: ${blocker.detail}`);
    }
    if (manifest.activationPreflight.blockers.length > 5) {
      lines.push(`  - ... and ${manifest.activationPreflight.blockers.length - 5} more`);
    }
  }
  lines.push(`- Release Gate Command: ${manifest.activationPreflight.releaseGateCommand}`);

  lines.push(
    '',
    '## 7. Verification Evidence Gates',
  );
  for (const item of manifest.verificationEvidence) {
    lines.push(`- [${item.status}] ${item.name}: ${item.detail}`);
  }

  lines.push(
    '',
    '## 8. Planned Release Gate Steps',
    `- Clean Worktree Required: ${manifest.releaseGatePlan.cleanWorktreeRequired ? 'YES' : 'NO'}`,
    `- Production Next.js Build: ${manifest.releaseGatePlan.skipBuild ? 'SKIPPED' : 'REQUIRED'}`,
  );
  for (const [index, step] of manifest.releaseGatePlan.steps.entries()) {
    const detail = step.command ? ` (command: ${step.command})` : ` (${step.kind})`;
    lines.push(`  ${index + 1}. ${step.label}${detail}`);
  }

  if (manifest.recentCanonicalCommits.length > 0) {
    lines.push(
      '',
      '## 9. Recent Canonical Commits',
    );
    for (const commit of manifest.recentCanonicalCommits) {
      lines.push(`- ${commit.commit} (${commit.at}) ${commit.summary}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

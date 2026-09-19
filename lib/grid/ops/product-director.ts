import type { AgentClaim } from '../../agent-control';
import { scopesOverlap } from '../../agent-control';
import { GRID_MILESTONES } from '../master-board/milestones';
import { prioritizeGridMasterBoard, type GridPriorityRecommendation } from '../master-board/prioritize';
import type {
  GridMasterBoard,
  GridMilestoneStatus,
  GridPromotionStatus,
} from '../master-board/types';
import type { PlayableLoopScore, PlayableLoopStageId } from './playable-loop-score';

export type ProductDirectorActionType = 'IMPLEMENT' | 'INTEGRATE' | 'VERIFY' | 'INVESTIGATE';
export type ProductDirectorSpecialization = 'backend/gameplay' | 'player UI/UX' | 'verification/ops';

export interface GridProductCandidate {
  id: string;
  title: string;
  phase?: string;
  stage?: PlayableLoopStageId;
  status: string;
  actionType: ProductDirectorActionType;
  priority: number;
  safe: boolean;
  actionable: boolean;
  dependencies: string[];
  dependencyStatuses?: Record<string, GridMilestoneStatus | 'UNKNOWN'>;
  evidence: string[];
  specialization?: ProductDirectorSpecialization;
  acceptanceCriteria: string[];
  scopeHints: string[];
  claimPatterns?: string[];
}

export interface GridProductDirectorMilestone {
  id: string;
  title: string;
  phase?: string;
  status: GridMilestoneStatus | string;
  detail?: string;
  owner?: string;
  branch?: string;
  promotion?: GridPromotionStatus;
  warnings?: string[];
}

export type GridProductDirectorBoard =
  Omit<Partial<GridMasterBoard>, 'milestones'> & {
    milestones: GridProductDirectorMilestone[];
    candidates?: GridProductCandidate[];
  };

export interface GridProductDirectorClaim {
  candidateId?: string;
  scope: string[];
  lane?: string;
  branch?: string;
  goal?: string;
}

export interface GridProductDirectorInput {
  masterBoard: GridProductDirectorBoard;
  claims: Array<GridProductDirectorClaim | AgentClaim>;
  limit?: number;
  playableLoopScore?: PlayableLoopScore;
}

export interface GridProductRecommendation extends GridProductCandidate {
  specialization: ProductDirectorSpecialization;
  whyNow: string;
  dependencyContext: string[];
  matchesPlayableBottleneck: boolean;
}

export interface GridProductDirectorResult {
  limit: number;
  directorSummary: string;
  bottleneck: PlayableLoopScore['highestValueBrokenLink'];
  recommendations: GridProductRecommendation[];
}

const LOOP_STAGE_MILESTONES: Record<PlayableLoopStageId, string[]> = {
  entry: ['onboarding'],
  identity: ['onboarding'],
  seasonJoin: ['onboarding'],
  starterTerritory: ['onboarding'],
  mapWorld: ['map-world'],
  action: ['contest-system', 'takeover', 'location-play'],
  consequenceReward: ['economy-core', 'takeover'],
  progression: ['progression'],
  returnExperience: ['return-experience'],
};

const MILESTONE_STATUSES = new Set<GridMilestoneStatus>([
  'INTEGRATED',
  'READY_TO_INTEGRATE',
  'IN_PROGRESS',
  'DIRTY_DORMANT',
  'BLOCKED',
  'REJECTED',
  'SAFE_NEXT_WORK',
  'PLANNED',
  'UNKNOWN',
]);

const PROMOTION_STATUSES = new Set<GridPromotionStatus>([
  'SIDE_BRANCH_ONLY',
  'GRID_INTEGRATION',
  'LOCAL_MAIN',
  'ORIGIN_MAIN',
  'DEPLOYMENT_UNKNOWN',
]);

function isMasterBoard(board: GridProductDirectorBoard): board is GridMasterBoard {
  return Boolean(
    board.version === 1
      && board.health
      && typeof board.health.generatedAt === 'string'
      && board.milestones.every(
        (item) =>
          typeof item.phase === 'string'
          && MILESTONE_STATUSES.has(item.status as GridMilestoneStatus)
          && PROMOTION_STATUSES.has(item.promotion as GridPromotionStatus)
          && typeof item.detail === 'string'
          && Array.isArray(item.warnings)
          && item.warnings.every((warning) => typeof warning === 'string'),
      ),
  );
}

function specializationFor(phase: string | undefined, actionType: ProductDirectorActionType): ProductDirectorSpecialization {
  if (actionType === 'INTEGRATE' || actionType === 'VERIFY') return 'verification/ops';
  if (phase === 'player' || phase === 'identity') return 'player UI/UX';
  return 'backend/gameplay';
}

function derivedCandidate(item: GridPriorityRecommendation): GridProductCandidate {
  const definition = GRID_MILESTONES.find((milestone) => milestone.id === item.id);
  const actionType: ProductDirectorActionType = item.status === 'READY_TO_INTEGRATE' ? 'INTEGRATE' : 'IMPLEMENT';
  return {
    id: item.id,
    title: item.title,
    phase: item.phase,
    status: item.status,
    actionType,
    priority: item.score.total,
    safe: true,
    actionable: true,
    dependencies: item.dependencies,
    dependencyStatuses: item.dependencyStatuses,
    evidence: [item.detail, item.whyNow],
    specialization: specializationFor(item.phase, actionType),
    acceptanceCriteria: [
      actionType === 'INTEGRATE'
        ? item.title + ' is merged into the selected integration ref and targeted checks pass'
        : item.title + ' is implemented with focused verification evidence',
    ],
    scopeHints: [],
    claimPatterns: [
      item.id,
      ...(definition?.lanePatterns ?? []),
      ...(definition?.branchPatterns ?? []),
    ],
  };
}

function candidatesFor(input: GridProductDirectorInput): GridProductCandidate[] {
  if (input.masterBoard.candidates) return input.masterBoard.candidates.map((candidate) => ({ ...candidate }));
  if (!isMasterBoard(input.masterBoard)) return [];
  return prioritizeGridMasterBoard(
    input.masterBoard,
    undefined,
    { limit: input.masterBoard.milestones.length || 1 },
  ).recommendations.map(derivedCandidate);
}

function claimText(claim: GridProductDirectorClaim | AgentClaim): string {
  return [
    'lane' in claim ? claim.lane : '',
    'branch' in claim ? claim.branch : '',
    'goal' in claim ? claim.goal : '',
  ].filter(Boolean).join(' ').toLowerCase();
}

function hasOverlappingClaim(candidate: GridProductCandidate, claims: GridProductDirectorInput['claims']): boolean {
  return claims.some((claim) => {
    if ('candidateId' in claim && claim.candidateId === candidate.id) return true;
    const overlapsScope = claim.scope.some((claimScope) =>
      candidate.scopeHints.some((candidateScope) => scopesOverlap(claimScope, candidateScope)));
    if (overlapsScope) return true;
    const text = claimText(claim);
    return (candidate.claimPatterns ?? [candidate.id])
      .filter(Boolean)
      .some((pattern) => text.includes(pattern.toLowerCase()));
  });
}

function dependencyBlocked(candidate: GridProductCandidate, board: GridProductDirectorBoard): boolean {
  if (candidate.dependencies.length === 0) return false;
  if (candidate.dependencyStatuses) {
    return candidate.dependencies.some((id) => candidate.dependencyStatuses?.[id] !== 'INTEGRATED');
  }
  const statusById = new Map(board.milestones.map((item) => [item.id, item.status]));
  return candidate.dependencies.some((id) => statusById.get(id) !== 'INTEGRATED');
}

function matchesBrokenStage(candidate: GridProductCandidate, score: PlayableLoopScore | undefined): boolean {
  const broken = score?.highestValueBrokenLink;
  if (!broken) return false;
  if (candidate.stage === broken.stageId) return true;
  return LOOP_STAGE_MILESTONES[broken.stageId].includes(candidate.id);
}

function whyNow(candidate: GridProductCandidate, matchesBottleneck: boolean, score: PlayableLoopScore | undefined): string {
  if (matchesBottleneck && score?.highestValueBrokenLink) {
    return 'Repairs the highest-value playable-loop break: ' + score.highestValueBrokenLink.title + '.';
  }
  if (candidate.actionType === 'INTEGRATE') return 'Verified work is ready to integrate; finishing it reduces merge inventory.';
  if (candidate.dependencies.length > 0) return 'Safe actionable work builds on integrated prerequisites and advances downstream value.';
  return 'Highest-leverage safe unclaimed work from the existing prioritizer.';
}

export function recommendGridProductWork(input: GridProductDirectorInput): GridProductDirectorResult {
  const limit = input.limit ?? 3;
  if (!Number.isInteger(limit) || limit < 1) throw new Error('--limit requires a positive integer');

  const candidates = candidatesFor(input);
  const recommendations = candidates
    .filter((candidate) => candidate.safe && candidate.actionable)
    .filter((candidate) => !hasOverlappingClaim(candidate, input.claims))
    .filter((candidate) => !dependencyBlocked(candidate, input.masterBoard))
    .map((candidate) => {
      const matchesPlayableBottleneck = matchesBrokenStage(candidate, input.playableLoopScore);
      const specialization = candidate.specialization ?? specializationFor(candidate.phase, candidate.actionType);
      return {
        ...candidate,
        specialization,
        matchesPlayableBottleneck,
        whyNow: whyNow(candidate, matchesPlayableBottleneck, input.playableLoopScore),
        dependencyContext: candidate.dependencies.length
          ? candidate.dependencies.map((dependency) => dependency + ': integrated')
          : ['none'],
      } satisfies GridProductRecommendation;
    })
    .sort((a, b) => {
      if (a.matchesPlayableBottleneck !== b.matchesPlayableBottleneck) return a.matchesPlayableBottleneck ? -1 : 1;
      const aIntegrate = a.actionType === 'INTEGRATE' ? 1 : 0;
      const bIntegrate = b.actionType === 'INTEGRATE' ? 1 : 0;
      if (aIntegrate !== bIntegrate) return bIntegrate - aIntegrate;
      return b.priority - a.priority || a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
    })
    .slice(0, limit);

  const bottleneck = input.playableLoopScore?.highestValueBrokenLink ?? null;
  const directorSummary = bottleneck
    ? 'Current bottleneck: ' + bottleneck.title + '. Optimize the team for this break first, then integrate ready work and dependency-unlocking tasks.'
    : 'No playable-loop bottleneck is identified; prioritize ready-to-integrate work and the highest-leverage safe unclaimed milestones.';

  return { limit, directorSummary, bottleneck, recommendations };
}

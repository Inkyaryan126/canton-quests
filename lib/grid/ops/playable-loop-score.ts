import fs from 'node:fs';
import path from 'node:path';
import type { GridMasterBoard, GridMilestoneState, GridMilestoneStatus } from '../master-board/types';

export type PlayableLoopStatus = 'GREEN' | 'YELLOW' | 'RED';
export type PlayableLoopStageId =
  | 'entry'
  | 'identity'
  | 'seasonJoin'
  | 'starterTerritory'
  | 'mapWorld'
  | 'action'
  | 'consequenceReward'
  | 'progression'
  | 'returnExperience';

export type PlayableLoopEvidenceSource = 'master-board' | 'repo-probe' | 'integration-test' | 'runtime';
export type PlayableLoopVerification =
  | 'implemented/integrated evidence'
  | 'browser/runtime not yet verified'
  | 'browser/runtime verified'
  | 'missing evidence';

export interface PlayableLoopStageDefinition {
  id: PlayableLoopStageId;
  title: string;
  weight: number;
}

export interface PlayableLoopStageEvidence {
  status: PlayableLoopStatus;
  evidence: string[];
  source: PlayableLoopEvidenceSource;
  runtimeVerified?: boolean;
}

export interface PlayableLoopStageResult extends PlayableLoopStageDefinition {
  status: PlayableLoopStatus;
  contribution: number;
  evidence: string[];
  source: PlayableLoopEvidenceSource | 'missing';
  verification: PlayableLoopVerification;
}

export interface PlayableLoopBrokenLink {
  stageId: PlayableLoopStageId;
  title: string;
  status: PlayableLoopStatus;
  lostPoints: number;
  recommendation: string;
}

export interface PlayableLoopScore {
  version: 1;
  score: number;
  status: PlayableLoopStatus;
  stages: PlayableLoopStageResult[];
  highestValueBrokenLink: PlayableLoopBrokenLink | null;
  integrationRef?: string | null;
}

export interface PlayableLoopScoreInput {
  stages: Partial<Record<PlayableLoopStageId, PlayableLoopStageEvidence>>;
  integrationRef?: string | null;
}

export const PLAYABLE_LOOP_STAGES: readonly PlayableLoopStageDefinition[] = [
  { id: 'entry', title: 'Grid entry / route reachable', weight: 16 },
  { id: 'identity', title: 'Identity + Home City / onboarding', weight: 14 },
  { id: 'seasonJoin', title: 'Season join', weight: 12 },
  { id: 'starterTerritory', title: 'Starter territory / first ownership', weight: 12 },
  { id: 'mapWorld', title: 'Map / world comprehension', weight: 10 },
  { id: 'action', title: 'Meaningful action', weight: 16 },
  { id: 'consequenceReward', title: 'Consequence / reward persistence', weight: 10 },
  { id: 'progression', title: 'Progression / rank visibility', weight: 5 },
  { id: 'returnExperience', title: 'Return experience / next-action clarity', weight: 5 },
];

const STATUS_MULTIPLIER: Record<PlayableLoopStatus, number> = {
  GREEN: 1,
  YELLOW: 0.5,
  RED: 0,
};

const RECOMMENDATIONS: Record<PlayableLoopStageId, string> = {
  entry: 'Make the player route reachable, then verify it in a browser session.',
  identity: 'Repair authenticated Home City/onboarding completion before adding downstream work.',
  seasonJoin: 'Make season join available after confirmed identity and verify the persisted wallet path.',
  starterTerritory: 'Make the first affordable ownership action available and verify its persisted result.',
  mapWorld: 'Expose a readable world projection that explains ownership and the next available move.',
  action: 'Connect one meaningful claim/contest/takeover/location action end to end before polishing.',
  consequenceReward: 'Persist the action consequence or reward server-authoritatively and expose the resulting state.',
  progression: 'Expose server-derived progression and rank immediately after the first meaningful action.',
  returnExperience: 'Show a return briefing with what changed and one concrete next action.',
};

function verificationFor(evidence: PlayableLoopStageEvidence | undefined): PlayableLoopVerification {
  if (!evidence) return 'missing evidence';
  if (evidence.runtimeVerified) return 'browser/runtime verified';
  if (evidence.source === 'runtime') return 'browser/runtime not yet verified';
  return 'browser/runtime not yet verified';
}

function statusForMilestone(state: GridMilestoneState | undefined): PlayableLoopStatus {
  if (!state) return 'YELLOW';
  if (state.status === 'INTEGRATED') return 'GREEN';
  if (state.status === 'READY_TO_INTEGRATE' || state.status === 'IN_PROGRESS' || state.status === 'SAFE_NEXT_WORK') {
    return 'YELLOW';
  }
  return 'RED';
}

function milestoneEvidence(state: GridMilestoneState | undefined): PlayableLoopStageEvidence | undefined {
  if (!state) return undefined;
  return {
    status: statusForMilestone(state),
    evidence: [state.detail, ...(state.evidenceCommit ? [`commit ${state.evidenceCommit}`] : [])],
    source: 'master-board',
  };
}

function findMilestone(board: GridMasterBoard, id: string): GridMilestoneState | undefined {
  return board.milestones.find((milestone) => milestone.id === id);
}

function combineEvidence(items: Array<PlayableLoopStageEvidence | undefined>): PlayableLoopStageEvidence | undefined {
  const present = items.filter((item): item is PlayableLoopStageEvidence => Boolean(item));
  if (present.length === 0) return undefined;
  const best = present.find((item) => item.status === 'GREEN') ?? present.find((item) => item.status === 'YELLOW') ?? present[0];
  return {
    status: best.status,
    evidence: present.flatMap((item) => item.evidence),
    source: best.source,
    runtimeVerified: present.some((item) => item.runtimeVerified),
  };
}

export function scorePlayableLoop(input: PlayableLoopScoreInput): PlayableLoopScore {
  const stages = PLAYABLE_LOOP_STAGES.map((definition) => {
    const evidence = input.stages[definition.id];
    const status = evidence?.status ?? 'YELLOW';
    return {
      ...definition,
      status,
      contribution: definition.weight * STATUS_MULTIPLIER[status],
      evidence: evidence?.evidence ?? ['No current repo evidence supplied.'],
      source: evidence?.source ?? 'missing',
      verification: verificationFor(evidence),
    } satisfies PlayableLoopStageResult;
  });

  const score = stages.reduce((total, stage) => total + stage.contribution, 0);
  const broken = stages
    .map((stage, index) => ({
      stage,
      index,
      lostPoints: stage.weight - stage.contribution,
    }))
    .filter(({ lostPoints }) => lostPoints > 0)
    .sort((a, b) => b.lostPoints - a.lostPoints || a.index - b.index)[0];

  return {
    version: 1,
    score,
    status: score === 100 ? 'GREEN' : stages.some((stage) => stage.status === 'RED') ? 'RED' : 'YELLOW',
    stages,
    highestValueBrokenLink: broken
      ? {
          stageId: broken.stage.id,
          title: broken.stage.title,
          status: broken.stage.status,
          lostPoints: broken.lostPoints,
          recommendation: RECOMMENDATIONS[broken.stage.id],
        }
      : null,
    integrationRef: input.integrationRef,
  };
}

export interface CollectPlayableLoopScoreOptions {
  cwd?: string;
  board: GridMasterBoard;
}

function repoProbe(cwd: string, relativePaths: string[], label: string): PlayableLoopStageEvidence {
  const present = relativePaths.filter((relativePath) => fs.existsSync(path.join(cwd, relativePath)));
  return {
    status: present.length === relativePaths.length ? 'YELLOW' : 'RED',
    evidence: present.length === relativePaths.length
      ? [`${label}: ${present.join(', ')}`]
      : [`${label}: missing ${relativePaths.filter((relativePath) => !present.includes(relativePath)).join(', ')}`],
    source: 'repo-probe',
  };
}

export function collectPlayableLoopScore(options: CollectPlayableLoopScoreOptions): PlayableLoopScore {
  const cwd = options.cwd ?? process.cwd();
  const board = options.board;
  const milestone = (id: string) => milestoneEvidence(findMilestone(board, id));
  const stages: Partial<Record<PlayableLoopStageId, PlayableLoopStageEvidence>> = {
    entry: repoProbe(cwd, ['app/grid/play/route.ts'], 'Grid player entry route'),
    identity: combineEvidence([milestone('onboarding'), repoProbe(cwd, ['app/grid/onboarding/page.tsx', 'app/api/grid/onboarding/home-city/route.ts'], 'Home City onboarding')]),
    seasonJoin: milestone('onboarding'),
    starterTerritory: combineEvidence([milestone('onboarding'), repoProbe(cwd, ['app/api/grid/onboarding/starter-territories/route.ts', 'app/api/grid/onboarding/starter-territories/claim/route.ts'], 'Starter territory flow')]),
    mapWorld: combineEvidence([milestone('map-world'), repoProbe(cwd, ['app/grid/grid-city-map.tsx', 'app/api/grid/world/route.ts'], 'World projection')]),
    action: combineEvidence([milestone('contest-system'), milestone('takeover'), milestone('location-play')]),
    consequenceReward: combineEvidence([milestone('economy-core'), milestone('takeover'), repoProbe(cwd, ['app/api/grid/income/collect/route.ts'], 'Persistent income consequence')]),
    progression: combineEvidence([milestone('progression'), repoProbe(cwd, ['app/api/grid/progression/route.ts', 'app/grid/rankings/page.tsx'], 'Progression visibility')]),
    returnExperience: combineEvidence([milestone('return-experience'), repoProbe(cwd, ['app/grid/return/page.tsx', 'app/api/grid/return-summary/route.ts'], 'Return briefing')]),
  };
  return scorePlayableLoop({ stages, integrationRef: board.health.integrationRef });
}

export function playableLoopStatusFromMilestone(status: GridMilestoneStatus): PlayableLoopStatus {
  return status === 'INTEGRATED' ? 'GREEN' : status === 'PLANNED' ? 'RED' : 'YELLOW';
}

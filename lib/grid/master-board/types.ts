export type GridMilestoneStatus =
  | 'INTEGRATED'
  | 'READY_TO_INTEGRATE'
  | 'IN_PROGRESS'
  | 'BLOCKED'
  | 'PLANNED'
  | 'UNKNOWN';

export type GridPromotionStatus =
  | 'SIDE_BRANCH_ONLY'
  | 'GRID_INTEGRATION'
  | 'LOCAL_MAIN'
  | 'ORIGIN_MAIN'
  | 'DEPLOYMENT_UNKNOWN';

export interface GridMilestoneDefinition {
  id: string;
  title: string;
  phase: string;
  dependsOn: string[];
  lanePatterns: string[];
  branchPatterns: string[];
  integrationCommitSignals: string[];
  notes?: string;
}

export interface GridClaimEvidence {
  lane: string;
  owner: string;
  branch: string;
  stale: boolean;
}
export interface GridBranchEvidence {
  branch: string;
  clean: boolean;
  completionCommit?: string;
  completionSubject?: string;
  mergedIntoIntegration: boolean;
  onLocalMain: boolean;
  onOriginMain: boolean;
}

export interface GridCommitEvidence {
  commit: string;
  subject: string;
  onLocalMain: boolean;
  onOriginMain: boolean;
}

export interface GridMilestoneEvidence {
  activeClaims: GridClaimEvidence[];
  branches: GridBranchEvidence[];
  integrationMatches: GridCommitEvidence[];
  blockers: string[];
  warnings: string[];
  contradictions: string[];
}

export interface GridMilestoneState {
  id: string;
  title: string;
  phase: string;
  status: GridMilestoneStatus;
  promotion: GridPromotionStatus;
  detail: string;
  owner?: string;
  branch?: string;
  evidenceCommit?: string;
  evidenceSubject?: string;
  warnings: string[];
}

export interface GridBoardHealth {
  generatedAt: string;
  integrationRef: string | null;
  integrationCommit: string | null;
  localMainAvailable: boolean;
  originMainAvailable: boolean;
  boardroomAutonomousRunActive: boolean;
  liveClaimCount: number;
  staleClaimCount: number;
  coordinationWarnings: Array<{ code: string; message: string }>;
}

export interface GridMasterBoard {
  version: 1;
  health: GridBoardHealth;
  milestones: GridMilestoneState[];
}

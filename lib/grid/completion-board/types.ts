export type GridV1FeatureStatus =
  | 'COMPLETE'
  | 'IN_PROGRESS'
  | 'NEEDS_VERIFICATION'
  | 'PARTIAL'
  | 'MISSING'
  | 'BLOCKED';

export type GridV1RuntimeEvidenceKind = 'browser-runtime' | 'migration-safety' | 'release-gate';

export interface GridV1RuntimeRequirement {
  kind: GridV1RuntimeEvidenceKind;
  acceptedStatuses: string[];
}

export interface GridV1FeatureDefinition {
  id: string;
  title: string;
  area: string;
  phase: string;
  stage?: string;
  priority: number;
  dependsOn: string[];
  codePaths: string[];
  testPaths: string[];
  runtimeEvidence?: GridV1RuntimeRequirement[];
  scopeHints: string[];
  acceptanceCriteria: string[];
}

export interface GridV1RuntimeEvidenceState {
  kind: GridV1RuntimeEvidenceKind;
  status: string | null;
  current: boolean;
  integrationCommit: string | null;
  summary: string;
  satisfied: boolean;
}

export interface GridV1TestEvidenceState {
  path: string;
  status: 'PASS' | 'FAIL' | 'MISSING';
  current: boolean;
  satisfied: boolean;
  detail?: string;
}

export interface GridV1FeatureState extends GridV1FeatureDefinition {
  status: GridV1FeatureStatus;
  missingCode: string[];
  missingTests: string[];
  testEvidence: GridV1TestEvidenceState[];
  runtime: GridV1RuntimeEvidenceState[];
  activeClaim?: string;
  blockedBy: string[];
  evidence: string[];
}

export interface GridV1CompletionSummary {
  complete: number;
  inProgress: number;
  needsVerification: number;
  partial: number;
  missing: number;
  blocked: number;
  remaining: number;
  total: number;
  percent: number;
}

export interface GridV1CompletionBoard {
  version: 1;
  generatedAt: string;
  canonicalRef: string | null;
  canonicalCommit: string | null;
  testEvidenceCommit: string | null;
  summary: GridV1CompletionSummary;
  features: GridV1FeatureState[];
  warnings: string[];
}

export interface GridV1TestVerificationRecord {
  version: 1;
  kind: 'completion-board-tests';
  integrationRef: string;
  integrationCommit: string;
  recordedAt: string;
  status: 'PASS' | 'FAIL';
  summary: string;
  tests: Record<string, {
    status: 'PASS' | 'FAIL';
    detail?: string;
  }>;
}

export type GridAntiCheatSeverity = 'low' | 'medium' | 'high' | 'critical';

export type GridAntiCheatSignalKind =
  | 'session-actor-mismatch'
  | 'city-scope-mismatch'
  | 'season-scope-mismatch'
  | 'idempotency-collision'
  | 'impossible-state-transition'
  | 'resource-conservation-failure'
  | 'velocity-anomaly'
  | 'collusion-pattern'
  | 'market-manipulation-pattern'
  | 'multi-account-linkage';

export type GridAntiCheatSignalSource =
  | 'server-authority'
  | 'event-ledger'
  | 'database-constraint'
  | 'behavior-analysis';

export interface GridAntiCheatSignal {
  id: string;
  kind: GridAntiCheatSignalKind;
  severity: GridAntiCheatSeverity;
  confidenceBps: number;
  source: GridAntiCheatSignalSource;
  reasonCode: string;
}

export interface GridAntiCheatPolicy {
  severityWeightBps: Record<GridAntiCheatSeverity, number>;
  monitorThresholdBps: number;
  reviewThresholdBps: number;
  hardRejectKinds: GridAntiCheatSignalKind[];
}

export interface GridActionIntegrityFacts {
  actionId: string;
  actorMatchesSession: boolean;
  cityScopeValid: boolean;
  seasonScopeValid: boolean;
  idempotencyCollision: boolean;
  stateTransitionValid: boolean;
  resourceConservationValid: boolean;
}

export type GridAntiCheatDisposition =
  | 'allow'
  | 'monitor'
  | 'review'
  | 'reject-command';

export interface GridAntiCheatAssessment {
  riskScoreBps: number;
  disposition: GridAntiCheatDisposition;
  signalIds: string[];
  hardRejectSignalIds: string[];
}

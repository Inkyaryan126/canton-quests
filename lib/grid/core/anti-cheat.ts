import type {
  GridActionIntegrityFacts,
  GridAntiCheatAssessment,
  GridAntiCheatPolicy,
  GridAntiCheatSeverity,
  GridAntiCheatSignal,
  GridAntiCheatSignalKind,
  GridAntiCheatSignalSource,
} from './anti-cheat-types';

const BASIS_POINTS = 10_000;

const SIGNAL_KINDS: readonly GridAntiCheatSignalKind[] = [
  'session-actor-mismatch',
  'city-scope-mismatch',
  'season-scope-mismatch',
  'idempotency-collision',
  'impossible-state-transition',
  'resource-conservation-failure',
  'velocity-anomaly',
  'collusion-pattern',
  'market-manipulation-pattern',
  'multi-account-linkage',
];

const HARD_INTEGRITY_KINDS = new Set<GridAntiCheatSignalKind>([
  'session-actor-mismatch',
  'city-scope-mismatch',
  'season-scope-mismatch',
  'idempotency-collision',
  'impossible-state-transition',
  'resource-conservation-failure',
]);

const AUTHORITATIVE_SOURCES = new Set<GridAntiCheatSignalSource>([
  'server-authority',
  'event-ledger',
  'database-constraint',
]);

function requireNonBlank(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`Grid anti-cheat requires ${label}`);
  return normalized;
}

function requireBps(value: number, label: string, allowZero = true): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > BASIS_POINTS) {
    throw new Error(`${label} must be integer basis points between 0 and 10000`);
  }
  if (!allowZero && value === 0) {
    throw new Error(`${label} must be greater than zero`);
  }
}

function isKnownKind(kind: string): kind is GridAntiCheatSignalKind {
  return (SIGNAL_KINDS as readonly string[]).includes(kind);
}

export function validateGridAntiCheatPolicy(policy: GridAntiCheatPolicy): void {
  for (const severity of ['low', 'medium', 'high', 'critical'] as GridAntiCheatSeverity[]) {
    requireBps(policy.severityWeightBps[severity], `severityWeightBps.${severity}`, false);
  }
  requireBps(policy.monitorThresholdBps, 'monitor threshold', false);
  requireBps(policy.reviewThresholdBps, 'review threshold', false);
  if (policy.monitorThresholdBps >= policy.reviewThresholdBps) {
    throw new Error('Grid anti-cheat thresholds require monitor threshold below review threshold');
  }

  const seen = new Set<GridAntiCheatSignalKind>();
  for (const kind of policy.hardRejectKinds) {
    if (!isKnownKind(kind)) throw new Error(`Unknown anti-cheat hard reject kind: ${kind}`);
    if (!HARD_INTEGRITY_KINDS.has(kind)) {
      throw new Error(`Behavioral anti-cheat kind cannot be configured as hard reject: ${kind}`);
    }
    if (seen.has(kind)) throw new Error(`Duplicate anti-cheat hard reject kind: ${kind}`);
    seen.add(kind);
  }
}

function validateSignal(signal: GridAntiCheatSignal): void {
  requireNonBlank(signal.id, 'signal.id');
  requireNonBlank(signal.reasonCode, 'signal.reasonCode');
  if (!isKnownKind(signal.kind)) throw new Error(`Unknown anti-cheat signal kind: ${signal.kind}`);
  requireBps(signal.confidenceBps, 'signal confidence', false);

  if (HARD_INTEGRITY_KINDS.has(signal.kind) && !AUTHORITATIVE_SOURCES.has(signal.source)) {
    throw new Error(`Hard-integrity anti-cheat signal requires authoritative source: ${signal.id}`);
  }
}

function sameSignal(left: GridAntiCheatSignal, right: GridAntiCheatSignal): boolean {
  return left.id === right.id
    && left.kind === right.kind
    && left.severity === right.severity
    && left.confidenceBps === right.confidenceBps
    && left.source === right.source
    && left.reasonCode === right.reasonCode;
}

function weightedContribution(signal: GridAntiCheatSignal, policy: GridAntiCheatPolicy): number {
  return Number(
    (BigInt(policy.severityWeightBps[signal.severity]) * BigInt(signal.confidenceBps))
      / BigInt(BASIS_POINTS),
  );
}

export function assessGridAntiCheatRisk(
  signals: readonly GridAntiCheatSignal[],
  policy: GridAntiCheatPolicy,
): GridAntiCheatAssessment {
  validateGridAntiCheatPolicy(policy);

  const byId = new Map<string, GridAntiCheatSignal>();
  for (const candidate of signals) {
    validateSignal(candidate);
    const copy = { ...candidate };
    const existing = byId.get(copy.id);
    if (existing && !sameSignal(existing, copy)) {
      throw new Error(`Conflicting anti-cheat evidence for signal id: ${copy.id}`);
    }
    if (!existing) byId.set(copy.id, copy);
  }

  const unique = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
  let riskScoreBps = 0;
  for (const signal of unique) {
    riskScoreBps = Math.min(
      BASIS_POINTS,
      riskScoreBps + weightedContribution(signal, policy),
    );
  }

  const hardKinds = new Set(policy.hardRejectKinds);
  const hardRejectSignalIds = unique
    .filter((signal) => hardKinds.has(signal.kind) && AUTHORITATIVE_SOURCES.has(signal.source))
    .map((signal) => signal.id);

  const disposition = hardRejectSignalIds.length > 0
    ? 'reject-command'
    : riskScoreBps >= policy.reviewThresholdBps
      ? 'review'
      : riskScoreBps >= policy.monitorThresholdBps
        ? 'monitor'
        : 'allow';

  return {
    riskScoreBps,
    disposition,
    signalIds: unique.map((signal) => signal.id),
    hardRejectSignalIds,
  };
}

interface DerivedSignalTemplate {
  failed: boolean;
  kind: GridAntiCheatSignalKind;
  severity: GridAntiCheatSeverity;
  source: GridAntiCheatSignalSource;
  reasonCode: string;
}

export function deriveGridActionIntegritySignals(
  facts: GridActionIntegrityFacts,
): GridAntiCheatSignal[] {
  const actionId = requireNonBlank(facts.actionId, 'actionId');
  const templates: DerivedSignalTemplate[] = [
    {
      failed: !facts.actorMatchesSession,
      kind: 'session-actor-mismatch',
      severity: 'critical',
      source: 'server-authority',
      reasonCode: 'actor-session-mismatch',
    },
    {
      failed: !facts.cityScopeValid,
      kind: 'city-scope-mismatch',
      severity: 'critical',
      source: 'server-authority',
      reasonCode: 'city-scope-invalid',
    },
    {
      failed: !facts.seasonScopeValid,
      kind: 'season-scope-mismatch',
      severity: 'critical',
      source: 'server-authority',
      reasonCode: 'season-scope-invalid',
    },
    {
      failed: facts.idempotencyCollision,
      kind: 'idempotency-collision',
      severity: 'high',
      source: 'event-ledger',
      reasonCode: 'idempotency-collision',
    },
    {
      failed: !facts.stateTransitionValid,
      kind: 'impossible-state-transition',
      severity: 'critical',
      source: 'server-authority',
      reasonCode: 'state-transition-invalid',
    },
    {
      failed: !facts.resourceConservationValid,
      kind: 'resource-conservation-failure',
      severity: 'critical',
      source: 'server-authority',
      reasonCode: 'resource-conservation-failed',
    },
  ];

  return templates
    .filter((template) => template.failed)
    .map((template) => ({
      id: `${actionId}:${template.kind}`,
      kind: template.kind,
      severity: template.severity,
      confidenceBps: BASIS_POINTS,
      source: template.source,
      reasonCode: template.reasonCode,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

import type {
  GridActivityAccessPolicy,
  GridActivityCompletionMode,
  GridLocationAttestation,
  GridLocationEnhancementBenefit,
  GridLocationEnhancementContext,
  GridLocationEnhancementDecision,
  GridLocationEnhancementRule,
} from './location-enhancement-types';

const MINUTE_MS = 60 * 1000;
const FORBIDDEN_RAW_LOCATION_KEYS = new Set([
  'lat',
  'lng',
  'latitude',
  'longitude',
  'coordinates',
  'coordinate',
  'accuracy',
  'accuracyMeters',
]);

function nonBlank(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error('Grid location enhancement requires ' + field);
  }
  return normalized;
}

function timestamp(value: string, field: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new Error('Grid location enhancement requires valid ' + field);
  }
  return parsed;
}

function positiveSafeInteger(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(
      'Grid location enhancement requires ' + field + ' to be a positive safe integer',
    );
  }
  return value;
}

function nonNegativeSafeInteger(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(
      'Grid location enhancement requires ' +
        field +
        ' to be a non-negative safe integer',
    );
  }
  return value;
}

function positiveBasisPoints(value: number, field: string): number {
  positiveSafeInteger(value, field);
  if (value > 10_000) {
    throw new Error(
      'Grid location enhancement requires ' + field + ' to be at most 10000',
    );
  }
  return value;
}

function validateBenefit(benefit: GridLocationEnhancementBenefit): void {
  switch (benefit.kind) {
    case 'scouting-intel':
      nonBlank(benefit.intelId, 'intel id');
      return;
    case 'resource-cache': {
      const entries = [
        benefit.credits,
        benefit.influence,
        benefit.commandPoints,
      ].filter((value): value is number => value !== undefined);

      if (entries.length === 0) {
        throw new Error(
          'Grid location enhancement resource cache requires at least one resource',
        );
      }
      for (const value of entries) {
        positiveSafeInteger(value, 'resource cache amount');
      }
      return;
    }
    case 'temporary-modifier':
      nonBlank(benefit.modifierId, 'modifier id');
      positiveBasisPoints(benefit.basisPoints, 'modifier basis points');
      positiveSafeInteger(benefit.durationMinutes, 'modifier duration minutes');
      return;
    case 'cost-reduction':
      nonBlank(benefit.targetId, 'cost reduction target id');
      positiveBasisPoints(benefit.basisPoints, 'cost reduction basis points');
      positiveSafeInteger(benefit.uses, 'cost reduction uses');
      return;
    case 'optional-event-access':
      nonBlank(benefit.eventId, 'optional event id');
      return;
    case 'crossover-reward':
      nonBlank(benefit.rewardId, 'crossover reward id');
      return;
  }
}

export function validateGridActivityAccessPolicy(
  policy: GridActivityAccessPolicy,
): void {
  nonBlank(policy.activityId, 'activity id');

  if (policy.completionModes.length === 0) {
    throw new Error(
      'Grid activity access policy requires at least one completion mode',
    );
  }

  const uniqueModes = new Set<GridActivityCompletionMode>(
    policy.completionModes,
  );
  if (uniqueModes.size !== policy.completionModes.length) {
    throw new Error(
      'Grid activity access policy cannot repeat a completion mode',
    );
  }

  if (
    policy.importance === 'essential' &&
    !uniqueModes.has('remote')
  ) {
    throw new Error(
      'Grid essential activity must remain remotely completable',
    );
  }
}

export function canCompleteGridActivity(
  policy: GridActivityAccessPolicy,
  mode: GridActivityCompletionMode,
): boolean {
  validateGridActivityAccessPolicy(policy);
  return policy.completionModes.includes(mode);
}

export function validateGridLocationEnhancementRule(
  rule: GridLocationEnhancementRule,
): void {
  nonBlank(rule.id, 'rule id');
  nonBlank(rule.zoneId, 'zone id');
  positiveSafeInteger(
    rule.verificationMaxAgeMinutes,
    'verification max age minutes',
  );
  validateBenefit(rule.benefit);

  const startsAtMs =
    rule.startsAt === undefined
      ? null
      : timestamp(rule.startsAt, 'rule startsAt');
  const endsAtMs =
    rule.endsAt === undefined ? null : timestamp(rule.endsAt, 'rule endsAt');

  if (
    startsAtMs !== null &&
    endsAtMs !== null &&
    startsAtMs > endsAtMs
  ) {
    throw new Error(
      'Grid location enhancement rule cannot end before it starts',
    );
  }

  if (rule.maxClaimsPerPlayer !== undefined) {
    positiveSafeInteger(rule.maxClaimsPerPlayer, 'max claims per player');
  }
}

export function assertPrivacySafeLocationAttestation(
  attestation: GridLocationAttestation,
): void {
  nonBlank(attestation.verificationId, 'verification id');
  nonBlank(attestation.zoneId, 'attestation zone id');
  timestamp(attestation.verifiedAt, 'attestation verifiedAt');

  for (const key of Object.keys(attestation as unknown as Record<string, unknown>)) {
    if (FORBIDDEN_RAW_LOCATION_KEYS.has(key)) {
      throw new Error(
        'Grid location attestation must not contain raw coordinates or accuracy',
      );
    }
  }
}

function decision(
  rule: GridLocationEnhancementRule,
  attestation: GridLocationAttestation | null,
  reason: GridLocationEnhancementDecision['reason'],
  eligible = false,
): GridLocationEnhancementDecision {
  return {
    eligible,
    reason,
    ruleId: rule.id.trim(),
    verificationId: attestation?.verificationId.trim() ?? null,
    benefit: eligible ? rule.benefit : null,
  };
}

export function resolveGridLocationEnhancement(
  rule: GridLocationEnhancementRule,
  attestation: GridLocationAttestation | null,
  context: GridLocationEnhancementContext,
): GridLocationEnhancementDecision {
  validateGridLocationEnhancementRule(rule);
  const nowMs = timestamp(context.now, 'evaluation time');
  nonNegativeSafeInteger(context.priorClaimCount, 'prior claim count');

  if (!attestation) {
    return decision(rule, null, 'presence-not-verified');
  }

  assertPrivacySafeLocationAttestation(attestation);

  if (attestation.zoneId.trim() !== rule.zoneId.trim()) {
    return decision(rule, attestation, 'zone-mismatch');
  }

  const startsAtMs =
    rule.startsAt === undefined ? null : Date.parse(rule.startsAt);
  const endsAtMs =
    rule.endsAt === undefined ? null : Date.parse(rule.endsAt);
  const verifiedAtMs = Date.parse(attestation.verifiedAt);

  if (startsAtMs !== null && nowMs < startsAtMs) {
    return decision(rule, attestation, 'not-started');
  }

  if (endsAtMs !== null && nowMs > endsAtMs) {
    return decision(rule, attestation, 'ended');
  }

  if (startsAtMs !== null && verifiedAtMs < startsAtMs) {
    return decision(rule, attestation, 'verification-before-window');
  }

  if (verifiedAtMs > nowMs) {
    return decision(rule, attestation, 'verification-after-evaluation');
  }

  if (
    nowMs - verifiedAtMs >
    rule.verificationMaxAgeMinutes * MINUTE_MS
  ) {
    return decision(rule, attestation, 'verification-expired');
  }

  if (
    rule.maxClaimsPerPlayer !== undefined &&
    context.priorClaimCount >= rule.maxClaimsPerPlayer
  ) {
    return decision(rule, attestation, 'claim-limit-reached');
  }

  return decision(rule, attestation, 'eligible', true);
}

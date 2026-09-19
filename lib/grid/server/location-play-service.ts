import { randomUUID } from 'node:crypto';
import { claimGridLocationEnhancement } from './location-enhancement-service';
import type { GridLocationEnhancementPort } from './location-enhancement-port';
import {
  issueGridLocationAttestationToken,
  verifyGridLocationAttestationToken,
} from './location-attestation-token';
import type { GridLocationPlayConfigPort } from './location-play-config-port';
import {
  verifyGridLocationPresence,
  type GridLocationPresenceMeasurement,
} from './location-presence-verifier';

const MAX_ATTESTATION_TTL_MINUTES = 15;

function required(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`Grid location play requires ${field}`);
  return normalized;
}

function validNow(value: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error('Grid location play requires valid server time');
  return parsed;
}

function ensureSeasonCanPlay(
  scope: { seasonStatus: string; startsAt: string | null; endsAt: string | null },
  nowMs: number,
): void {
  if (!['active', 'surge'].includes(scope.seasonStatus)) {
    throw new Error('Grid location play season is not active');
  }
  if (scope.startsAt && nowMs < Date.parse(scope.startsAt)) {
    throw new Error('Grid location play season has not started');
  }
  if (scope.endsAt && nowMs >= Date.parse(scope.endsAt)) {
    throw new Error('Grid location play season has ended');
  }
}

export async function verifyGridLocationEnhancementPresence(
  configPort: GridLocationPlayConfigPort,
  input: {
    citySlug: string;
    seasonSlug: string;
    ruleId: string;
    playerId: string;
    measurement: GridLocationPresenceMeasurement;
    now: string;
  },
  options: { secret: string; verificationIdFactory?: () => string },
): Promise<
  | { status: 'verified'; token: string; ruleId: string; expiresAt: string }
  | { status: 'ineligible'; reason: 'accuracy-insufficient' | 'outside-zone' }
  | { status: 'unavailable'; reason: 'rule-not-found' }
> {
  const citySlug = required(input.citySlug, 'citySlug');
  const seasonSlug = required(input.seasonSlug, 'seasonSlug');
  const ruleId = required(input.ruleId, 'ruleId');
  const playerId = required(input.playerId, 'playerId');
  const nowMs = validNow(input.now);

  const scope = await configPort.resolveRule(citySlug, seasonSlug, ruleId);
  if (!scope) return { status: 'unavailable', reason: 'rule-not-found' };
  ensureSeasonCanPlay(scope, nowMs);

  const presence = verifyGridLocationPresence(scope.zone, input.measurement);
  if (!presence.verified) {
    return { status: 'ineligible', reason: presence.reason };
  }

  const ttlMinutes = Math.min(
    scope.rule.verificationMaxAgeMinutes,
    MAX_ATTESTATION_TTL_MINUTES,
  );
  let expiresAtMs = nowMs + ttlMinutes * 60_000;
  if (scope.endsAt) expiresAtMs = Math.min(expiresAtMs, Date.parse(scope.endsAt));
  if (expiresAtMs <= nowMs) {
    throw new Error('Grid location play verification has no valid lifetime');
  }
  const expiresAt = new Date(expiresAtMs).toISOString();
  const verificationId = (options.verificationIdFactory ?? randomUUID)();
  const token = issueGridLocationAttestationToken(
    {
      verificationId,
      zoneId: scope.zone.id,
      playerId,
      seasonId: scope.seasonId,
      verifiedAt: input.now,
      expiresAt,
    },
    options.secret,
  );

  return { status: 'verified', token, ruleId: scope.rule.id, expiresAt };
}

export async function claimVerifiedGridLocationEnhancement(
  configPort: GridLocationPlayConfigPort,
  grantPort: GridLocationEnhancementPort,
  input: {
    citySlug: string;
    seasonSlug: string;
    ruleId: string;
    playerId: string;
    attestationToken: string;
    idempotencyKey: string;
    now: string;
  },
  options: { secret: string },
) {
  const citySlug = required(input.citySlug, 'citySlug');
  const seasonSlug = required(input.seasonSlug, 'seasonSlug');
  const ruleId = required(input.ruleId, 'ruleId');
  const playerId = required(input.playerId, 'playerId');
  const token = required(input.attestationToken, 'attestationToken');
  const idempotencyKey = required(input.idempotencyKey, 'idempotencyKey');
  const nowMs = validNow(input.now);

  const scope = await configPort.resolveRule(citySlug, seasonSlug, ruleId);
  if (!scope) throw new Error('Grid location play rule not found');

  // A response can be lost after the database commits. Reconcile a retry
  // before checking the short-lived proof so an expired token cannot turn a
  // durable idempotent claim into a false failure.
  const existing = await grantPort.findByIdempotencyKey(
    scope.seasonId,
    playerId,
    idempotencyKey,
  );
  if (existing) {
    if (existing.ruleId.trim() !== scope.rule.id.trim()) {
      throw new Error(
        'Grid location enhancement idempotency key belongs to another rule',
      );
    }
    return claimGridLocationEnhancement(grantPort, {
      seasonId: scope.seasonId,
      playerId,
      rule: scope.rule,
      attestation: null,
      idempotencyKey,
      now: input.now,
    });
  }

  ensureSeasonCanPlay(scope, nowMs);

  const attestation = verifyGridLocationAttestationToken({
    token,
    secret: options.secret,
    expectedPlayerId: playerId,
    expectedSeasonId: scope.seasonId,
    now: input.now,
  });

  return claimGridLocationEnhancement(grantPort, {
    seasonId: scope.seasonId,
    playerId,
    rule: scope.rule,
    attestation,
    idempotencyKey,
    now: input.now,
  });
}

import { resolveGridLocationEnhancement } from '../core/location-enhancement';
import type {
  GridLocationAttestation,
  GridLocationEnhancementDecision,
  GridLocationEnhancementRule,
} from '../core/location-enhancement-types';
import type {
  GridLocationEnhancementGrantRecord,
  GridLocationEnhancementPort,
} from './location-enhancement-port';

export interface ClaimGridLocationEnhancementRequest {
  seasonId: string;
  playerId: string;
  rule: GridLocationEnhancementRule;
  attestation: GridLocationAttestation | null;
  idempotencyKey: string;
  now: string;
}

export type ClaimGridLocationEnhancementResult =
  | {
      status: 'granted';
      duplicate: boolean;
      grant: GridLocationEnhancementGrantRecord;
      decision: GridLocationEnhancementDecision;
    }
  | {
      status: 'ineligible';
      duplicate: false;
      grant: null;
      decision: GridLocationEnhancementDecision;
    };

function required(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error('Grid location enhancement claim requires ' + field);
  }
  return normalized;
}

function grantedDecision(
  rule: GridLocationEnhancementRule,
  verificationId: string,
): GridLocationEnhancementDecision {
  return {
    eligible: true,
    reason: 'eligible',
    ruleId: rule.id.trim(),
    verificationId: verificationId.trim(),
    benefit: rule.benefit,
  };
}

export async function claimGridLocationEnhancement(
  port: GridLocationEnhancementPort,
  request: ClaimGridLocationEnhancementRequest,
): Promise<ClaimGridLocationEnhancementResult> {
  const seasonId = required(request.seasonId, 'seasonId');
  const playerId = required(request.playerId, 'playerId');
  const idempotencyKey = required(request.idempotencyKey, 'idempotencyKey');

  if (!Number.isFinite(Date.parse(request.now))) {
    throw new Error(
      'Grid location enhancement claim requires a valid server timestamp',
    );
  }

  const existing = await port.findByIdempotencyKey(
    seasonId,
    playerId,
    idempotencyKey,
  );

  if (existing) {
    return {
      status: 'granted',
      duplicate: true,
      grant: existing,
      decision: grantedDecision(request.rule, existing.verificationId),
    };
  }

  const priorClaimCount = await port.countRuleClaims(
    seasonId,
    playerId,
    request.rule.id,
  );

  const decision = resolveGridLocationEnhancement(
    request.rule,
    request.attestation,
    {
      now: request.now,
      priorClaimCount,
    },
  );

  if (!decision.eligible || !request.attestation || !decision.benefit) {
    return {
      status: 'ineligible',
      duplicate: false,
      grant: null,
      decision,
    };
  }

  const persisted = await port.insertGrantAtomic({
    seasonId,
    playerId,
    ruleId: request.rule.id.trim(),
    verificationId: request.attestation.verificationId.trim(),
    benefit: decision.benefit,
    idempotencyKey,
    claimedAt: request.now,
    maxClaimsPerPlayer: request.rule.maxClaimsPerPlayer ?? null,
  });

  if (persisted.limitReached) {
    return {
      status: 'ineligible',
      duplicate: false,
      grant: null,
      decision: {
        ...decision,
        eligible: false,
        reason: 'claim-limit-reached',
        benefit: null,
      },
    };
  }

  if (!persisted.grant) {
    throw new Error(
      'Grid location enhancement persistence returned no grant',
    );
  }

  return {
    status: 'granted',
    duplicate: persisted.duplicate,
    grant: persisted.grant,
    decision,
  };
}

import { createHmac, timingSafeEqual } from 'node:crypto';
import type { GridLocationAttestation } from '../core/location-enhancement-types';

const TOKEN_VERSION = 1;
const MIN_SECRET_BYTES = 32;

interface GridLocationAttestationTokenPayload {
  v: typeof TOKEN_VERSION;
  verificationId: string;
  zoneId: string;
  playerId: string;
  seasonId: string;
  verifiedAt: string;
  expiresAt: string;
}

export interface IssueGridLocationAttestationTokenInput {
  verificationId: string;
  zoneId: string;
  playerId: string;
  seasonId: string;
  verifiedAt: string;
  expiresAt: string;
}

export interface VerifyGridLocationAttestationTokenInput {
  token: string;
  secret: string;
  expectedPlayerId: string;
  expectedSeasonId: string;
  now: string;
}

function required(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error('Grid location attestation token requires ' + field);
  }
  return normalized;
}

function timestamp(value: string, field: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new Error('Grid location attestation token requires valid ' + field);
  }
  return parsed;
}

function requireSecret(secret: string): string {
  if (Buffer.byteLength(secret, 'utf8') < MIN_SECRET_BYTES) {
    throw new Error(
      'Grid location attestation token secret must be at least 32 bytes',
    );
  }
  return secret;
}

function encode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function decode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function signature(payloadSegment: string, secret: string): Buffer {
  return createHmac('sha256', secret).update(payloadSegment).digest();
}

function parsePayload(payloadSegment: string): GridLocationAttestationTokenPayload {
  let raw: unknown;
  try {
    raw = JSON.parse(decode(payloadSegment));
  } catch {
    throw new Error('Grid location attestation token payload is invalid');
  }

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Grid location attestation token payload is invalid');
  }

  const payload = raw as Record<string, unknown>;
  if (
    payload.v !== TOKEN_VERSION ||
    typeof payload.verificationId !== 'string' ||
    typeof payload.zoneId !== 'string' ||
    typeof payload.playerId !== 'string' ||
    typeof payload.seasonId !== 'string' ||
    typeof payload.verifiedAt !== 'string' ||
    typeof payload.expiresAt !== 'string'
  ) {
    throw new Error('Grid location attestation token payload is invalid');
  }

  return {
    v: TOKEN_VERSION,
    verificationId: required(payload.verificationId, 'verificationId'),
    zoneId: required(payload.zoneId, 'zoneId'),
    playerId: required(payload.playerId, 'playerId'),
    seasonId: required(payload.seasonId, 'seasonId'),
    verifiedAt: payload.verifiedAt,
    expiresAt: payload.expiresAt,
  };
}

export function issueGridLocationAttestationToken(
  input: IssueGridLocationAttestationTokenInput,
  secret: string,
): string {
  requireSecret(secret);

  const payload: GridLocationAttestationTokenPayload = {
    v: TOKEN_VERSION,
    verificationId: required(input.verificationId, 'verificationId'),
    zoneId: required(input.zoneId, 'zoneId'),
    playerId: required(input.playerId, 'playerId'),
    seasonId: required(input.seasonId, 'seasonId'),
    verifiedAt: input.verifiedAt,
    expiresAt: input.expiresAt,
  };

  const verifiedAtMs = timestamp(payload.verifiedAt, 'verifiedAt');
  const expiresAtMs = timestamp(payload.expiresAt, 'expiresAt');
  if (expiresAtMs <= verifiedAtMs) {
    throw new Error(
      'Grid location attestation token must expire after verification',
    );
  }

  const payloadSegment = encode(JSON.stringify(payload));
  const signatureSegment = signature(payloadSegment, secret).toString(
    'base64url',
  );

  return payloadSegment + '.' + signatureSegment;
}

export function verifyGridLocationAttestationToken(
  input: VerifyGridLocationAttestationTokenInput,
): GridLocationAttestation {
  const secret = requireSecret(input.secret);
  const expectedPlayerId = required(
    input.expectedPlayerId,
    'expectedPlayerId',
  );
  const expectedSeasonId = required(
    input.expectedSeasonId,
    'expectedSeasonId',
  );
  const nowMs = timestamp(input.now, 'now');

  const parts = input.token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error('Grid location attestation token format is invalid');
  }

  const expectedSignature = signature(parts[0], secret);
  let suppliedSignature: Buffer;
  try {
    suppliedSignature = Buffer.from(parts[1], 'base64url');
  } catch {
    throw new Error('Grid location attestation token signature is invalid');
  }

  if (
    suppliedSignature.length !== expectedSignature.length ||
    !timingSafeEqual(suppliedSignature, expectedSignature)
  ) {
    throw new Error('Grid location attestation token signature is invalid');
  }

  const payload = parsePayload(parts[0]);
  const verifiedAtMs = timestamp(payload.verifiedAt, 'verifiedAt');
  const expiresAtMs = timestamp(payload.expiresAt, 'expiresAt');

  if (payload.playerId !== expectedPlayerId) {
    throw new Error(
      'Grid location attestation token belongs to a different player',
    );
  }

  if (payload.seasonId !== expectedSeasonId) {
    throw new Error(
      'Grid location attestation token belongs to a different season',
    );
  }

  if (verifiedAtMs > nowMs) {
    throw new Error(
      'Grid location attestation token verification is in the future',
    );
  }

  if (expiresAtMs <= verifiedAtMs) {
    throw new Error(
      'Grid location attestation token expiry is invalid',
    );
  }

  if (nowMs > expiresAtMs) {
    throw new Error('Grid location attestation token has expired');
  }

  return {
    verificationId: payload.verificationId,
    zoneId: payload.zoneId,
    verifiedAt: payload.verifiedAt,
  };
}

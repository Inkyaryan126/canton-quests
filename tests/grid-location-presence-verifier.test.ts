import { describe, expect, it } from 'vitest';
import {
  verifyGridLocationPresence,
  type GridLocationPresenceZone,
} from '../lib/grid/server/location-presence-verifier';
import {
  claimVerifiedGridLocationEnhancement,
  verifyGridLocationEnhancementPresence,
} from '../lib/grid/server/location-play-service';
import type { GridLocationPlayConfigPort } from '../lib/grid/server/location-play-config-port';
import type {
  GridLocationEnhancementGrantRecord,
  GridLocationEnhancementPort,
} from '../lib/grid/server/location-enhancement-port';
import { verifyGridLocationAttestationToken } from '../lib/grid/server/location-attestation-token';

const secret = 'location-test-secret-that-is-more-than-thirty-two-bytes';
const now = '2026-09-19T02:10:00.000Z';
const zone: GridLocationPresenceZone = {
  id: 'centennial-plaza-zone',
  latitude: 40.7989,
  longitude: -81.3748,
  radiusMeters: 120,
  maxAccuracyMeters: 40,
};

function configPort(): GridLocationPlayConfigPort {
  return {
    resolveRule: async () => ({
      cityId: 'city-1',
      seasonId: 'season-1',
      seasonStatus: 'active',
      startsAt: '2026-09-01T00:00:00.000Z',
      endsAt: '2026-10-01T00:00:00.000Z',
      rule: {
        id: 'plaza-intel',
        zoneId: zone.id,
        benefit: { kind: 'scouting-intel', intelId: 'plaza-intel-cache' },
        verificationMaxAgeMinutes: 5,
        maxClaimsPerPlayer: 1,
      },
      zone,
    }),
  };
}

function grantPort(
  existingGrant?: GridLocationEnhancementGrantRecord,
): GridLocationEnhancementPort {
  return {
    findByIdempotencyKey: async () => existingGrant ?? null,
    countRuleClaims: async () => 0,
    insertGrantAtomic: async (input) => ({
      duplicate: false,
      limitReached: false,
      grant: {
        id: 'grant-1',
        seasonId: input.seasonId,
        playerId: input.playerId,
        ruleId: input.ruleId,
        verificationId: input.verificationId,
        benefit: input.benefit,
        idempotencyKey: input.idempotencyKey,
        claimedAt: input.claimedAt,
      },
    }),
  };
}

describe('Grid server-side location presence verifier', () => {
  it('accepts a precise measurement fully inside the configured zone', () => {
    expect(verifyGridLocationPresence(zone, {
      latitude: 40.7989,
      longitude: -81.3748,
      accuracyMeters: 12,
    })).toEqual({ verified: true, reason: 'verified' });
  });

  it('fails closed for weak accuracy even at the zone center', () => {
    expect(verifyGridLocationPresence(zone, {
      latitude: 40.7989,
      longitude: -81.3748,
      accuracyMeters: 80,
    })).toEqual({ verified: false, reason: 'accuracy-insufficient' });
  });

  it('requires the accuracy envelope to fit inside the zone', () => {
    expect(verifyGridLocationPresence(zone, {
      latitude: 40.79985,
      longitude: -81.3748,
      accuracyMeters: 30,
    })).toEqual({ verified: false, reason: 'outside-zone' });
  });

  it('rejects malformed raw measurements before distance evaluation', () => {
    expect(() => verifyGridLocationPresence(zone, {
      latitude: 100,
      longitude: -81.3748,
      accuracyMeters: 5,
    })).toThrow(/latitude/);
  });
});

describe('Grid location play proof and claim flow', () => {
  it('issues a short-lived player/season-bound proof with no raw coordinates', async () => {
    const result = await verifyGridLocationEnhancementPresence(
      configPort(),
      {
        citySlug: 'canton-oh',
        seasonSlug: 'founding-season',
        ruleId: 'plaza-intel',
        playerId: 'player-1',
        measurement: {
          latitude: 40.7989,
          longitude: -81.3748,
          accuracyMeters: 10,
        },
        now,
      },
      { secret, verificationIdFactory: () => 'verify-1' },
    );

    expect(result.status).toBe('verified');
    if (result.status !== 'verified') throw new Error('expected verified');
    const attestation = verifyGridLocationAttestationToken({
      token: result.token,
      secret,
      expectedPlayerId: 'player-1',
      expectedSeasonId: 'season-1',
      now,
    });
    expect(attestation).toEqual({
      verificationId: 'verify-1',
      zoneId: 'centennial-plaza-zone',
      verifiedAt: now,
    });
    expect(result).not.toHaveProperty('latitude');
    expect(result).not.toHaveProperty('longitude');
    expect(result).not.toHaveProperty('accuracyMeters');
  });

  it('never issues a proof when server-side presence evaluation fails', async () => {
    await expect(verifyGridLocationEnhancementPresence(
      configPort(),
      {
        citySlug: 'canton-oh', seasonSlug: 'founding-season', ruleId: 'plaza-intel', playerId: 'player-1', now,
        measurement: { latitude: 40.81, longitude: -81.37, accuracyMeters: 10 },
      },
      { secret, verificationIdFactory: () => 'verify-2' },
    )).resolves.toEqual({ status: 'ineligible', reason: 'outside-zone' });
  });

  it('claims only after verifying the signed proof against auth player and server season', async () => {
    const verified = await verifyGridLocationEnhancementPresence(
      configPort(),
      {
        citySlug: 'canton-oh', seasonSlug: 'founding-season', ruleId: 'plaza-intel', playerId: 'player-1', now,
        measurement: { latitude: 40.7989, longitude: -81.3748, accuracyMeters: 10 },
      },
      { secret, verificationIdFactory: () => 'verify-3' },
    );
    if (verified.status !== 'verified') throw new Error('expected verified');

    const result = await claimVerifiedGridLocationEnhancement(
      configPort(), grantPort(),
      {
        citySlug: 'canton-oh', seasonSlug: 'founding-season', ruleId: 'plaza-intel', playerId: 'player-1',
        attestationToken: verified.token, idempotencyKey: 'location-claim-1', now,
      },
      { secret },
    );

    expect(result.status).toBe('granted');
    if (result.status !== 'granted') throw new Error('expected grant');
    expect(result.grant.verificationId).toBe('verify-3');
    expect(result.grant.playerId).toBe('player-1');
  });

  it('rejects proof replay into a different authenticated player', async () => {
    const verified = await verifyGridLocationEnhancementPresence(
      configPort(),
      {
        citySlug: 'canton-oh', seasonSlug: 'founding-season', ruleId: 'plaza-intel', playerId: 'player-1', now,
        measurement: { latitude: 40.7989, longitude: -81.3748, accuracyMeters: 10 },
      },
      { secret, verificationIdFactory: () => 'verify-4' },
    );
    if (verified.status !== 'verified') throw new Error('expected verified');

    await expect(claimVerifiedGridLocationEnhancement(
      configPort(), grantPort(),
      {
        citySlug: 'canton-oh', seasonSlug: 'founding-season', ruleId: 'plaza-intel', playerId: 'player-2',
        attestationToken: verified.token, idempotencyKey: 'location-claim-2', now,
      },
      { secret },
    )).rejects.toThrow(/different player/);
  });

  it('reconciles a persisted duplicate after the short-lived proof expires', async () => {
    const verified = await verifyGridLocationEnhancementPresence(
      configPort(),
      {
        citySlug: 'canton-oh',
        seasonSlug: 'founding-season',
        ruleId: 'plaza-intel',
        playerId: 'player-1',
        measurement: {
          latitude: 40.7989,
          longitude: -81.3748,
          accuracyMeters: 10,
        },
        now,
      },
      { secret, verificationIdFactory: () => 'verify-retry' },
    );
    if (verified.status !== 'verified') throw new Error('expected verified');

    const existingGrant = {
      id: 'grant-retry',
      seasonId: 'season-1',
      playerId: 'player-1',
      ruleId: 'plaza-intel',
      verificationId: 'verify-retry',
      benefit: { kind: 'scouting-intel' as const, intelId: 'plaza-intel-cache' },
      idempotencyKey: 'location-retry-1',
      claimedAt: now,
    };

    const result = await claimVerifiedGridLocationEnhancement(
      configPort(), grantPort(existingGrant),
      {
        citySlug: 'canton-oh', seasonSlug: 'founding-season', ruleId: 'plaza-intel', playerId: 'player-1',
        attestationToken: verified.token, idempotencyKey: 'location-retry-1', now: '2026-09-19T02:16:00.000Z',
      },
      { secret },
    );

    expect(result.status).toBe('granted');
    if (result.status !== 'granted') throw new Error('expected duplicate grant');
    expect(result.duplicate).toBe(true);
    expect(result.grant).toEqual(existingGrant);
  });
});

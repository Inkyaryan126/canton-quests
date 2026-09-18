import { describe, expect, it } from 'vitest';
import {
  assertPrivacySafeLocationAttestation,
  canCompleteGridActivity,
  resolveGridLocationEnhancement,
  validateGridActivityAccessPolicy,
  validateGridLocationEnhancementRule,
} from '../lib/grid/core/location-enhancement';
import type {
  GridLocationAttestation,
  GridLocationEnhancementRule,
} from '../lib/grid/core/location-enhancement-types';

const baseRule: GridLocationEnhancementRule = {
  id: 'arts-district-field-cache',
  zoneId: 'arts-district-public-zone',
  verificationMaxAgeMinutes: 15,
  maxClaimsPerPlayer: 1,
  benefit: {
    kind: 'resource-cache',
    credits: 25,
    influence: 5,
  },
};

const attestation: GridLocationAttestation = {
  verificationId: 'presence-proof-001',
  zoneId: 'arts-district-public-zone',
  verifiedAt: '2026-09-18T03:55:00.000Z',
};

describe('Grid remote-first location enhancement core', () => {
  it('requires every essential activity to remain remotely completable', () => {
    expect(() =>
      validateGridActivityAccessPolicy({
        activityId: 'claim-territory',
        importance: 'essential',
        completionModes: ['location'],
      }),
    ).toThrow(/remotely completable/);

    const policy = {
      activityId: 'claim-territory',
      importance: 'essential' as const,
      completionModes: ['remote', 'location'] as const,
    };

    expect(
      canCompleteGridActivity(
        {
          ...policy,
          completionModes: [...policy.completionModes],
        },
        'remote',
      ),
    ).toBe(true);
  });

  it('allows explicitly optional activities to be location-only', () => {
    expect(() =>
      validateGridActivityAccessPolicy({
        activityId: 'one-night-mural-cache',
        importance: 'optional',
        completionModes: ['location'],
      }),
    ).not.toThrow();
  });

  it('never blocks remote play when presence is absent; it simply withholds the bonus', () => {
    const result = resolveGridLocationEnhancement(baseRule, null, {
      now: '2026-09-18T04:00:00.000Z',
      priorClaimCount: 0,
    });

    expect(result).toEqual({
      eligible: false,
      reason: 'presence-not-verified',
      ruleId: baseRule.id,
      verificationId: null,
      benefit: null,
    });
  });

  it('grants only the configured optional benefit for a fresh matching zone attestation', () => {
    const result = resolveGridLocationEnhancement(baseRule, attestation, {
      now: '2026-09-18T04:00:00.000Z',
      priorClaimCount: 0,
    });

    expect(result.eligible).toBe(true);
    expect(result.reason).toBe('eligible');
    expect(result.verificationId).toBe('presence-proof-001');
    expect(result.benefit).toEqual(baseRule.benefit);
  });

  it('fails closed for wrong zones, stale proofs, future proofs, and exhausted claim limits', () => {
    expect(
      resolveGridLocationEnhancement(
        baseRule,
        { ...attestation, zoneId: 'monument-zone' },
        {
          now: '2026-09-18T04:00:00.000Z',
          priorClaimCount: 0,
        },
      ).reason,
    ).toBe('zone-mismatch');

    expect(
      resolveGridLocationEnhancement(
        baseRule,
        { ...attestation, verifiedAt: '2026-09-18T03:30:00.000Z' },
        {
          now: '2026-09-18T04:00:00.000Z',
          priorClaimCount: 0,
        },
      ).reason,
    ).toBe('verification-expired');

    expect(
      resolveGridLocationEnhancement(
        baseRule,
        { ...attestation, verifiedAt: '2026-09-18T04:01:00.000Z' },
        {
          now: '2026-09-18T04:00:00.000Z',
          priorClaimCount: 0,
        },
      ).reason,
    ).toBe('verification-after-evaluation');

    expect(
      resolveGridLocationEnhancement(baseRule, attestation, {
        now: '2026-09-18T04:00:00.000Z',
        priorClaimCount: 1,
      }).reason,
    ).toBe('claim-limit-reached');
  });

  it('honors event windows and requires the verification itself to belong to the window', () => {
    const timedRule: GridLocationEnhancementRule = {
      ...baseRule,
      startsAt: '2026-09-18T04:00:00.000Z',
      endsAt: '2026-09-18T05:00:00.000Z',
    };

    expect(
      resolveGridLocationEnhancement(timedRule, attestation, {
        now: '2026-09-18T03:59:00.000Z',
        priorClaimCount: 0,
      }).reason,
    ).toBe('not-started');

    expect(
      resolveGridLocationEnhancement(timedRule, attestation, {
        now: '2026-09-18T04:02:00.000Z',
        priorClaimCount: 0,
      }).reason,
    ).toBe('verification-before-window');

    expect(
      resolveGridLocationEnhancement(
        timedRule,
        { ...attestation, verifiedAt: '2026-09-18T04:50:00.000Z' },
        {
          now: '2026-09-18T05:01:00.000Z',
          priorClaimCount: 0,
        },
      ).reason,
    ).toBe('ended');
  });

  it('keeps raw GPS coordinates and accuracy out of the Core attestation boundary', () => {
    expect(() =>
      assertPrivacySafeLocationAttestation({
        ...attestation,
        latitude: 40.7989,
        longitude: -81.3784,
      } as GridLocationAttestation),
    ).toThrow(/raw coordinates or accuracy/);

    expect(() =>
      assertPrivacySafeLocationAttestation({
        ...attestation,
        coordinates: [40.7989, -81.3784],
      } as GridLocationAttestation),
    ).toThrow(/raw coordinates or accuracy/);
  });

  it('validates bonus payloads without inventing season economy tuning', () => {
    expect(() =>
      validateGridLocationEnhancementRule({
        ...baseRule,
        benefit: {
          kind: 'temporary-modifier',
          modifierId: 'district-production',
          basisPoints: 750,
          durationMinutes: 30,
        },
      }),
    ).not.toThrow();

    expect(() =>
      validateGridLocationEnhancementRule({
        ...baseRule,
        benefit: {
          kind: 'cost-reduction',
          targetId: 'next-development',
          basisPoints: 15_000,
          uses: 1,
        },
      }),
    ).toThrow(/at most 10000/);

    expect(() =>
      validateGridLocationEnhancementRule({
        ...baseRule,
        benefit: {
          kind: 'resource-cache',
        },
      }),
    ).toThrow(/at least one resource/);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { claimGridLocationEnhancement } from '../lib/grid/server/location-enhancement-service';
import type {
  GridLocationEnhancementGrantRecord,
  GridLocationEnhancementPort,
} from '../lib/grid/server/location-enhancement-port';
import type { GridLocationEnhancementRule } from '../lib/grid/core/location-enhancement-types';

const rule: GridLocationEnhancementRule = {
  id: 'arts-cache',
  zoneId: 'arts-public-zone',
  verificationMaxAgeMinutes: 15,
  maxClaimsPerPlayer: 1,
  benefit: { kind: 'resource-cache', credits: 25 },
};

const grant: GridLocationEnhancementGrantRecord = {
  id: 'grant-1',
  seasonId: 'season-1',
  playerId: 'player-1',
  ruleId: 'arts-cache',
  verificationId: 'proof-1',
  benefit: rule.benefit,
  idempotencyKey: 'idem-1',
  claimedAt: '2026-09-18T04:00:00.000Z',
};

function fakePort(): GridLocationEnhancementPort {
  return {
    findByIdempotencyKey: vi.fn(async () => null),
    countRuleClaims: vi.fn(async () => 0),
    insertGrantAtomic: vi.fn(async () => ({
      grant,
      duplicate: false,
      limitReached: false,
    })),
  };
}

describe('Grid location enhancement claim service', () => {
  it('reconciles an existing idempotent grant before evaluating limits again', async () => {
    const port = fakePort();
    vi.mocked(port.findByIdempotencyKey).mockResolvedValue(grant);

    const result = await claimGridLocationEnhancement(port, {
      seasonId: 'season-1',
      playerId: 'player-1',
      rule,
      attestation: null,
      idempotencyKey: 'idem-1',
      now: '2026-09-18T04:10:00.000Z',
    });

    expect(result.status).toBe('granted');
    expect(result.duplicate).toBe(true);
    expect(result.grant).toEqual(grant);
    expect(port.countRuleClaims).not.toHaveBeenCalled();
    expect(port.insertGrantAtomic).not.toHaveBeenCalled();
  });

  it('persists an eligible privacy-safe claim with an atomic limit guard', async () => {
    const port = fakePort();

    const result = await claimGridLocationEnhancement(port, {
      seasonId: 'season-1',
      playerId: 'player-1',
      rule,
      attestation: {
        verificationId: 'proof-1',
        zoneId: 'arts-public-zone',
        verifiedAt: '2026-09-18T03:55:00.000Z',
      },
      idempotencyKey: 'idem-1',
      now: '2026-09-18T04:00:00.000Z',
    });

    expect(result.status).toBe('granted');
    expect(port.insertGrantAtomic).toHaveBeenCalledWith({
      seasonId: 'season-1',
      playerId: 'player-1',
      ruleId: 'arts-cache',
      verificationId: 'proof-1',
      benefit: rule.benefit,
      idempotencyKey: 'idem-1',
      claimedAt: '2026-09-18T04:00:00.000Z',
      maxClaimsPerPlayer: 1,
    });
  });

  it('never writes when presence is missing or otherwise ineligible', async () => {
    const port = fakePort();

    const result = await claimGridLocationEnhancement(port, {
      seasonId: 'season-1',
      playerId: 'player-1',
      rule,
      attestation: null,
      idempotencyKey: 'idem-1',
      now: '2026-09-18T04:00:00.000Z',
    });

    expect(result.status).toBe('ineligible');
    expect(result.decision.reason).toBe('presence-not-verified');
    expect(port.insertGrantAtomic).not.toHaveBeenCalled();
  });

  it('honors the database race-safe limit result even after an eligible precheck', async () => {
    const port = fakePort();
    vi.mocked(port.insertGrantAtomic).mockResolvedValue({
      grant: null,
      duplicate: false,
      limitReached: true,
    });

    const result = await claimGridLocationEnhancement(port, {
      seasonId: 'season-1',
      playerId: 'player-1',
      rule,
      attestation: {
        verificationId: 'proof-1',
        zoneId: 'arts-public-zone',
        verifiedAt: '2026-09-18T03:55:00.000Z',
      },
      idempotencyKey: 'idem-1',
      now: '2026-09-18T04:00:00.000Z',
    });

    expect(result.status).toBe('ineligible');
    expect(result.decision.reason).toBe('claim-limit-reached');
    expect(result.grant).toBeNull();
  });
});

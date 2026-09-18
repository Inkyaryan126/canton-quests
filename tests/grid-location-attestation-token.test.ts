import { describe, expect, it } from 'vitest';
import {
  issueGridLocationAttestationToken,
  verifyGridLocationAttestationToken,
} from '../lib/grid/server/location-attestation-token';

const secret =
  '0123456789abcdef0123456789abcdef0123456789abcdef';

function issue() {
  return issueGridLocationAttestationToken(
    {
      verificationId: 'presence-001',
      zoneId: 'arts-public-zone',
      playerId: 'player-1',
      seasonId: 'season-1',
      verifiedAt: '2026-09-18T04:00:00.000Z',
      expiresAt: '2026-09-18T04:15:00.000Z',
    },
    secret,
  );
}

describe('Grid signed location attestation tokens', () => {
  it('round-trips only the privacy-safe Core attestation fields', () => {
    expect(
      verifyGridLocationAttestationToken({
        token: issue(),
        secret,
        expectedPlayerId: 'player-1',
        expectedSeasonId: 'season-1',
        now: '2026-09-18T04:05:00.000Z',
      }),
    ).toEqual({
      verificationId: 'presence-001',
      zoneId: 'arts-public-zone',
      verifiedAt: '2026-09-18T04:00:00.000Z',
    });
  });

  it('rejects tampered payloads and signatures', () => {
    const token = issue();
    const [payload, sig] = token.split('.');

    const decoded = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8'),
    );
    decoded.zoneId = 'different-zone';
    const tamperedPayload = Buffer.from(
      JSON.stringify(decoded),
      'utf8',
    ).toString('base64url');

    expect(() =>
      verifyGridLocationAttestationToken({
        token: tamperedPayload + '.' + sig,
        secret,
        expectedPlayerId: 'player-1',
        expectedSeasonId: 'season-1',
        now: '2026-09-18T04:05:00.000Z',
      }),
    ).toThrow(/signature/);

    expect(() =>
      verifyGridLocationAttestationToken({
        token: payload + '.' + sig.slice(0, -1) + 'A',
        secret,
        expectedPlayerId: 'player-1',
        expectedSeasonId: 'season-1',
        now: '2026-09-18T04:05:00.000Z',
      }),
    ).toThrow(/signature/);
  });

  it('binds proof to the authenticated player and active season', () => {
    expect(() =>
      verifyGridLocationAttestationToken({
        token: issue(),
        secret,
        expectedPlayerId: 'player-2',
        expectedSeasonId: 'season-1',
        now: '2026-09-18T04:05:00.000Z',
      }),
    ).toThrow(/different player/);

    expect(() =>
      verifyGridLocationAttestationToken({
        token: issue(),
        secret,
        expectedPlayerId: 'player-1',
        expectedSeasonId: 'season-2',
        now: '2026-09-18T04:05:00.000Z',
      }),
    ).toThrow(/different season/);
  });

  it('rejects expired, future-dated, and nonsensical windows', () => {
    expect(() =>
      verifyGridLocationAttestationToken({
        token: issue(),
        secret,
        expectedPlayerId: 'player-1',
        expectedSeasonId: 'season-1',
        now: '2026-09-18T04:16:00.000Z',
      }),
    ).toThrow(/expired/);

    expect(() =>
      verifyGridLocationAttestationToken({
        token: issue(),
        secret,
        expectedPlayerId: 'player-1',
        expectedSeasonId: 'season-1',
        now: '2026-09-18T03:59:00.000Z',
      }),
    ).toThrow(/future/);

    expect(() =>
      issueGridLocationAttestationToken(
        {
          verificationId: 'presence-001',
          zoneId: 'arts-public-zone',
          playerId: 'player-1',
          seasonId: 'season-1',
          verifiedAt: '2026-09-18T04:15:00.000Z',
          expiresAt: '2026-09-18T04:10:00.000Z',
        },
        secret,
      ),
    ).toThrow(/expire after verification/);
  });

  it('requires a strong server-side signing secret', () => {
    expect(() =>
      issueGridLocationAttestationToken(
        {
          verificationId: 'presence-001',
          zoneId: 'arts-public-zone',
          playerId: 'player-1',
          seasonId: 'season-1',
          verifiedAt: '2026-09-18T04:00:00.000Z',
          expiresAt: '2026-09-18T04:15:00.000Z',
        },
        'too-short',
      ),
    ).toThrow(/at least 32 bytes/);
  });

  it('does not encode raw GPS coordinates or accuracy in the signed payload', () => {
    const payload = JSON.parse(
      Buffer.from(issue().split('.')[0], 'base64url').toString('utf8'),
    );

    expect(payload).not.toHaveProperty('latitude');
    expect(payload).not.toHaveProperty('longitude');
    expect(payload).not.toHaveProperty('coordinates');
    expect(payload).not.toHaveProperty('accuracy');
    expect(payload).not.toHaveProperty('accuracyMeters');
  });
});

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const verifyRoute = fs.readFileSync(path.join(process.cwd(), 'app/api/grid/location/verify/route.ts'), 'utf8');
const claimRoute = fs.readFileSync(path.join(process.cwd(), 'app/api/grid/location/claim/route.ts'), 'utf8');

describe('Grid location-enhanced play API contract', () => {
  it('derives player and season identity on the server for both routes', () => {
    for (const source of [verifyRoute, claimRoute]) {
      expect(source).toContain('resolveAuthenticatedSession(request)');
      expect(source).toContain('session.player.id');
      expect(source).toContain('cantonFoundingSeasonPackage.city.slug');
      expect(source).toContain('cantonFoundingSeasonPackage.seasonTemplate.slug');
      expect(source).not.toContain('body.playerId');
      expect(source).not.toContain('body.seasonId');
      expect(source).not.toContain('body.citySlug');
      expect(source).not.toContain('body.seasonSlug');
    }
  });

  it('lets the verification route accept a measurement but never a browser-declared zone or benefit', () => {
    expect(verifyRoute).toContain('body.latitude');
    expect(verifyRoute).toContain('body.longitude');
    expect(verifyRoute).toContain('body.accuracyMeters');
    expect(verifyRoute).toContain('body.ruleId');
    expect(verifyRoute).not.toContain('body.zoneId');
    expect(verifyRoute).not.toContain('body.benefit');
  });

  it('keeps raw coordinates completely out of the claim route', () => {
    expect(claimRoute).toContain('body.attestationToken');
    expect(claimRoute).toContain('body.idempotencyKey');
    expect(claimRoute).toContain('body.ruleId');
    expect(claimRoute).not.toMatch(/body\.(latitude|longitude|accuracy|coords|coordinates)/);
  });

  it('uses a server-only signing secret and private no-store responses', () => {
    for (const source of [verifyRoute, claimRoute]) {
      expect(source).toContain('process.env.GRID_LOCATION_ATTESTATION_SECRET');
      expect(source).toContain("Cache-Control', 'private, no-store, max-age=0'");
      expect(source).toContain('isGridWorldReadEnabled()');
    }
    expect(verifyRoute).not.toContain('secret: secret');
    expect(claimRoute).not.toContain('secret: secret');
  });

  it('exposes POST only for the mutating proof/claim flow', () => {
    for (const source of [verifyRoute, claimRoute]) {
      expect(source).toContain('export async function POST');
      expect(source).not.toMatch(/export async function (GET|PUT|PATCH|DELETE)/);
    }
  });
});

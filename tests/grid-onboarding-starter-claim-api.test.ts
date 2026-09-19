import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const route = fs.readFileSync(
  path.join(
    root,
    'app/api/grid/onboarding/starter-territories/claim/route.ts',
  ),
  'utf8',
);
const adapter = fs.readFileSync(
  path.join(
    root,
    'lib/grid/server/supabase-onboarding-starter-claim.ts',
  ),
  'utf8',
);

describe('Grid onboarding starter claim API contract', () => {
  it('is authenticated and guarded by onboarding writes', () => {
    expect(route).toContain('export async function POST');
    expect(route).toContain('resolveAuthenticatedSession');
    expect(route).toContain('Authentication required.');
    expect(route).toContain('isGridOnboardingWriteEnabled()');
  });

  it('accepts only territory and idempotency from the client', () => {
    expect(route).toContain('body.territoryId');
    expect(route).toContain('body.idempotencyKey');
    expect(route).toContain('playerId: session.player.id');
    expect(route).toContain('now: new Date().toISOString()');
    expect(route).not.toMatch(/body\.playerId|body\.seasonId|body\.now/);
  });

  it('checks the submitted territory against server-resolved starter eligibility before claiming', () => {
    expect(route).toContain('isGridStarterTerritoryEligible');
    expect(route).toContain('Selected territory is not an eligible starter territory.');
    expect(route).toMatch(/409/);
  });

  it('calls only the starter-specific RPC instead of generic neutral claims', () => {
    expect(adapter).toContain("'grid_claim_onboarding_starter_territory'");
    expect(adapter).not.toContain("'grid_claim_neutral_territory'");
  });

  it('does not expose internal city, player, or season ids in the response service', () => {
    const service = fs.readFileSync(
      path.join(
        root,
        'lib/grid/server/onboarding-starter-claim-service.ts',
      ),
      'utf8',
    );

    expect(service).not.toContain('seasonId: claim.seasonId');
    expect(service).not.toContain('cityId: claim.cityId');
    expect(service).not.toContain('playerId: claim.playerId');
  });
});

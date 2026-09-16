import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = fs.readFileSync(
  path.join(
    process.cwd(),
    'supabase/migrations/20260916103038_grid_onboarding_starter_claim.sql',
  ),
  'utf8',
);

describe('Grid onboarding starter-only claim schema', () => {
  it('defines one service-role-only starter claim command', () => {
    expect(sql).toContain('grid_claim_onboarding_starter_territory');
    expect(sql).toContain('grant execute on function public.grid_claim_onboarding_starter_territory');
    expect(sql).toContain('to service_role;');
    expect(sql).toContain('from public, anon, authenticated;');
  });

  it('checks idempotent replay before zero-ownership guard', () => {
    const replayIndex = sql.indexOf("event_type <> 'grid:territory_claimed'");
    const ownershipIndex = sql.indexOf("if v_owned_count <> 0 then");

    expect(replayIndex).toBeGreaterThan(0);
    expect(ownershipIndex).toBeGreaterThan(replayIndex);
    expect(sql).toContain("v_existing_event.payload ->> 'claimMode' <> 'starter'");
  });

  it('requires an active season, joined player, zero owned territory, and configured starter target', () => {
    expect(sql).toContain("v_season.status not in ('active', 'surge')");
    expect(sql).toContain('PLAYER_NOT_JOINED');
    expect(sql).toContain('ONBOARDING_STARTER_ALREADY_CLAIMED');
    expect(sql).toContain("'starterTerritorySlugs'");
    expect(sql).toContain('TERRITORY_NOT_STARTER_ELIGIBLE');
  });

  it('delegates final settlement and mutation to the proven neutral claim engine', () => {
    expect(sql).toContain('return public.grid_claim_neutral_territory(');
    expect(sql.match(/grid_claim_neutral_territory/g)?.length).toBeGreaterThanOrEqual(2);
    expect(sql).not.toContain("v_claim_mode := 'adjacent'");
  });
});

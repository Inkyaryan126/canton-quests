import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const sql = fs.readFileSync(
  path.join(
    root,
    'supabase/migrations/20260918033000_grid_location_enhancement_claims.sql',
  ),
  'utf8',
);
const adapter = fs.readFileSync(
  path.join(root, 'lib/grid/server/supabase-location-enhancement.ts'),
  'utf8',
);

describe('Grid location enhancement persistence contract', () => {
  it('stores privacy-safe proof references without raw coordinates', () => {
    expect(sql).toContain('grid_location_enhancement_claims');
    expect(sql).toContain('verification_id text not null');
    expect(sql).toContain('benefit jsonb not null');
    expect(sql).not.toMatch(/\blatitude\b|\blongitude\b|\bcoordinates\b|\baccuracy_meters\b/i);
  });

  it('enforces retry idempotency and concurrent per-player claim limits atomically', () => {
    expect(sql).toContain(
      'unique (season_id, player_id, idempotency_key)',
    );
    expect(sql).toContain('pg_advisory_xact_lock');
    expect(sql).toContain('v_claim_count >= p_max_claims');
    expect(sql).toContain("'status', 'duplicate'");
    expect(sql).toContain("'status', 'limit_reached'");
    expect(sql).toContain("'status', 'inserted'");
  });

  it('keeps writes behind service-role server authority', () => {
    expect(sql).toContain(
      'alter table public.grid_location_enhancement_claims enable row level security',
    );
    expect(sql).toContain(
      'revoke all on public.grid_location_enhancement_claims from anon, authenticated',
    );
    expect(sql).toContain('to service_role');
    expect(sql).toContain('security definer');
  });

  it('uses the atomic RPC rather than browser-writable tables', () => {
    expect(adapter).toContain(
      ".rpc('grid_claim_location_enhancement'",
    );
    expect(adapter).toContain(
      ".from('grid_location_enhancement_claims')",
    );
    expect(adapter).not.toContain('latitude');
    expect(adapter).not.toContain('longitude');
  });
});

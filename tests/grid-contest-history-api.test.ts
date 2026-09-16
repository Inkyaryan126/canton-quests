import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createSupabaseGridContestHistoryPort } from '../lib/grid/server/supabase-contest-history';

const routeSource = fs.readFileSync(
  path.join(
    process.cwd(),
    'app/api/grid/contests/[contestId]/history/route.ts',
  ),
  'utf8',
);

const adapterSource = fs.readFileSync(
  path.join(
    process.cwd(),
    'lib/grid/server/supabase-contest-history.ts',
  ),
  'utf8',
);

describe('Grid contest history API contract', () => {
  it('keeps replay history hidden until the contest system is explicitly enabled', () => {
    expect(routeSource).toContain('isGridContestWriteEnabled()');
  });

  it('derives replay visibility from the authenticated player, never request input', () => {
    expect(routeSource).toContain('viewerPlayerId: session.player.id');
    expect(routeSource).toContain('Authentication required.');
    expect(routeSource).not.toMatch(/body\.viewerPlayerId|searchParams.*viewerPlayerId/);
  });

  it('maps participant denial and missing contests to the same not-found surface', () => {
    expect(routeSource).toContain(
      "error.code === 'INVALID_REQUEST' ? 400 : 404",
    );
  });

  it('reads only contest-scoped authoritative ledger events', () => {
    expect(adapterSource).toContain(".eq('entity_type', 'contest')");
    expect(adapterSource).toContain(".eq('entity_id', contestId)");
    expect(adapterSource).toContain(".eq('season_id', seasonId)");
    expect(adapterSource).toContain(
      ".in('event_type', [...GRID_CONTEST_HISTORY_EVENT_TYPES])",
    );
  });

  it('does not expose command idempotency keys through the replay projection', () => {
    expect(adapterSource).not.toMatch(
      /select\([^)]*idempotency_key[^)]*\)/s,
    );
    expect(adapterSource).not.toContain('idempotencyKey:');
  });

  it('requires the trusted service-role adapter', () => {
    expect(() => createSupabaseGridContestHistoryPort(null as any)).toThrow(
      'Grid contest history requires Supabase service-role configuration',
    );
  });
});

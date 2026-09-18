import { NextResponse } from 'next/server';
import { cantonFoundingSeasonPackage } from '@/lib/grid/cities/canton/founding-season';
import { isGridProgressionRebuildEnabled } from '@/lib/grid/server/progression-feature-flags';
import { rebuildGridPlayerProgression } from '@/lib/grid/server/progression-rebuild-service';
import { resolveSupabaseGridSeason } from '@/lib/grid/server/supabase-grid-season';
import { createSupabaseGridProgressionRebuildPorts } from '@/lib/grid/server/supabase-progression-rebuild';
import {
  resolveAuthenticatedSession,
  setAuthCookies,
} from '@/lib/supabase-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!isGridProgressionRebuildEnabled()) {
    return NextResponse.json(
      { error: 'Grid progression rebuild is not enabled' },
      { status: 503 },
    );
  }

  const session = await resolveAuthenticatedSession(request);
  const playerId = session.player?.id ?? null;
  const respond = (body: unknown, init?: ResponseInit) => {
    const response = NextResponse.json(body, init);
    setAuthCookies(response, session.refreshedSession, playerId ?? undefined);
    return response;
  };

  if (!playerId) {
    return respond({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const season = await resolveSupabaseGridSeason(cantonFoundingSeasonPackage);
    if (!season) return respond({ error: 'Grid season is not available' }, { status: 404 });

    const result = await rebuildGridPlayerProgression(
      createSupabaseGridProgressionRebuildPorts(),
      { seasonId: season.seasonId, playerId },
    );

    return respond({
      seasonStatus: season.status,
      seasonApplied: result.seasonApplied,
      lifetimeApplied: result.lifetimeApplied,
      season: result.season.snapshot,
      lifetime: result.lifetime.snapshot,
      sourceEventCount: {
        season: result.season.sourceEventCount,
        lifetime: result.lifetime.sourceEventCount,
      },
    });
  } catch (error) {
    console.error('[Grid progression rebuild]', error);
    return respond({ error: 'Grid progression rebuild failed' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { cantonFoundingSeasonPackage } from '@/lib/grid/cities/canton/founding-season';
import { GRID_STAT_DEFINITIONS } from '@/lib/grid/core/progression';
import { createSupabaseGridProgressionReadPort } from '@/lib/grid/server/supabase-progression';
import { readSupabaseGridWorldRuntime } from '@/lib/grid/server/supabase-world-projection';
import {
  resolveAuthenticatedSession,
  setAuthCookies,
} from '@/lib/supabase-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await resolveAuthenticatedSession(request);
  const playerId = session.player?.id ?? null;

  let season = null;
  let lifetime = null;
  let warning: string | null = null;

  if (playerId) {
    try {
      const runtime = await readSupabaseGridWorldRuntime(
        cantonFoundingSeasonPackage,
        playerId,
      );

      if (runtime) {
        const progression = createSupabaseGridProgressionReadPort();
        [season, lifetime] = await Promise.all([
          progression.getSeasonPlayer(runtime.seasonId, playerId),
          progression.getLifetimePlayer(playerId),
        ]);
      } else {
        warning = 'Grid world runtime is not activated for this environment yet';
      }
    } catch (error) {
      warning =
        error instanceof Error ? error.message : 'Grid progression read failed';
    }
  }

  const response = NextResponse.json({
    authenticated: Boolean(playerId),
    season,
    lifetime,
    statCatalog: GRID_STAT_DEFINITIONS,
    warning,
  });

  setAuthCookies(response, session.refreshedSession, playerId ?? undefined);
  return response;
}

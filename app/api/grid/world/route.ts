import { NextResponse } from 'next/server';
import { cantonFoundingSeasonPackage } from '@/lib/grid/cities/canton/founding-season';
import { isGridWorldReadEnabled } from '@/lib/grid/server/feature-flags';
import { readSupabaseGridWorldRuntime } from '@/lib/grid/server/supabase-world-projection';
import { buildGridWorldProjection } from '@/lib/grid/server/world-projection';
import {
  resolveAuthenticatedSession,
  setAuthCookies,
} from '@/lib/supabase-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await resolveAuthenticatedSession(request);
  const viewerPlayerId = session.player?.id ?? null;
  const runtimeEnabled = isGridWorldReadEnabled();

  let runtime = null;
  let runtimeWarning: string | null = null;

  if (runtimeEnabled) {
    try {
      runtime = await readSupabaseGridWorldRuntime(
        cantonFoundingSeasonPackage,
        viewerPlayerId,
      );
    } catch (error) {
      runtimeWarning =
        error instanceof Error ? error.message : 'Grid runtime read failed';
    }
  }
  const projection = buildGridWorldProjection(cantonFoundingSeasonPackage, {
    viewerPlayerId,
    runtime,
  });

  const response = NextResponse.json({
    projection,
    runtimeEnabled,
    runtimeWarning,
  });

  setAuthCookies(response, session.refreshedSession, viewerPlayerId ?? undefined);
  return response;
}

import { NextResponse } from 'next/server';
import { cantonDominanceHeatConfig } from '@/lib/grid/cities/canton/dominance-heat';
import { cantonFoundingSeasonPackage } from '@/lib/grid/cities/canton/founding-season';
import { isGridWorldReadEnabled } from '@/lib/grid/server/feature-flags';
import { readGridDominanceHeatLive } from '@/lib/grid/server/dominance-heat-live-service';
import { createSupabaseGridDominanceHeatLivePort } from '@/lib/grid/server/supabase-dominance-heat';
import {
  resolveAuthenticatedSession,
  setAuthCookies,
} from '@/lib/supabase-auth';

export const dynamic = 'force-dynamic';

function response(
  body: unknown,
  requestSession: Awaited<ReturnType<typeof resolveAuthenticatedSession>>,
  init?: ResponseInit,
) {
  const result = NextResponse.json(body, init);
  result.headers.set('Cache-Control', 'private, no-store, max-age=0');
  setAuthCookies(
    result,
    requestSession.refreshedSession,
    requestSession.player?.id,
  );
  return result;
}

export async function GET(request: Request) {
  const session = await resolveAuthenticatedSession(request);

  if (!session.player) {
    return response(
      { success: false, error: 'Authentication required.' },
      session,
      { status: 401 },
    );
  }

  if (!isGridWorldReadEnabled()) {
    return response(
      {
        success: false,
        error: 'Grid Dominance Heat is not active in this environment.',
      },
      session,
      { status: 404 },
    );
  }

  try {
    const heat = await readGridDominanceHeatLive(
      createSupabaseGridDominanceHeatLivePort(
        cantonFoundingSeasonPackage,
      ),
      session.player.id,
      cantonDominanceHeatConfig,
    );

    return response({ success: true, heat }, session);
  } catch (error) {
    console.error('[Grid Dominance Heat]', error);
    return response(
      { success: false, error: 'Grid Dominance Heat is unavailable.' },
      session,
      { status: 500 },
    );
  }
}

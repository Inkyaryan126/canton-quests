import { NextResponse } from 'next/server';
import { isGridScrimmageEnabled } from '@/lib/grid/server/scrimmage-feature-flags';
import { getGridScrimmageSessionForPlayer } from '@/lib/grid/server/scrimmage-service';
import { createSupabaseGridScrimmagePort } from '@/lib/grid/server/supabase-scrimmage';
import {
  resolveAuthenticatedSession,
  setAuthCookies,
} from '@/lib/supabase-auth';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { sessionId: string } },
) {
  const session = await resolveAuthenticatedSession(request);
  const response = (body: unknown, init?: ResponseInit) => {
    const result = NextResponse.json(body, init);
    setAuthCookies(result, session.refreshedSession, session.player?.id);
    return result;
  };

  if (!isGridScrimmageEnabled()) {
    return response(
      { success: false, error: 'Grid scrimmages are not enabled.' },
      { status: 404 },
    );
  }

  if (!session.player) {
    return response(
      { success: false, error: 'Authentication required.' },
      { status: 401 },
    );
  }

  try {
    const scrimmage = await getGridScrimmageSessionForPlayer(
      createSupabaseGridScrimmagePort(),
      params.sessionId,
      session.player.id,
    );

    return response({ success: true, scrimmage });
  } catch {
    return response(
      { success: false, error: 'Grid scrimmage session was not found.' },
      { status: 404 },
    );
  }
}

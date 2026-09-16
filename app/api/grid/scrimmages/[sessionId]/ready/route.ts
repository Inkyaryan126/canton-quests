import { NextResponse } from 'next/server';
import { isGridScrimmageEnabled } from '@/lib/grid/server/scrimmage-feature-flags';
import { setGridScrimmageSessionReady } from '@/lib/grid/server/scrimmage-service';
import { createSupabaseGridScrimmagePort } from '@/lib/grid/server/supabase-scrimmage';
import {
  resolveAuthenticatedSession,
  setAuthCookies,
} from '@/lib/supabase-auth';

export const dynamic = 'force-dynamic';

export async function POST(
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

  const body = await request.json().catch(() => ({}));
  if (typeof body.ready !== 'boolean') {
    return response(
      { success: false, error: 'Missing ready state.' },
      { status: 400 },
    );
  }

  try {
    const scrimmage = await setGridScrimmageSessionReady(
      createSupabaseGridScrimmagePort(),
      params.sessionId,
      {
        playerId: session.player.id,
        ready: body.ready,
      },
    );
    return response({ success: true, scrimmage });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to update Grid scrimmage readiness.';
    return response({ success: false, error: message }, { status: 400 });
  }
}

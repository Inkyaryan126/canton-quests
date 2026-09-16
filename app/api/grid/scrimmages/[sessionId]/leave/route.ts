import { NextResponse } from 'next/server';
import { isGridScrimmageEnabled } from '@/lib/grid/server/scrimmage-feature-flags';
import { leaveGridScrimmageSession } from '@/lib/grid/server/scrimmage-service';
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

  try {
    const scrimmage = await leaveGridScrimmageSession(
      createSupabaseGridScrimmagePort(),
      params.sessionId,
      { playerId: session.player.id },
    );
    return response({ success: true, scrimmage });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to leave Grid scrimmage.';
    return response({ success: false, error: message }, { status: 400 });
  }
}

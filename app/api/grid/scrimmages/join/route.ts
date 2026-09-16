import { NextResponse } from 'next/server';
import { isGridScrimmageEnabled } from '@/lib/grid/server/scrimmage-feature-flags';
import { joinGridScrimmageSession } from '@/lib/grid/server/scrimmage-service';
import { createSupabaseGridScrimmagePort } from '@/lib/grid/server/supabase-scrimmage';
import {
  resolveAuthenticatedSession,
  setAuthCookies,
} from '@/lib/supabase-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
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
  const inviteCode =
    typeof body.inviteCode === 'string' ? body.inviteCode : '';

  try {
    const scrimmage = await joinGridScrimmageSession(
      createSupabaseGridScrimmagePort(),
      {
        playerId: session.player.id,
        inviteCode,
        now: new Date().toISOString(),
      },
    );

    return response({ success: true, scrimmage });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to join Grid scrimmage.';
    return response({ success: false, error: message }, { status: 400 });
  }
}

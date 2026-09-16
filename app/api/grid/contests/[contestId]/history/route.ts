import { NextResponse } from 'next/server';
import {
  getGridContestHistory,
  GridContestHistoryError,
} from '@/lib/grid/server/contest-history-service';
import { isGridContestWriteEnabled } from '@/lib/grid/server/feature-flags';
import { createSupabaseGridContestHistoryPort } from '@/lib/grid/server/supabase-contest-history';
import {
  resolveAuthenticatedSession,
  setAuthCookies,
} from '@/lib/supabase-auth';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { contestId: string } },
) {
  const session = await resolveAuthenticatedSession(request);
  const response = (body: unknown, init?: ResponseInit) => {
    const result = NextResponse.json(body, init);
    setAuthCookies(
      result,
      session.refreshedSession,
      session.player?.id,
    );
    return result;
  };

  if (!isGridContestWriteEnabled()) {
    return response(
      { success: false, error: 'Grid contests are not enabled.' },
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
    const history = await getGridContestHistory(
      createSupabaseGridContestHistoryPort(),
      {
        contestId: params.contestId,
        viewerPlayerId: session.player.id,
      },
    );

    return response({ success: true, history });
  } catch (error) {
    if (error instanceof GridContestHistoryError) {
      const status =
        error.code === 'INVALID_REQUEST' ? 400 : 404;
      return response(
        { success: false, error: error.message },
        { status },
      );
    }

    return response(
      { success: false, error: 'Failed to load Grid contest history.' },
      { status: 500 },
    );
  }
}

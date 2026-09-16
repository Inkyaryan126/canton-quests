import { NextResponse } from 'next/server';
import { listGridActiveContests } from '@/lib/grid/server/active-contest-service';
import { isGridContestWriteEnabled } from '@/lib/grid/server/feature-flags';
import { createSupabaseGridActiveContestPort } from '@/lib/grid/server/supabase-active-contests';
import {
  resolveAuthenticatedSession,
  setAuthCookies,
} from '@/lib/supabase-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await resolveAuthenticatedSession(request);
  const response = (body: unknown, init?: ResponseInit) => {
    const result = NextResponse.json(body, init);
    setAuthCookies(result, session.refreshedSession, session.player?.id);
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

  const { searchParams } = new URL(request.url);
  const seasonId = searchParams.get('seasonId') ?? '';
  const playerId = searchParams.get('playerId') ?? undefined;
  const territoryId = searchParams.get('territoryId') ?? undefined;

  try {
    const contests = await listGridActiveContests(
      createSupabaseGridActiveContestPort(),
      { seasonId, playerId, territoryId },
    );
    return response({ success: true, contests });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to discover active Grid contests.';
    return response({ success: false, error: message }, { status: 400 });
  }
}

import { NextResponse } from 'next/server';
import { cantonFoundingSeasonPackage } from '@/lib/grid/cities/canton/founding-season';
import { isGridWorldReadEnabled } from '@/lib/grid/server/feature-flags';
import {
  getGridPveStrongholdContestForPlayer,
  GridPveStrongholdReadError,
} from '@/lib/grid/server/pve-stronghold-read-service';
import { createSupabaseGridPveStrongholdReadPort } from '@/lib/grid/server/supabase-pve-stronghold-read';
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
    setAuthCookies(result, session.refreshedSession, session.player?.id);
    return result;
  };

  if (!isGridWorldReadEnabled()) {
    return response(
      { success: false, error: 'Grid stronghold contests are not enabled.' },
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
    const contest = await getGridPveStrongholdContestForPlayer(
      createSupabaseGridPveStrongholdReadPort({
        citySlug: cantonFoundingSeasonPackage.city.slug,
        seasonSlug: cantonFoundingSeasonPackage.seasonTemplate.slug,
      }),
      {
        contestId: params.contestId,
        viewerPlayerId: session.player.id,
      },
    );
    return response({ success: true, contest });
  } catch (error) {
    if (error instanceof GridPveStrongholdReadError) {
      return response(
        { success: false, error: error.message },
        { status: error.code === 'INVALID_REQUEST' ? 400 : 404 },
      );
    }
    return response(
      { success: false, error: 'Failed to load Grid stronghold contest.' },
      { status: 500 },
    );
  }
}

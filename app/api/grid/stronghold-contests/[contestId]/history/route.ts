import { NextResponse } from 'next/server';
import { cantonFoundingSeasonPackage } from '@/lib/grid/cities/canton/founding-season';
import { isGridWorldReadEnabled } from '@/lib/grid/server/feature-flags';
import {
  getGridPveStrongholdHistory,
  GridPveStrongholdHistoryError,
} from '@/lib/grid/server/pve-stronghold-history-service';
import { createSupabaseGridPveStrongholdHistoryPort } from '@/lib/grid/server/supabase-pve-stronghold-history';
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
      { success: false, error: 'Grid stronghold history is not enabled.' },
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
    const history = await getGridPveStrongholdHistory(
      createSupabaseGridPveStrongholdHistoryPort({
        citySlug: cantonFoundingSeasonPackage.city.slug,
        seasonSlug: cantonFoundingSeasonPackage.seasonTemplate.slug,
      }),
      {
        contestId: params.contestId,
        viewerPlayerId: session.player.id,
      },
    );
    return response({ success: true, history });
  } catch (error) {
    if (error instanceof GridPveStrongholdHistoryError) {
      return response(
        { success: false, error: error.message },
        { status: error.code === 'INVALID_REQUEST' ? 400 : 404 },
      );
    }
    return response(
      { success: false, error: 'Failed to load Grid stronghold history.' },
      { status: 500 },
    );
  }
}

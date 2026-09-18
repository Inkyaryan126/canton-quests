import { NextResponse } from 'next/server';
import { cantonFoundingSeasonPackage } from '@/lib/grid/cities/canton/founding-season';
import { isGridEconomyWriteEnabled } from '@/lib/grid/server/feature-flags';
import { createSupabaseGridTerritoryActionPort } from '@/lib/grid/server/supabase-territory-action';
import { createSupabaseGridTerritoryClaimPort } from '@/lib/grid/server/supabase-territory-claim';
import { claimGridWorldTerritory } from '@/lib/grid/server/territory-action-service';
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

  if (!isGridEconomyWriteEnabled()) {
    return response(
      { success: false, error: 'Grid economy writes are not enabled.' },
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
  const territorySlug =
    typeof body.territorySlug === 'string' ? body.territorySlug : '';
  const idempotencyKey =
    typeof body.idempotencyKey === 'string' ? body.idempotencyKey : '';
  if (!territorySlug.trim() || !idempotencyKey.trim()) {
    return response(
      { success: false, error: 'Missing territorySlug or idempotencyKey.' },
      { status: 400 },
    );
  }

  try {
    const claim = await claimGridWorldTerritory(
      createSupabaseGridTerritoryActionPort(cantonFoundingSeasonPackage),
      createSupabaseGridTerritoryClaimPort(),
      {
        playerId: session.player.id,
        territorySlug,
        idempotencyKey,
        now: new Date().toISOString(),
      },
    );
    return response({ success: true, claim });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to claim Grid territory.';
    return response({ success: false, error: message }, { status: 400 });
  }
}

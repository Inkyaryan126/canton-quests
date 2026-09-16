import { randomInt } from 'node:crypto';
import { NextResponse } from 'next/server';
import { cantonFoundingSeasonContest } from '@/lib/grid/cities/canton/founding-season-contest';
import { isGridScrimmageEnabled } from '@/lib/grid/server/scrimmage-feature-flags';
import { resolveGridScrimmageDuelSession } from '@/lib/grid/server/scrimmage-service';
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
  const defenderPlayerId =
    typeof body.defenderPlayerId === 'string'
      ? body.defenderPlayerId
      : '';

  if (!defenderPlayerId.trim()) {
    return response(
      { success: false, error: 'Missing defenderPlayerId.' },
      { status: 400 },
    );
  }

  try {
    const scrimmage = await resolveGridScrimmageDuelSession(
      createSupabaseGridScrimmagePort(),
      params.sessionId,
      {
        attackerPlayerId: session.player.id,
        defenderPlayerId,
      },
      cantonFoundingSeasonContest,
      (dieSides) => randomInt(1, dieSides + 1),
    );

    return response({ success: true, scrimmage });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to resolve Grid scrimmage duel.';
    return response({ success: false, error: message }, { status: 400 });
  }
}

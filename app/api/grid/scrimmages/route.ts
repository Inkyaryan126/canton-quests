import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getGridCityPackage } from '@/lib/grid/cities/registry';
import { resolveGridScrimmageCityId } from '@/lib/grid/server/scrimmage-city-resolver';
import { isGridScrimmageEnabled } from '@/lib/grid/server/scrimmage-feature-flags';
import { createGridScrimmageSession } from '@/lib/grid/server/scrimmage-service';
import { createSupabaseGridScrimmagePort } from '@/lib/grid/server/supabase-scrimmage';
import {
  resolveAuthenticatedSession,
  setAuthCookies,
} from '@/lib/supabase-auth';

export const dynamic = 'force-dynamic';

function createInviteCode(): string {
  return `GRID-${randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

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
  const citySlug =
    typeof body.citySlug === 'string' ? body.citySlug.trim() : 'canton-oh';
  const minPlayers =
    Number.isInteger(body.minPlayers) ? body.minPlayers : 2;
  const maxPlayers =
    Number.isInteger(body.maxPlayers) ? body.maxPlayers : 4;
  const requireAllReady = body.requireAllReady !== false;

  try {
    if (!getGridCityPackage(citySlug)) {
      return response(
        { success: false, error: 'Grid scrimmage city is not supported.' },
        { status: 400 },
      );
    }

    const cityId = await resolveGridScrimmageCityId(citySlug);
    const scrimmage = await createGridScrimmageSession(
      createSupabaseGridScrimmagePort(),
      {
        sessionId: randomUUID(),
        cityId,
        hostPlayerId: session.player.id,
        inviteCode: createInviteCode(),
        rules: {
          minPlayers,
          maxPlayers,
          requireAllReady,
        },
        now: new Date().toISOString(),
      },
    );

    return response({
      success: true,
      scrimmage,
      viewer: { playerId: session.player.id, role: 'host' as const },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to create Grid scrimmage.';
    return response({ success: false, error: message }, { status: 400 });
  }
}

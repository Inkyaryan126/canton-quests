import { NextResponse } from 'next/server';
import { cantonFoundingSeasonPackage } from '@/lib/grid/cities/canton/founding-season';
import { createSupabaseGridEconomyCommandPort } from '@/lib/grid/server/supabase-economy';
import { isGridOnboardingWriteEnabled } from '@/lib/grid/server/onboarding-feature-flags';
import { joinGridOnboardingSeason } from '@/lib/grid/server/onboarding-join-service';
import { createSupabaseGridOnboardingSeasonPort } from '@/lib/grid/server/supabase-onboarding-season';
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

  if (!isGridOnboardingWriteEnabled()) {
    return response(
      { success: false, error: 'Grid onboarding writes are not enabled.' },
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
  const idempotencyKey =
    typeof body.idempotencyKey === 'string' ? body.idempotencyKey : '';

  if (!idempotencyKey.trim()) {
    return response(
      { success: false, error: 'Missing idempotencyKey.' },
      { status: 400 },
    );
  }

  try {
    const result = await joinGridOnboardingSeason(
      createSupabaseGridOnboardingSeasonPort(cantonFoundingSeasonPackage),
      createSupabaseGridEconomyCommandPort(),
      {
        playerId: session.player.id,
        idempotencyKey,
        now: new Date().toISOString(),
      },
    );

    return response({ success: true, player: result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to join Grid season.';
    return response({ success: false, error: message }, { status: 400 });
  }
}

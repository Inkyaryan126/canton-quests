import { NextResponse } from 'next/server';
import { cantonFoundingSeasonPackage } from '@/lib/grid/cities/canton/founding-season';
import { isGridOnboardingWriteEnabled } from '@/lib/grid/server/onboarding-feature-flags';
import { claimGridOnboardingStarterTerritory } from '@/lib/grid/server/onboarding-starter-claim-service';
import { createSupabaseGridOnboardingSeasonPort } from '@/lib/grid/server/supabase-onboarding-season';
import { createSupabaseGridOnboardingStarterClaimPort } from '@/lib/grid/server/supabase-onboarding-starter-claim';
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
  const territoryId =
    typeof body.territoryId === 'string' ? body.territoryId : '';
  const idempotencyKey =
    typeof body.idempotencyKey === 'string' ? body.idempotencyKey : '';

  if (!territoryId.trim() || !idempotencyKey.trim()) {
    return response(
      {
        success: false,
        error: 'Missing territoryId or idempotencyKey.',
      },
      { status: 400 },
    );
  }

  try {
    const claim = await claimGridOnboardingStarterTerritory(
      createSupabaseGridOnboardingSeasonPort(cantonFoundingSeasonPackage),
      createSupabaseGridOnboardingStarterClaimPort(),
      {
        playerId: session.player.id,
        territoryId,
        idempotencyKey,
        now: new Date().toISOString(),
      },
    );

    return response({ success: true, claim });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to claim Grid starter territory.';
    return response({ success: false, error: message }, { status: 400 });
  }
}

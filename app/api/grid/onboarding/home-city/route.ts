import { NextResponse } from 'next/server';
import { cantonFoundingSeasonPackage } from '@/lib/grid/cities/canton/founding-season';
import { isGridOnboardingWriteEnabled } from '@/lib/grid/server/onboarding-feature-flags';
import { confirmGridOnboardingHomeCity } from '@/lib/grid/server/onboarding-home-city-service';
import { recordGridPassportHomeCity } from '@/lib/grid/server/passport-home-city-service';
import { createSupabaseGridPassportPort } from '@/lib/grid/server/supabase-passport';
import { createSupabaseGridEventLedgerPort } from '@/lib/grid/server/supabase-event-ledger';
import { createSupabaseGridOnboardingHomeCityPort } from '@/lib/grid/server/supabase-onboarding-home-city';
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

  try {
    const now = new Date().toISOString();
    const homeCity = await confirmGridOnboardingHomeCity(
      createSupabaseGridOnboardingHomeCityPort(cantonFoundingSeasonPackage),
      session.player.id,
      now,
    );

    await recordGridPassportHomeCity(
      createSupabaseGridEventLedgerPort(),
      createSupabaseGridPassportPort(),
      {
        playerId: session.player.id,
        cityId: homeCity.cityId,
        citySlug: homeCity.citySlug,
        occurredAt: now,
      },
    );

    return response({
      success: true,
      homeCity: { citySlug: homeCity.citySlug, confirmed: homeCity.confirmed },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to confirm Grid Home City.';
    return response({ success: false, error: message }, { status: 400 });
  }
}

import { NextResponse } from 'next/server';
import { cantonFoundingSeasonPackage } from '@/lib/grid/cities/canton/founding-season';
import { isGridOnboardingWriteEnabled } from '@/lib/grid/server/onboarding-feature-flags';
import { recordGridPassportCityEntry } from '@/lib/grid/server/passport-service';
import { createSupabaseGridPassportPersistencePort } from '@/lib/grid/server/supabase-passport';
import { confirmGridOnboardingHomeCity } from '@/lib/grid/server/onboarding-home-city-service';
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

    await recordGridPassportCityEntry(
      createSupabaseGridPassportPersistencePort(),
      {
        playerId: session.player.id,
        cityId: homeCity.cityId,
        idempotencyKey: `passport:home-city:${session.player.id}:${homeCity.cityId}`,
        enteredAt: now,
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

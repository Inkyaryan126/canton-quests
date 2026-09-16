import { NextResponse } from 'next/server';
import { cantonFoundingSeasonPackage } from '@/lib/grid/cities/canton/founding-season';
import { isGridWorldReadEnabled } from '@/lib/grid/server/feature-flags';
import { readGridOnboardingStatus } from '@/lib/grid/server/onboarding-status-service';
import { createSupabaseGridOnboardingStatusPort } from '@/lib/grid/server/supabase-onboarding-status';
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

  if (!isGridWorldReadEnabled()) {
    return response(
      { success: false, error: 'Grid runtime is not enabled.' },
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
    const onboarding = await readGridOnboardingStatus(
      createSupabaseGridOnboardingStatusPort(cantonFoundingSeasonPackage),
      session.player.id,
    );

    return response({ success: true, onboarding });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to read Grid onboarding status.';
    return response({ success: false, error: message }, { status: 500 });
  }
}

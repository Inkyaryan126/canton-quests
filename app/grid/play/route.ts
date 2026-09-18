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

function noStore(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  return response;
}

export async function GET(request: Request) {
  const session = await resolveAuthenticatedSession(request);

  const redirect = (pathname: string) => {
    const response = noStore(NextResponse.redirect(new URL(pathname, request.url)));
    setAuthCookies(response, session.refreshedSession, session.player?.id);
    return response;
  };

  const error = (message: string) => {
    const response = noStore(
      NextResponse.json({ success: false, error: message }, { status: 500 }),
    );
    setAuthCookies(response, session.refreshedSession, session.player?.id);
    return response;
  };

  if (!isGridWorldReadEnabled()) {
    return redirect('/grid');
  }

  if (!session.player) {
    return redirect('/login?next=%2Fgrid%2Fplay');
  }

  try {
    const onboarding = await readGridOnboardingStatus(
      createSupabaseGridOnboardingStatusPort(cantonFoundingSeasonPackage),
      session.player.id,
    );

    if (onboarding.complete && onboarding.invariantViolations.length === 0) {
      return redirect('/grid/return');
    }

    return redirect('/grid/onboarding');
  } catch (cause) {
    const message =
      cause instanceof Error
        ? cause.message
        : 'Failed to resolve Grid player entry state.';
    return error(message);
  }
}

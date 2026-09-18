import { NextResponse } from 'next/server';
import { cantonFoundingSeasonPackage } from '@/lib/grid/cities/canton/founding-season';
import { isGridWorldReadEnabled } from '@/lib/grid/server/feature-flags';
import { projectGridOnboardingProperties } from '@/lib/grid/server/onboarding-property-service';
import { readSupabaseGridWorldRuntime } from '@/lib/grid/server/supabase-world-projection';
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
    const runtime = await readSupabaseGridWorldRuntime(
      cantonFoundingSeasonPackage,
      session.player.id,
    );
    const properties = projectGridOnboardingProperties(
      cantonFoundingSeasonPackage,
      runtime,
      session.player.id,
    );
    return response({ success: true, properties });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to read Grid onboarding properties.';
    return response({ success: false, error: message }, { status: 500 });
  }
}

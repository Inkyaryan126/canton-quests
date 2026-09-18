import { NextResponse } from 'next/server';
import { cantonFoundingSeasonPackage } from '@/lib/grid/cities/canton/founding-season';
import { isGridWorldReadEnabled } from '@/lib/grid/server/feature-flags';
import { projectGridOnboardingIncome } from '@/lib/grid/server/onboarding-income-service';
import { createSupabaseGridReturnSummaryPort } from '@/lib/grid/server/supabase-return-summary';
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
    const income = await projectGridOnboardingIncome(
      createSupabaseGridReturnSummaryPort(cantonFoundingSeasonPackage),
      cantonFoundingSeasonPackage,
      session.player.id,
      new Date().toISOString(),
    );
    return response({ success: true, income });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to read Grid onboarding income.';
    return response({ success: false, error: message }, { status: 500 });
  }
}

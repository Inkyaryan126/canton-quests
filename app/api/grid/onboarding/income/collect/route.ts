import { NextResponse } from 'next/server';
import { cantonFoundingSeasonPackage } from '@/lib/grid/cities/canton/founding-season';
import { isGridOnboardingWriteEnabled } from '@/lib/grid/server/onboarding-feature-flags';
import { collectGridOnboardingIncome } from '@/lib/grid/server/onboarding-income-service';
import { createSupabaseGridOnboardingSeasonPort } from '@/lib/grid/server/supabase-onboarding-season';
import { createSupabaseGridEconomyCommandPort } from '@/lib/grid/server/supabase-economy';
import { createSupabaseGridReturnSummaryPort } from '@/lib/grid/server/supabase-return-summary';
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
    const income = await collectGridOnboardingIncome(
      createSupabaseGridReturnSummaryPort(cantonFoundingSeasonPackage),
      createSupabaseGridOnboardingSeasonPort(cantonFoundingSeasonPackage),
      createSupabaseGridEconomyCommandPort(),
      cantonFoundingSeasonPackage,
      {
        playerId: session.player.id,
        idempotencyKey,
        now: new Date().toISOString(),
      },
    );
    return response({ success: true, income });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to collect Grid onboarding income.';
    return response({ success: false, error: message }, { status: 400 });
  }
}

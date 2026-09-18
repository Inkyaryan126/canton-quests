import { NextResponse } from 'next/server';
import { cantonFoundingSeasonPackage } from '@/lib/grid/cities/canton/founding-season';
import { createSupabaseGridEventLedgerPort } from '@/lib/grid/server/supabase-event-ledger';
import { isGridOnboardingWriteEnabled } from '@/lib/grid/server/onboarding-feature-flags';
import { completeGridOnboardingUnlock } from '@/lib/grid/server/onboarding-unlock-service';
import { createSupabaseGridOnboardingUnlockPort } from '@/lib/grid/server/supabase-onboarding-unlock';
import { createSupabaseGridOnboardingStatusPort } from '@/lib/grid/server/supabase-onboarding-status';
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
    const unlock = await completeGridOnboardingUnlock(
      createSupabaseGridOnboardingUnlockPort(cantonFoundingSeasonPackage),
      createSupabaseGridOnboardingStatusPort(cantonFoundingSeasonPackage),
      createSupabaseGridEventLedgerPort(),
      cantonFoundingSeasonPackage,
      {
        playerId: session.player.id,
        idempotencyKey,
        now: new Date().toISOString(),
      },
    );
    return response({ success: true, unlock });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to unlock the full Grid city.';
    return response({ success: false, error: message }, { status: 400 });
  }
}

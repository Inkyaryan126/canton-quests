import { NextResponse } from 'next/server';
import { cantonFoundingSeasonPackage } from '@/lib/grid/cities/canton/founding-season';
import { cryptoSignalDiceRoller } from '@/lib/grid/server/crypto-signal-dice';
import { createSupabaseGridEventLedgerPort } from '@/lib/grid/server/supabase-event-ledger';
import { isGridOnboardingWriteEnabled } from '@/lib/grid/server/onboarding-feature-flags';
import { completeGridOnboardingTutorialContest } from '@/lib/grid/server/onboarding-tutorial-contest-service';
import { createSupabaseGridOnboardingTutorialContestPort } from '@/lib/grid/server/supabase-onboarding-tutorial-contest';
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
    const tutorial = await completeGridOnboardingTutorialContest(
      createSupabaseGridOnboardingTutorialContestPort(
        cantonFoundingSeasonPackage,
      ),
      createSupabaseGridOnboardingStatusPort(cantonFoundingSeasonPackage),
      createSupabaseGridEventLedgerPort(),
      cryptoSignalDiceRoller,
      cantonFoundingSeasonPackage,
      {
        playerId: session.player.id,
        idempotencyKey,
        now: new Date().toISOString(),
      },
    );
    return response({ success: true, tutorial });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to complete Grid onboarding tutorial contest.';
    return response({ success: false, error: message }, { status: 400 });
  }
}

import { NextResponse } from 'next/server';
import { withdrawGridContest } from '@/lib/grid/server/contest-session-service';
import { isGridContestWriteEnabled } from '@/lib/grid/server/feature-flags';
import { createSupabaseGridContestSessionPort } from '@/lib/grid/server/supabase-contest-session';
import {
  resolveAuthenticatedSession,
  setAuthCookies,
} from '@/lib/supabase-auth';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: { contestId: string } },
) {
  const session = await resolveAuthenticatedSession(request);
  const response = (body: unknown, init?: ResponseInit) => {
    const result = NextResponse.json(body, init);
    setAuthCookies(
      result,
      session.refreshedSession,
      session.player?.id,
    );
    return result;
  };

  if (!isGridContestWriteEnabled()) {
    return response({ success: false, error: 'Grid contests are not enabled.' }, { status: 404 });
  }
  if (!session.player) {
    return response({ success: false, error: 'Authentication required.' }, { status: 401 });
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
    const result = await withdrawGridContest(
      createSupabaseGridContestSessionPort(),
      {
        contestId: params.contestId,
        attackerPlayerId: session.player.id,
        idempotencyKey,
        now: new Date().toISOString(),
      },
    );

    return response({ success: true, contest: result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to withdraw Grid contest.';
    return response({ success: false, error: message }, { status: 400 });
  }
}

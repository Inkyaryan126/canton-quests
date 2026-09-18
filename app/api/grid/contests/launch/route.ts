import { NextResponse } from 'next/server';
import { cantonFoundingSeasonPackage } from '@/lib/grid/cities/canton/founding-season';
import { launchGridBoardContest } from '@/lib/grid/server/contest-board-service';
import { isGridContestWriteEnabled } from '@/lib/grid/server/feature-flags';
import { createSupabaseGridContestAttackPort } from '@/lib/grid/server/supabase-contest-attack';
import { createSupabaseGridContestBoardPort } from '@/lib/grid/server/supabase-contest-board';
import { createSupabaseGridContestSessionPort } from '@/lib/grid/server/supabase-contest-session';
import { createSupabaseGridEconomyCommandPort } from '@/lib/grid/server/supabase-economy';
import { createSupabaseGridOfflineDefensePolicyPort } from '@/lib/grid/server/supabase-offline-defense';
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

  if (!isGridContestWriteEnabled()) {
    return response(
      { success: false, error: 'Grid contests are not enabled.' },
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
  const sourceTerritorySlug =
    typeof body.sourceTerritorySlug === 'string'
      ? body.sourceTerritorySlug
      : '';
  const targetTerritorySlug =
    typeof body.targetTerritorySlug === 'string'
      ? body.targetTerritorySlug
      : '';
  const attackerCommittedInfluence = body.attackerCommittedInfluence;
  const idempotencyKey =
    typeof body.idempotencyKey === 'string' ? body.idempotencyKey : '';

  if (!sourceTerritorySlug.trim() || !targetTerritorySlug.trim()) {
    return response(
      {
        success: false,
        error: 'Missing sourceTerritorySlug or targetTerritorySlug.',
      },
      { status: 400 },
    );
  }
  if (
    !Number.isInteger(attackerCommittedInfluence) ||
    attackerCommittedInfluence <= 0
  ) {
    return response(
      { success: false, error: 'Invalid attackerCommittedInfluence.' },
      { status: 400 },
    );
  }
  if (!idempotencyKey.trim()) {
    return response(
      { success: false, error: 'Missing idempotencyKey.' },
      { status: 400 },
    );
  }

  const contestConfig = cantonFoundingSeasonPackage.seasonTemplate.contest;
  if (!contestConfig) {
    return response(
      { success: false, error: 'Contest rules are not configured.' },
      { status: 503 },
    );
  }

  try {
    const contest = await launchGridBoardContest(
      createSupabaseGridContestBoardPort(cantonFoundingSeasonPackage),
      createSupabaseGridContestAttackPort(cantonFoundingSeasonPackage),
      createSupabaseGridContestSessionPort(),
      createSupabaseGridOfflineDefensePolicyPort(),
      createSupabaseGridEconomyCommandPort(),
      contestConfig,
      {
        attackerPlayerId: session.player.id,
        sourceTerritorySlug,
        targetTerritorySlug,
        attackerCommittedInfluence,
        idempotencyKey,
        now: new Date().toISOString(),
      },
    );

    return response({ success: true, contest });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to launch Grid contest.';
    return response({ success: false, error: message }, { status: 400 });
  }
}

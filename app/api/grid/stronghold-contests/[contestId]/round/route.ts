import { NextResponse } from 'next/server';
import { cantonFoundingSeasonPackage } from '@/lib/grid/cities/canton/founding-season';
import { isGridContestWriteEnabled } from '@/lib/grid/server/feature-flags';
import { cryptoSignalDiceRoller } from '@/lib/grid/server/crypto-signal-dice';
import { resolveGridPveStrongholdSessionRound } from '@/lib/grid/server/pve-stronghold-session-service';
import { createSupabaseGridPveStrongholdSessionPort } from '@/lib/grid/server/supabase-pve-stronghold-session';
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
    setAuthCookies(result, session.refreshedSession, session.player?.id);
    return result;
  };

  if (!isGridContestWriteEnabled()) {
    return response(
      { success: false, error: 'Grid stronghold contests are not enabled.' },
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

  const contestConfig = cantonFoundingSeasonPackage.seasonTemplate.contest;
  if (!contestConfig) {
    return response(
      { success: false, error: 'Contest rules are not configured.' },
      { status: 503 },
    );
  }

  try {
    const round = await resolveGridPveStrongholdSessionRound(
      createSupabaseGridPveStrongholdSessionPort({
        citySlug: cantonFoundingSeasonPackage.city.slug,
        seasonSlug: cantonFoundingSeasonPackage.seasonTemplate.slug,
        resolveStronghold: async () => null,
      }),
      cryptoSignalDiceRoller,
      contestConfig,
      {
        contestId: params.contestId,
        attackerPlayerId: session.player.id,
        idempotencyKey,
        now: new Date().toISOString(),
      },
    );

    return response({
      success: true,
      round: {
        contestId: round.contestId,
        strongholdId: round.strongholdId,
        roundNumber: round.roundNumber,
        status: round.status,
        attackerRolls: round.attackerRolls,
        garrisonRolls: round.garrisonRolls,
        attackerInfluenceLost: round.attackerInfluenceLost,
        garrisonInfluenceLost: round.garrisonInfluenceLost,
        attackerRemainingInfluence: round.attackerRemainingInfluence,
        garrisonRemainingInfluence: round.garrisonRemainingInfluence,
        attackerRefundedInfluence: round.attackerRefundedInfluence,
        territoryCaptured: round.territoryCaptured,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to resolve Grid stronghold round.';
    return response({ success: false, error: message }, { status: 400 });
  }
}

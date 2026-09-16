import { NextResponse } from 'next/server';
import { cantonFoundingSeasonPackage } from '@/lib/grid/cities/canton/founding-season';
import { launchGridContestAttack } from '@/lib/grid/server/contest-attack-service';
import { isGridContestWriteEnabled } from '@/lib/grid/server/feature-flags';
import { createSupabaseGridContestAttackPort } from '@/lib/grid/server/supabase-contest-attack';
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
  const sourceTerritoryId =
    typeof body.sourceTerritoryId === 'string' ? body.sourceTerritoryId : '';
  const targetTerritoryId =
    typeof body.targetTerritoryId === 'string' ? body.targetTerritoryId : '';
  const attackerCommittedInfluence = body.attackerCommittedInfluence;
  const idempotencyKey =
    typeof body.idempotencyKey === 'string' ? body.idempotencyKey : '';

  if (!sourceTerritoryId.trim() || !targetTerritoryId.trim()) {
    return response(
      { success: false, error: 'Missing sourceTerritoryId or targetTerritoryId.' },
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
    const attack = await launchGridContestAttack(
      createSupabaseGridContestAttackPort(cantonFoundingSeasonPackage),
      createSupabaseGridContestSessionPort(),
      createSupabaseGridOfflineDefensePolicyPort(),
      createSupabaseGridEconomyCommandPort(),
      contestConfig,
      {
        attackerPlayerId: session.player.id,
        sourceTerritoryId,
        targetTerritoryId,
        attackerCommittedInfluence,
        idempotencyKey,
        now: new Date().toISOString(),
      },
    );

    return response({ success: true, attack });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to launch Grid contest attack.';
    return response({ success: false, error: message }, { status: 400 });
  }
}

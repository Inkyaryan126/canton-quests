import { NextResponse } from 'next/server';
import { cantonFoundingSeasonPackage } from '@/lib/grid/cities/canton/founding-season';
import { isGridContestWriteEnabled } from '@/lib/grid/server/feature-flags';
import { createGridNpcStrongholdTrustedResolver } from '@/lib/grid/server/npc-stronghold-live-service';
import { launchGridPveStrongholdSession } from '@/lib/grid/server/pve-stronghold-session-service';
import { createSupabaseGridNpcStrongholdRegistryPort } from '@/lib/grid/server/supabase-npc-stronghold-registry';
import { createSupabaseGridNpcStrongholdRuntimeEvidencePort } from '@/lib/grid/server/supabase-npc-stronghold-runtime';
import { createSupabaseGridPveStrongholdSessionPort } from '@/lib/grid/server/supabase-pve-stronghold-session';
import {
  resolveAuthenticatedSession,
  setAuthCookies,
} from '@/lib/supabase-auth';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: { strongholdId: string } },
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
  const sourceTerritorySlug =
    typeof body.sourceTerritorySlug === 'string'
      ? body.sourceTerritorySlug
      : '';
  const attackerCommittedInfluence = body.attackerCommittedInfluence;
  const idempotencyKey =
    typeof body.idempotencyKey === 'string' ? body.idempotencyKey : '';

  if (!sourceTerritorySlug.trim()) {
    return response(
      { success: false, error: 'Missing sourceTerritorySlug.' },
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

  if (!cantonFoundingSeasonPackage.seasonTemplate.contest) {
    return response(
      { success: false, error: 'Contest rules are not configured.' },
      { status: 503 },
    );
  }

  const registryPort = createSupabaseGridNpcStrongholdRegistryPort();
  const evidencePort = createSupabaseGridNpcStrongholdRuntimeEvidencePort();
  const trustedResolver = createGridNpcStrongholdTrustedResolver(
    registryPort,
    evidencePort,
    {
      citySlug: cantonFoundingSeasonPackage.city.slug,
      seasonSlug: cantonFoundingSeasonPackage.seasonTemplate.slug,
    },
  );

  try {
    const contest = await launchGridPveStrongholdSession(
      createSupabaseGridPveStrongholdSessionPort({
        citySlug: cantonFoundingSeasonPackage.city.slug,
        seasonSlug: cantonFoundingSeasonPackage.seasonTemplate.slug,
        resolveStronghold: trustedResolver,
      }),
      {
        attackerPlayerId: session.player.id,
        sourceTerritorySlug,
        strongholdId: params.strongholdId,
        attackerCommittedInfluence,
        idempotencyKey,
        now: new Date().toISOString(),
      },
    );

    return response({
      success: true,
      contest: {
        contestId: contest.contestId,
        strongholdId: contest.strongholdId,
        factionId: contest.factionId,
        status: contest.status,
        attackerCommittedInfluence: contest.attackerCommittedInfluence,
        garrisonCommittedInfluence: contest.garrisonCommittedInfluence,
        startedAt: contest.startedAt,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to launch Grid stronghold contest.';
    const safeMessage = message.startsWith('Grid stronghold runtime evidence incomplete:')
      ? 'Grid strongholds are temporarily unavailable.'
      : message;
    return response({ success: false, error: safeMessage }, { status: 400 });
  }
}

import { NextResponse } from 'next/server';
import { cantonFoundingSeasonPackage } from '@/lib/grid/cities/canton/founding-season';
import type { GridOfflineDefensePolicy } from '@/lib/grid/core/offline-defense-types';
import {
  getGridOfflineDefensePolicy,
  setGridOfflineDefensePolicy,
} from '@/lib/grid/server/offline-defense-service';
import { isGridContestWriteEnabled } from '@/lib/grid/server/feature-flags';
import {
  createSupabaseGridOfflineDefensePolicyPort,
  resolveSupabaseGridSeasonId,
} from '@/lib/grid/server/supabase-offline-defense';
import {
  resolveAuthenticatedSession,
  setAuthCookies,
} from '@/lib/supabase-auth';

export const dynamic = 'force-dynamic';

function jsonWithSession(
  session: Awaited<ReturnType<typeof resolveAuthenticatedSession>>,
  body: unknown,
  init?: ResponseInit,
) {
  const response = NextResponse.json(body, init);
  setAuthCookies(response, session.refreshedSession, session.player?.id);
  return response;
}

async function resolveSeasonId(): Promise<string> {
  const seasonId = await resolveSupabaseGridSeasonId(
    cantonFoundingSeasonPackage,
  );
  if (!seasonId) {
    throw new Error('Grid season is not available.');
  }
  return seasonId;
}

export async function GET(request: Request) {
  const session = await resolveAuthenticatedSession(request);

  if (!isGridContestWriteEnabled()) {
    return jsonWithSession(
      session,
      { success: false, error: 'Grid contests are not enabled.' },
      { status: 404 },
    );
  }
  if (!session.player) {
    return jsonWithSession(
      session,
      { success: false, error: 'Authentication required.' },
      { status: 401 },
    );
  }

  try {
    const state = await getGridOfflineDefensePolicy(
      createSupabaseGridOfflineDefensePolicyPort(),
      await resolveSeasonId(),
      session.player.id,
    );

    return jsonWithSession(session, {
      success: true,
      policy: state?.policy ?? null,
      updatedAt: state?.updatedAt ?? null,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to read Grid offline defense policy.';
    return jsonWithSession(
      session,
      { success: false, error: message },
      { status: 400 },
    );
  }
}

export async function PUT(request: Request) {
  const session = await resolveAuthenticatedSession(request);

  if (!isGridContestWriteEnabled()) {
    return jsonWithSession(
      session,
      { success: false, error: 'Grid contests are not enabled.' },
      { status: 404 },
    );
  }
  if (!session.player) {
    return jsonWithSession(
      session,
      { success: false, error: 'Authentication required.' },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => ({}));

  const idempotencyKey =
    typeof body.idempotencyKey === 'string' ? body.idempotencyKey : '';
  const policy =
    body.policy && typeof body.policy === 'object' && !Array.isArray(body.policy)
      ? (body.policy as GridOfflineDefensePolicy)
      : null;

  if (!idempotencyKey.trim()) {
    return jsonWithSession(
      session,
      { success: false, error: 'Missing idempotencyKey.' },
      { status: 400 },
    );
  }
  if (!policy) {
    return jsonWithSession(
      session,
      { success: false, error: 'Missing offline defense policy.' },
      { status: 400 },
    );
  }

  try {
    const state = await setGridOfflineDefensePolicy(
      createSupabaseGridOfflineDefensePolicyPort(),
      {
        seasonId: await resolveSeasonId(),
        playerId: session.player.id,
        policy,
        idempotencyKey,
        now: new Date().toISOString(),
      },
    );

    return jsonWithSession(session, {
      success: true,
      policy: state.policy,
      updatedAt: state.updatedAt,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to update Grid offline defense policy.';
    return jsonWithSession(
      session,
      { success: false, error: message },
      { status: 400 },
    );
  }
}

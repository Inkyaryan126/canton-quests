import { NextResponse } from 'next/server';
import { cantonFoundingSeasonPackage } from '@/lib/grid/cities/canton/founding-season';
import { GRID_DEVELOPMENT_BRANCHES } from '@/lib/grid/core/economy-types';
import { isGridEconomyWriteEnabled } from '@/lib/grid/server/feature-flags';
import { developGridWorldProperty } from '@/lib/grid/server/property-action-service';
import { createSupabaseGridPropertyActionPort } from '@/lib/grid/server/supabase-property-action';
import { createSupabaseGridPropertyCommandPort } from '@/lib/grid/server/supabase-property';
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

  if (!isGridEconomyWriteEnabled()) {
    return response(
      { success: false, error: 'Grid economy writes are not enabled.' },
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
  const propertySlug =
    typeof body.propertySlug === 'string' ? body.propertySlug : '';
  const idempotencyKey =
    typeof body.idempotencyKey === 'string' ? body.idempotencyKey : '';
  const branch =
    typeof body.branch === 'string' &&
    GRID_DEVELOPMENT_BRANCHES.includes(body.branch as never)
      ? body.branch
      : '';

  if (!propertySlug.trim() || !idempotencyKey.trim() || !branch) {
    return response(
      { success: false, error: 'Missing propertySlug, branch, or idempotencyKey.' },
      { status: 400 },
    );
  }

  try {
    const property = await developGridWorldProperty(
      createSupabaseGridPropertyActionPort(cantonFoundingSeasonPackage),
      createSupabaseGridPropertyCommandPort(),
      {
        playerId: session.player.id,
        propertySlug,
        branch: branch as (typeof GRID_DEVELOPMENT_BRANCHES)[number],
        idempotencyKey,
        now: new Date().toISOString(),
      },
    );
    return response({ success: true, property });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to develop Grid property.';
    return response({ success: false, error: message }, { status: 400 });
  }
}

import { NextResponse } from 'next/server';
import { resolveAdminSessionFromRequest } from '@/lib/admin-auth';
import { cantonFoundingSeasonPackage } from '@/lib/grid/cities/canton/founding-season';
import { isGridWorldReadEnabled } from '@/lib/grid/server/feature-flags';
import { setGridNpcStrongholdRuntimeAdminSurge } from '@/lib/grid/server/npc-stronghold-runtime-admin-service';
import { createSupabaseGridNpcStrongholdRuntimeAdminScopePort } from '@/lib/grid/server/supabase-npc-stronghold-runtime-admin';
import { createSupabaseGridNpcStrongholdRuntimeCommandPort } from '@/lib/grid/server/supabase-npc-stronghold-runtime-command';

export const dynamic = 'force-dynamic';

function noStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  return response;
}

export async function POST(request: Request) {
  if (!resolveAdminSessionFromRequest(request).isAdmin) {
    return noStore({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  if (!isGridWorldReadEnabled()) {
    return noStore({ success: false, error: 'Grid runtime is not enabled.' }, { status: 404 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const value = body.surgeIntensityBps;
    if (value !== null && (typeof value !== 'number' || !Number.isSafeInteger(value))) {
      return noStore(
        { success: false, error: 'Invalid Grid NPC runtime request: surgeIntensityBps must be a safe integer or null' },
        { status: 400 },
      );
    }
    const idempotencyKey =
      typeof body.idempotencyKey === 'string' ? body.idempotencyKey : '';
    const result = await setGridNpcStrongholdRuntimeAdminSurge(
      createSupabaseGridNpcStrongholdRuntimeAdminScopePort({
        citySlug: cantonFoundingSeasonPackage.city.slug,
        seasonSlug: cantonFoundingSeasonPackage.seasonTemplate.slug,
      }),
      createSupabaseGridNpcStrongholdRuntimeCommandPort(),
      {
        surgeIntensityBps: value,
        idempotencyKey,
        now: new Date().toISOString(),
      },
    );
    return noStore({ success: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const invalid = message.startsWith('Grid NPC runtime');
    if (!invalid) console.error('[Grid admin stronghold runtime surge POST]', error);
    return noStore(
      { success: false, error: invalid ? message : 'Failed to set Grid NPC Surge intensity.' },
      { status: invalid ? 400 : 500 },
    );
  }
}

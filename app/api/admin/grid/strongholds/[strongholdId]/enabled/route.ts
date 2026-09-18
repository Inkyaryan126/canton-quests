import { NextResponse } from 'next/server';
import { resolveAdminSessionFromRequest } from '@/lib/admin-auth';
import { cantonFoundingSeasonPackage } from '@/lib/grid/cities/canton/founding-season';
import { isGridWorldReadEnabled } from '@/lib/grid/server/feature-flags';
import { setGridNpcStrongholdDefinitionEnabled } from '@/lib/grid/server/npc-stronghold-definition-admin-service';
import { createSupabaseGridNpcStrongholdDefinitionAdminPort } from '@/lib/grid/server/supabase-npc-stronghold-definition-admin';

export const dynamic = 'force-dynamic';

function noStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  return response;
}

export async function PATCH(
  request: Request,
  { params }: { params: { strongholdId: string } },
) {
  if (!resolveAdminSessionFromRequest(request).isAdmin) {
    return noStore({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  if (!isGridWorldReadEnabled()) {
    return noStore(
      { success: false, error: 'Grid runtime is not enabled.' },
      { status: 404 },
    );
  }
  try {
    const body = await request.json().catch(() => ({}));
    if (typeof body.enabled !== 'boolean') {
      return noStore(
        { success: false, error: 'Invalid Grid stronghold request: enabled must be boolean' },
        { status: 400 },
      );
    }
    const idempotencyKey =
      typeof body.idempotencyKey === 'string' ? body.idempotencyKey : '';
    const result = await setGridNpcStrongholdDefinitionEnabled(
      createSupabaseGridNpcStrongholdDefinitionAdminPort({
        citySlug: cantonFoundingSeasonPackage.city.slug,
        seasonSlug: cantonFoundingSeasonPackage.seasonTemplate.slug,
      }),
      {
        strongholdId: params.strongholdId,
        enabled: body.enabled,
        idempotencyKey,
        now: new Date().toISOString(),
      },
    );
    return noStore({ success: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const invalid = message.startsWith('Grid NPC stronghold definition');
    if (!invalid) console.error('[Grid admin strongholds enabled PATCH]', error);
    return noStore(
      { success: false, error: invalid ? message : 'Failed to update Grid stronghold enabled state.' },
      { status: invalid ? 400 : 500 },
    );
  }
}

import { NextResponse } from 'next/server';
import { resolveAdminSessionFromRequest } from '@/lib/admin-auth';
import { cantonFoundingSeasonPackage } from '@/lib/grid/cities/canton/founding-season';
import { isGridWorldReadEnabled } from '@/lib/grid/server/feature-flags';
import { getGridNpcStrongholdRuntimeAdminStatus } from '@/lib/grid/server/npc-stronghold-runtime-admin-service';
import { createSupabaseGridNpcStrongholdRegistryPort } from '@/lib/grid/server/supabase-npc-stronghold-registry';
import { createSupabaseGridNpcStrongholdRuntimeEvidencePort } from '@/lib/grid/server/supabase-npc-stronghold-runtime';

export const dynamic = 'force-dynamic';

function noStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  return response;
}

export async function GET(request: Request) {
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
    const now = new Date().toISOString();
    const runtime = await getGridNpcStrongholdRuntimeAdminStatus(
      createSupabaseGridNpcStrongholdRegistryPort(),
      createSupabaseGridNpcStrongholdRuntimeEvidencePort(),
      {
        citySlug: cantonFoundingSeasonPackage.city.slug,
        seasonSlug: cantonFoundingSeasonPackage.seasonTemplate.slug,
        now,
      },
    );
    return noStore({ success: true, now, runtime });
  } catch (error) {
    console.error('[Grid admin stronghold runtime GET]', error);
    return noStore(
      { success: false, error: 'Failed to read Grid stronghold runtime.' },
      { status: 500 },
    );
  }
}

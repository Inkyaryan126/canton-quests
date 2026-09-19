import { NextResponse } from 'next/server';
import { resolveAdminSessionFromRequest } from '@/lib/admin-auth';
import { cantonFoundingSeasonPackage } from '@/lib/grid/cities/canton/founding-season';
import { isGridWorldReadEnabled } from '@/lib/grid/server/feature-flags';
import { reconcileGridSeasonLifecycle } from '@/lib/grid/server/season-lifecycle-service';
import { createSupabaseGridSeasonLifecyclePort } from '@/lib/grid/server/supabase-season-lifecycle';

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
    return noStore(
      { success: false, error: 'Grid runtime is not enabled.' },
      { status: 404 },
    );
  }

  try {
    const result = await reconcileGridSeasonLifecycle(
      createSupabaseGridSeasonLifecyclePort(),
      {
        citySlug: cantonFoundingSeasonPackage.city.slug,
        seasonSlug: cantonFoundingSeasonPackage.seasonTemplate.slug,
        surgeHours: cantonFoundingSeasonPackage.seasonTemplate.surgeHours,
        now: new Date().toISOString(),
      },
    );

    return noStore({ success: true, result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Grid season lifecycle failed.';
    const invalid = message.startsWith('Grid season lifecycle');
    if (!invalid) console.error('[Grid admin season lifecycle POST]', error);
    return noStore(
      {
        success: false,
        error: invalid ? message : 'Failed to reconcile Grid season lifecycle.',
      },
      { status: invalid ? 400 : 500 },
    );
  }
}

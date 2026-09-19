import { NextResponse } from 'next/server';
import { resolveAdminSessionFromRequest } from '@/lib/admin-auth';
import { cantonFoundingSeasonPackage } from '@/lib/grid/cities/canton/founding-season';
import { isGridSeasonArchiveEnabled } from '@/lib/grid/server/season-archive-feature-flags';
import { archiveGridSeason } from '@/lib/grid/server/season-archive-service';
import { createSupabaseGridSeasonArchivePort } from '@/lib/grid/server/supabase-season-archive';
import { createSupabaseGridPassportPort } from '@/lib/grid/server/supabase-passport';

export const dynamic = 'force-dynamic';

function noStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  return response;
}

function errorStatus(error: unknown): number {
  const message = error instanceof Error ? error.message : '';
  if (
    message.includes('ACTIVE_PVP_CONTESTS') ||
    message.includes('ACTIVE_PVE_CONTESTS') ||
    message.includes('PENDING_CONTRACT_REWARDS') ||
    message.includes('SEASON_ALREADY_ARCHIVED')
  ) {
    return 409;
  }
  if (
    message.startsWith('Grid season archive') ||
    message.includes('SEASON_ARCHIVE_')
  ) {
    return 400;
  }
  return 500;
}

export async function POST(request: Request) {
  const admin = resolveAdminSessionFromRequest(request);
  if (!admin.isAdmin) {
    return noStore({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  if (!isGridSeasonArchiveEnabled()) {
    return noStore(
      { success: false, error: 'Grid season archive is not enabled.' },
      { status: 404 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const idempotencyKey =
    typeof body.idempotencyKey === 'string' ? body.idempotencyKey.trim() : '';
  const confirmSeasonSlug =
    typeof body.confirmSeasonSlug === 'string'
      ? body.confirmSeasonSlug.trim()
      : '';

  if (!idempotencyKey) {
    return noStore(
      { success: false, error: 'Missing idempotencyKey.' },
      { status: 400 },
    );
  }

  if (
    confirmSeasonSlug !== cantonFoundingSeasonPackage.seasonTemplate.slug
  ) {
    return noStore(
      {
        success: false,
        error: 'Season confirmation does not match the configured Grid season.',
      },
      { status: 400 },
    );
  }

  const cityPower =
    cantonFoundingSeasonPackage.seasonTemplate.cityPower;
  if (!cityPower) {
    return noStore(
      {
        success: false,
        error: 'City Power is not configured for the Grid season.',
      },
      { status: 503 },
    );
  }

  try {
    const result = await archiveGridSeason(
      createSupabaseGridSeasonArchivePort(),
      createSupabaseGridPassportPort(),
      {
        citySlug: cantonFoundingSeasonPackage.city.slug,
        seasonSlug: cantonFoundingSeasonPackage.seasonTemplate.slug,
        cityPowerConfig: cityPower,
        idempotencyKey,
        now: new Date().toISOString(),
      },
    );

    return noStore({
      success: true,
      archive: result.archive,
      standingsCount: result.standings.length,
      passportRebuiltCount: result.passportRebuiltCount,
      passportRebuildFailedPlayerIds:
        result.passportRebuildFailedPlayerIds,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Grid season archive failed.';
    const status = errorStatus(error);
    console.error('[Grid admin season archive]', error);
    return noStore({ success: false, error: message }, { status });
  }
}

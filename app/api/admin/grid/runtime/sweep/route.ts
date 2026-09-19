import { NextResponse } from 'next/server';
import { resolveAdminSessionFromRequest } from '@/lib/admin-auth';
import { cantonFoundingSeasonPackage } from '@/lib/grid/cities/canton/founding-season';
import { isGridAuctionWriteEnabled } from '@/lib/grid/server/auction-feature-flags';
import { isGridContractRewardSettlementEnabled } from '@/lib/grid/server/contract-reward-settlement-feature-flags';
import { isGridWorldReadEnabled } from '@/lib/grid/server/feature-flags';
import { runGridRuntimeMaintenanceSweep } from '@/lib/grid/server/runtime-maintenance-sweep-service';
import { createSupabaseGridAuctionCommandPort } from '@/lib/grid/server/supabase-auction';
import { createSupabaseGridAuctionSettlementSweepPort } from '@/lib/grid/server/supabase-auction-settlement-sweep';
import { createSupabaseGridContractRewardSettlementPort } from '@/lib/grid/server/supabase-contract-reward-settlement';
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
      {
        success: false,
        error: 'Grid runtime is not enabled.',
      },
      { status: 404 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const auctionLimit =
    typeof body.auctionLimit === 'number' ? body.auctionLimit : 25;
  const contractRewardLimit =
    typeof body.contractRewardLimit === 'number'
      ? body.contractRewardLimit
      : 25;

  try {
    const result = await runGridRuntimeMaintenanceSweep(
      {
        lifecyclePort: createSupabaseGridSeasonLifecyclePort(),
        auctionReadPort: createSupabaseGridAuctionSettlementSweepPort(),
        auctionCommandPort: createSupabaseGridAuctionCommandPort(),
        contractRewardPort:
          createSupabaseGridContractRewardSettlementPort(),
      },
      {
        citySlug: cantonFoundingSeasonPackage.city.slug,
        seasonSlug: cantonFoundingSeasonPackage.seasonTemplate.slug,
        surgeHours: cantonFoundingSeasonPackage.seasonTemplate.surgeHours,
        now: new Date().toISOString(),
        auctionSettlementEnabled: isGridAuctionWriteEnabled(),
        contractRewardSettlementEnabled:
          isGridContractRewardSettlementEnabled(),
        auctionLimit,
        contractRewardLimit,
      },
    );

    return noStore({ success: result.success, result });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Grid runtime maintenance sweep failed.';
    const invalid = message.startsWith(
      'Grid runtime maintenance sweep',
    );
    if (!invalid) {
      console.error('[Grid admin runtime maintenance sweep]', error);
    }
    return noStore(
      {
        success: false,
        error: invalid
          ? message
          : 'Failed to run Grid runtime maintenance sweep.',
      },
      { status: invalid ? 400 : 500 },
    );
  }
}

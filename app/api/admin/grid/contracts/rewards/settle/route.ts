import { NextResponse } from 'next/server';
import { resolveAdminSessionFromRequest } from '@/lib/admin-auth';
import { isGridContractRewardSettlementEnabled } from '@/lib/grid/server/contract-reward-settlement-feature-flags';
import { settlePendingGridContractRewards } from '@/lib/grid/server/contract-reward-settlement-service';
import { createSupabaseGridContractRewardSettlementPort } from '@/lib/grid/server/supabase-contract-reward-settlement';

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

  if (!isGridContractRewardSettlementEnabled()) {
    return noStore(
      {
        success: false,
        error: 'Grid Contract reward settlement is not enabled.',
      },
      { status: 404 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const limit =
    typeof body.limit === 'number' ? body.limit : 25;

  try {
    const result = await settlePendingGridContractRewards(
      createSupabaseGridContractRewardSettlementPort(),
      {
        now: new Date().toISOString(),
        limit,
      },
    );

    return noStore({
      success: result.failed === 0,
      summary: {
        discovered: result.discovered,
        applied: result.applied,
        duplicates: result.duplicates,
        failed: result.failed,
      },
      failures: result.failures,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Grid Contract reward settlement failed.';
    const invalid = message.startsWith('Grid Contract reward settlement');
    if (!invalid) console.error('[Grid Contract reward settlement]', error);
    return noStore(
      {
        success: false,
        error: invalid
          ? message
          : 'Failed to settle Grid Contract rewards.',
      },
      { status: invalid ? 400 : 500 },
    );
  }
}

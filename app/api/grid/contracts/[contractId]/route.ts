import { NextResponse } from 'next/server';
import { isGridWorldReadEnabled } from '@/lib/grid/server/feature-flags';
import { readGridContract } from '@/lib/grid/server/contract-read-service';
import { createSupabaseGridContractReadPort } from '@/lib/grid/server/supabase-contract-read';
import { resolveAuthenticatedSession, setAuthCookies } from '@/lib/supabase-auth';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { contractId: string } },
) {
  const session = await resolveAuthenticatedSession(request);
  const response = (body: unknown, init?: ResponseInit) => {
    const result = NextResponse.json(body, init);
    result.headers.set('Cache-Control', 'private, no-store, max-age=0');
    result.headers.set('Vary', 'Cookie');
    setAuthCookies(result, session.refreshedSession, session.player?.id);
    return result;
  };

  if (!isGridWorldReadEnabled()) {
    return response({ success: false, error: 'Grid runtime is not enabled.' }, { status: 404 });
  }
  if (!session.player) {
    return response({ success: false, error: 'Authentication required.' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  try {
    const result = await readGridContract(
      createSupabaseGridContractReadPort(),
      {
        cityId: searchParams.get('cityId') ?? '',
        seasonId: searchParams.get('seasonId') ?? '',
        contractId: params.contractId,
        playerId: session.player.id,
      },
    );
    if (!result) return response({ success: false, error: 'Grid contract not found.' }, { status: 404 });
    return response({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to read Grid contract.';
    return response({ success: false, error: message }, { status: 400 });
  }
}

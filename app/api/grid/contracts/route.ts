import { NextResponse } from 'next/server';
import { isGridWorldReadEnabled } from '@/lib/grid/server/feature-flags';
import { listActiveGridContracts } from '@/lib/grid/server/contract-read-service';
import { createSupabaseGridContractReadPort } from '@/lib/grid/server/supabase-contract-read';
import { resolveAuthenticatedSession, setAuthCookies } from '@/lib/supabase-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
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
  const cityId = searchParams.get('cityId') ?? '';
  const seasonId = searchParams.get('seasonId') ?? '';
  try {
    const result = await listActiveGridContracts(
      createSupabaseGridContractReadPort(),
      { cityId, seasonId, playerId: session.player.id },
    );
    return response({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to read active Grid contracts.';
    return response({ success: false, error: message }, { status: 400 });
  }
}

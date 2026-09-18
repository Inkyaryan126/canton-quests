import { NextResponse } from 'next/server';
import { cantonFoundingSeasonPackage } from '@/lib/grid/cities/canton/founding-season';
import { isGridWorldReadEnabled } from '@/lib/grid/server/feature-flags';
import { listGridNpcStrongholdLiveWorld } from '@/lib/grid/server/npc-stronghold-live-service';
import { createSupabaseGridNpcStrongholdRegistryPort } from '@/lib/grid/server/supabase-npc-stronghold-registry';
import { createSupabaseGridNpcStrongholdRuntimeEvidencePort } from '@/lib/grid/server/supabase-npc-stronghold-runtime';
import {
  resolveAuthenticatedSession,
  setAuthCookies,
} from '@/lib/supabase-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await resolveAuthenticatedSession(request);
  const response = (body: unknown, init?: ResponseInit) => {
    const result = NextResponse.json(body, init);
    setAuthCookies(result, session.refreshedSession, session.player?.id);
    return result;
  };

  if (!isGridWorldReadEnabled()) {
    return response(
      { success: false, error: 'Grid strongholds are not enabled.' },
      { status: 404 },
    );
  }
  if (!session.player) {
    return response(
      { success: false, error: 'Authentication required.' },
      { status: 401 },
    );
  }

  try {
    const result = await listGridNpcStrongholdLiveWorld(
      createSupabaseGridNpcStrongholdRegistryPort(),
      createSupabaseGridNpcStrongholdRuntimeEvidencePort(),
      cantonFoundingSeasonPackage,
      new Date().toISOString(),
    );
    if (result.status === 'incomplete') {
      return response(
        { success: false, error: 'Grid strongholds are temporarily unavailable.' },
        { status: 503 },
      );
    }
    return response({ success: true, strongholds: result.strongholds });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to read Grid strongholds.';
    return response({ success: false, error: message }, { status: 500 });
  }
}

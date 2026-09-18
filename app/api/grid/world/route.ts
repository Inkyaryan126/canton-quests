import { NextResponse } from 'next/server';
import { cantonFoundingSeasonPackage } from '@/lib/grid/cities/canton/founding-season';
import {
  isGridContestWriteEnabled,
  isGridEconomyWriteEnabled,
  isGridWorldReadEnabled,
} from '@/lib/grid/server/feature-flags';
import { buildGridNpcStrongholdWorldProjection } from '@/lib/grid/server/npc-stronghold-world';
import { readSupabaseGridWorldRuntime } from '@/lib/grid/server/supabase-world-projection';
import { buildGridWorldProjection } from '@/lib/grid/server/world-projection';
import {
  resolveAuthenticatedSession,
  setAuthCookies,
} from '@/lib/supabase-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await resolveAuthenticatedSession(request);
  const viewerPlayerId = session.player?.id ?? null;
  const runtimeEnabled = isGridWorldReadEnabled();
  const economyWriteEnabled = isGridEconomyWriteEnabled();
  const contestWriteEnabled = isGridContestWriteEnabled();

  let runtime = null;
  let runtimeWarning: string | null = null;

  if (runtimeEnabled) {
    try {
      runtime = await readSupabaseGridWorldRuntime(
        cantonFoundingSeasonPackage,
        viewerPlayerId,
      );
    } catch (error) {
      runtimeWarning =
        error instanceof Error ? error.message : 'Grid runtime read failed';
    }
  }
  const projection = buildGridWorldProjection(cantonFoundingSeasonPackage, {
    viewerPlayerId,
    runtime,
    now: new Date().toISOString(),
    generatedAt: new Date().toISOString(),
  });
  const strongholds = buildGridNpcStrongholdWorldProjection(
    cantonFoundingSeasonPackage,
    [],
  );

  const response = NextResponse.json({
    projection,
    strongholds,
    runtimeEnabled,
    economyWriteEnabled,
    contestWriteEnabled,
    runtimeWarning,
  });

  setAuthCookies(response, session.refreshedSession, viewerPlayerId ?? undefined);
  return response;
}

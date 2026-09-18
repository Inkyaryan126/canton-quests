import { NextResponse } from 'next/server';
import { cantonFoundingSeasonPackage } from '@/lib/grid/cities/canton/founding-season';
import {
  isGridContestWriteEnabled,
  isGridEconomyWriteEnabled,
  isGridWorldReadEnabled,
} from '@/lib/grid/server/feature-flags';
import {
  buildGridDynamicEventWorldProjection,
  type GridDynamicEventWorldProjection,
} from '@/lib/grid/server/dynamic-event-world';
import { listActiveGridDynamicEvents } from '@/lib/grid/server/dynamic-event-service';
import { buildGridNpcStrongholdWorldProjection } from '@/lib/grid/server/npc-stronghold-world';
import { createSupabaseGridDynamicEventPort } from '@/lib/grid/server/supabase-dynamic-events';
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

  const now = new Date().toISOString();
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
    now,
    generatedAt: now,
  });
  const strongholds = buildGridNpcStrongholdWorldProjection(
    cantonFoundingSeasonPackage,
    [],
  );

  let dynamicEvents: GridDynamicEventWorldProjection[] = [];
  if (runtimeEnabled) {
    try {
      const eventInstances = await listActiveGridDynamicEvents(
        createSupabaseGridDynamicEventPort(),
        {
          citySlug: cantonFoundingSeasonPackage.city.slug,
          seasonSlug: cantonFoundingSeasonPackage.seasonTemplate.slug,
          now,
        },
      );
      dynamicEvents = buildGridDynamicEventWorldProjection(
        cantonFoundingSeasonPackage,
        eventInstances,
        now,
      );
    } catch (error) {
      const eventWarning =
        error instanceof Error
          ? error.message
          : 'Grid dynamic event read failed';
      runtimeWarning = runtimeWarning
        ? runtimeWarning + '; ' + eventWarning
        : eventWarning;
    }
  }

  const response = NextResponse.json({
    projection,
    strongholds,
    dynamicEvents,
    runtimeEnabled,
    economyWriteEnabled,
    contestWriteEnabled,
    runtimeWarning,
  });

  setAuthCookies(response, session.refreshedSession, viewerPlayerId ?? undefined);
  return response;
}

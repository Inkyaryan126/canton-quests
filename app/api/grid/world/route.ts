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
import { listGridNpcStrongholdLiveWorld } from '@/lib/grid/server/npc-stronghold-live-service';
import type { GridNpcStrongholdWorldProjection } from '@/lib/grid/server/npc-stronghold-world';
import { createSupabaseGridNpcStrongholdRegistryPort } from '@/lib/grid/server/supabase-npc-stronghold-registry';
import { createSupabaseGridNpcStrongholdRuntimeEvidencePort } from '@/lib/grid/server/supabase-npc-stronghold-runtime';
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

  const respond = (body: unknown, init?: ResponseInit) => {
    const response = NextResponse.json(body, init);
    response.headers.set('Cache-Control', 'private, no-store, max-age=0');
    response.headers.set('Vary', 'Cookie');
    setAuthCookies(response, session.refreshedSession, viewerPlayerId ?? undefined);
    return response;
  };

  if (!runtimeEnabled) {
    return respond(
      { success: false, error: 'Grid runtime is not enabled.' },
      { status: 404 },
    );
  }

  if (!session.player) {
    return respond(
      { success: false, error: 'Authentication required.' },
      { status: 401 },
    );
  }

  const now = new Date().toISOString();
  let runtime = null;
  let runtimeWarning: string | null = null;

  try {
    runtime = await readSupabaseGridWorldRuntime(
      cantonFoundingSeasonPackage,
      viewerPlayerId,
    );
  } catch (error) {
    return respond(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Grid runtime read failed.',
      },
      { status: 503 },
    );
  }
  if (!runtime) {
    runtimeWarning = 'Grid world runtime is not activated for this environment yet';
  }
  const projection = buildGridWorldProjection(cantonFoundingSeasonPackage, {
    viewerPlayerId,
    runtime,
    now,
    generatedAt: now,
  });
  let strongholds: GridNpcStrongholdWorldProjection[] = [];
  try {
    const strongholdRuntime = await listGridNpcStrongholdLiveWorld(
      createSupabaseGridNpcStrongholdRegistryPort(),
      createSupabaseGridNpcStrongholdRuntimeEvidencePort(),
      cantonFoundingSeasonPackage,
      now,
    );
    if (strongholdRuntime.status === 'ready') {
      strongholds = strongholdRuntime.strongholds;
    } else {
      const strongholdWarning = 'Grid stronghold runtime incomplete';
      runtimeWarning = runtimeWarning
        ? runtimeWarning + '; ' + strongholdWarning
        : strongholdWarning;
    }
  } catch {
    const strongholdWarning = 'Grid stronghold runtime read failed';
    runtimeWarning = runtimeWarning
      ? runtimeWarning + '; ' + strongholdWarning
      : strongholdWarning;
  }

  let dynamicEvents: GridDynamicEventWorldProjection[] = [];
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

  return respond({
    projection,
    strongholds,
    dynamicEvents,
    runtimeEnabled,
    economyWriteEnabled,
    contestWriteEnabled,
    runtimeWarning,
  });
}

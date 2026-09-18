import { NextResponse } from 'next/server';
import { resolveAdminSessionFromRequest } from '@/lib/admin-auth';
import { cantonFoundingSeasonPackage } from '@/lib/grid/cities/canton/founding-season';
import type { GridNpcStrongholdActivation } from '@/lib/grid/core/npc-stronghold-types';
import { isGridWorldReadEnabled } from '@/lib/grid/server/feature-flags';
import {
  listGridNpcStrongholdDefinitionsForAdmin,
  upsertGridNpcStrongholdDefinition,
} from '@/lib/grid/server/npc-stronghold-definition-admin-service';
import { createSupabaseGridNpcStrongholdDefinitionAdminPort } from '@/lib/grid/server/supabase-npc-stronghold-definition-admin';

export const dynamic = 'force-dynamic';

function noStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  return response;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Invalid Grid stronghold request: ${field} is required`);
  }
  return value.trim();
}

function integer(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new Error(`Invalid Grid stronghold request: ${field} must be a safe integer`);
  }
  return value;
}

function adminPort() {
  return createSupabaseGridNpcStrongholdDefinitionAdminPort({
    citySlug: cantonFoundingSeasonPackage.city.slug,
    seasonSlug: cantonFoundingSeasonPackage.seasonTemplate.slug,
  });
}

export async function GET(request: Request) {
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
    const strongholds = await listGridNpcStrongholdDefinitionsForAdmin(adminPort());
    return noStore({ success: true, strongholds });
  } catch (error) {
    console.error('[Grid admin strongholds GET]', error);
    return noStore(
      { success: false, error: 'Failed to read Grid stronghold definitions.' },
      { status: 500 },
    );
  }
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
    const body: unknown = await request.json();
    if (!isRecord(body)) throw new Error('Invalid Grid stronghold request: body must be an object');
    const landmarkSlug =
      body.landmarkSlug === null || body.landmarkSlug === undefined
        ? null
        : text(body.landmarkSlug, 'landmarkSlug');
    const activation = text(body.activation, 'activation') as GridNpcStrongholdActivation;
    const result = await upsertGridNpcStrongholdDefinition(adminPort(), {
      strongholdId: text(body.strongholdId, 'strongholdId'),
      factionId: text(body.factionId, 'factionId'),
      territorySlug: text(body.territorySlug, 'territorySlug'),
      landmarkSlug,
      activation,
      baseGarrisonInfluence: integer(body.baseGarrisonInfluence, 'baseGarrisonInfluence'),
      maxGarrisonInfluence: integer(body.maxGarrisonInfluence, 'maxGarrisonInfluence'),
      pressureReinforcementBps: integer(body.pressureReinforcementBps, 'pressureReinforcementBps'),
      surgeReinforcementBps: integer(body.surgeReinforcementBps, 'surgeReinforcementBps'),
      idempotencyKey: text(body.idempotencyKey, 'idempotencyKey'),
      now: new Date().toISOString(),
    });
    return noStore({ success: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const invalid = message.startsWith('Invalid Grid stronghold request:') ||
      message.startsWith('Grid NPC stronghold definition');
    if (!invalid) console.error('[Grid admin strongholds POST]', error);
    return noStore(
      { success: false, error: invalid ? message : 'Failed to save Grid stronghold definition.' },
      { status: invalid ? 400 : 500 },
    );
  }
}

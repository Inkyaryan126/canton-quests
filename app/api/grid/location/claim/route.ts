import { NextResponse } from 'next/server';
import { cantonFoundingSeasonPackage } from '@/lib/grid/cities/canton/founding-season';
import { isGridWorldReadEnabled } from '@/lib/grid/server/feature-flags';
import { claimVerifiedGridLocationEnhancement } from '@/lib/grid/server/location-play-service';
import { createSupabaseGridLocationPlayConfigPort } from '@/lib/grid/server/supabase-location-play-config';
import { createSupabaseGridLocationEnhancementPort } from '@/lib/grid/server/supabase-location-enhancement';
import {
  resolveAuthenticatedSession,
  setAuthCookies,
} from '@/lib/supabase-auth';

export const dynamic = 'force-dynamic';

type JsonRecord = Record<string, unknown>;

function bodyRecord(value: unknown): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid location enhancement claim.');
  }
  return value as JsonRecord;
}

function requiredText(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Location enhancement claim requires ${field}.`);
  }
  return value.trim();
}

export async function POST(request: Request) {
  const session = await resolveAuthenticatedSession(request);
  const response = (body: unknown, init?: ResponseInit) => {
    const result = NextResponse.json(body, init);
    result.headers.set('Cache-Control', 'private, no-store, max-age=0');
    result.headers.set('Vary', 'Cookie');
    setAuthCookies(result, session.refreshedSession, session.player?.id);
    return result;
  };

  if (!isGridWorldReadEnabled()) {
    return response(
      { success: false, error: 'Grid runtime is not enabled.' },
      { status: 404 },
    );
  }
  if (!session.player) {
    return response(
      { success: false, error: 'Authentication required.' },
      { status: 401 },
    );
  }

  const secret = process.env.GRID_LOCATION_ATTESTATION_SECRET;
  if (!secret) {
    return response(
      { success: false, error: 'Location verification is not configured.' },
      { status: 503 },
    );
  }

  try {
    const body = bodyRecord(await request.json());
    const result = await claimVerifiedGridLocationEnhancement(
      createSupabaseGridLocationPlayConfigPort(),
      createSupabaseGridLocationEnhancementPort(),
      {
        citySlug: cantonFoundingSeasonPackage.city.slug,
        seasonSlug: cantonFoundingSeasonPackage.seasonTemplate.slug,
        ruleId: requiredText(body.ruleId, 'ruleId'),
        playerId: session.player.id,
        attestationToken: requiredText(body.attestationToken, 'attestationToken'),
        idempotencyKey: requiredText(body.idempotencyKey, 'idempotencyKey'),
        now: new Date().toISOString(),
      },
      { secret },
    );

    if (result.status === 'ineligible') {
      return response({
        success: true,
        granted: false,
        reason: result.decision.reason,
      });
    }

    return response({
      success: true,
      granted: true,
      duplicate: result.duplicate,
      grant: {
        id: result.grant.id,
        ruleId: result.grant.ruleId,
        benefit: result.grant.benefit,
        claimedAt: result.grant.claimedAt,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Location enhancement claim failed.';
    return response({ success: false, error: message }, { status: 400 });
  }
}

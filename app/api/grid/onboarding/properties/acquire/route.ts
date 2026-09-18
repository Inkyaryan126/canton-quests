import { NextResponse } from 'next/server';
import { cantonFoundingSeasonPackage } from '@/lib/grid/cities/canton/founding-season';
import { isGridOnboardingWriteEnabled } from '@/lib/grid/server/onboarding-feature-flags';
import { acquireGridOnboardingProperty } from '@/lib/grid/server/onboarding-property-service';
import { createSupabaseGridOnboardingPropertyRefPort } from '@/lib/grid/server/supabase-onboarding-property';
import { createSupabaseGridOnboardingSeasonPort } from '@/lib/grid/server/supabase-onboarding-season';
import { createSupabaseGridPropertyCommandPort } from '@/lib/grid/server/supabase-property';
import {
  resolveAuthenticatedSession,
  setAuthCookies,
} from '@/lib/supabase-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const session = await resolveAuthenticatedSession(request);
  const response = (body: unknown, init?: ResponseInit) => {
    const result = NextResponse.json(body, init);
    setAuthCookies(result, session.refreshedSession, session.player?.id);
    return result;
  };

  if (!isGridOnboardingWriteEnabled()) {
    return response(
      { success: false, error: 'Grid onboarding writes are not enabled.' },
      { status: 404 },
    );
  }
  if (!session.player) {
    return response(
      { success: false, error: 'Authentication required.' },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const propertySlug =
    typeof body.propertySlug === 'string' ? body.propertySlug : '';
  const idempotencyKey =
    typeof body.idempotencyKey === 'string' ? body.idempotencyKey : '';
  if (!propertySlug.trim() || !idempotencyKey.trim()) {
    return response(
      { success: false, error: 'Missing propertySlug or idempotencyKey.' },
      { status: 400 },
    );
  }

  try {
    const property = await acquireGridOnboardingProperty(
      createSupabaseGridOnboardingSeasonPort(cantonFoundingSeasonPackage),
      createSupabaseGridOnboardingPropertyRefPort(cantonFoundingSeasonPackage),
      createSupabaseGridPropertyCommandPort(),
      {
        playerId: session.player.id,
        propertySlug,
        idempotencyKey,
        now: new Date().toISOString(),
      },
    );
    return response({ success: true, property });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to acquire Grid onboarding property.';
    return response({ success: false, error: message }, { status: 400 });
  }
}

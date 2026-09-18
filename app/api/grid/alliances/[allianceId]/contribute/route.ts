import { NextResponse } from 'next/server';
import { cantonFoundingSeasonPackage } from '@/lib/grid/cities/canton/founding-season';
import { contributePersistentGridAllianceInfluence } from '@/lib/grid/server/alliance-persistence-service';
import { resolveGridAllianceSeason } from '@/lib/grid/server/alliance-season-service';
import { isGridAllianceEnabled } from '@/lib/grid/server/feature-flags';
import { createSupabaseGridAlliancePersistencePort } from '@/lib/grid/server/supabase-alliance-persistence';
import { createSupabaseGridOnboardingSeasonPort } from '@/lib/grid/server/supabase-onboarding-season';
import { resolveAuthenticatedSession, setAuthCookies } from '@/lib/supabase-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: { allianceId: string } }) {
  const session = await resolveAuthenticatedSession(request);
  const response = (body: unknown, init?: ResponseInit) => {
    const result = NextResponse.json(body, init);
    setAuthCookies(result, session.refreshedSession, session.player?.id);
    return result;
  };
  if (!isGridAllianceEnabled()) return response({ success: false, error: 'Grid Alliances are not enabled.' }, { status: 404 });
  if (!session.player) return response({ success: false, error: 'Authentication required.' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const requestedInfluence = body.requestedInfluence;
  const idempotencyKey = typeof body.idempotencyKey === 'string' ? body.idempotencyKey : '';
  if (!Number.isSafeInteger(requestedInfluence) || (requestedInfluence as number) <= 0) {
    return response({ success: false, error: 'Invalid requestedInfluence.' }, { status: 400 });
  }
  if (!idempotencyKey.trim()) {
    return response({ success: false, error: 'Missing idempotencyKey.' }, { status: 400 });
  }

  try {
    const context = await resolveGridAllianceSeason(createSupabaseGridOnboardingSeasonPort(cantonFoundingSeasonPackage), cantonFoundingSeasonPackage);
    const contribution = await contributePersistentGridAllianceInfluence(createSupabaseGridAlliancePersistencePort(), {
      allianceId: params.allianceId,
      seasonId: context.seasonId,
      playerId: session.player.id,
      requestedInfluence: requestedInfluence as number,
      idempotencyKey,
      now: new Date().toISOString(),
    }, context.rules);
    return response({ success: true, contribution });
  } catch (error) {
    return response({ success: false, error: error instanceof Error ? error.message : 'Failed to contribute Grid Alliance Influence.' }, { status: 400 });
  }
}

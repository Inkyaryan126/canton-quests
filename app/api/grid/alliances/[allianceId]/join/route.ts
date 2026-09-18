import { NextResponse } from 'next/server';
import { cantonFoundingSeasonPackage } from '@/lib/grid/cities/canton/founding-season';
import { joinGridAlliance } from '@/lib/grid/server/alliance-persistence-service';
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

  try {
    const context = await resolveGridAllianceSeason(createSupabaseGridOnboardingSeasonPort(cantonFoundingSeasonPackage), cantonFoundingSeasonPackage);
    const result = await joinGridAlliance(createSupabaseGridAlliancePersistencePort(), {
      allianceId: params.allianceId,
      seasonId: context.seasonId,
      playerId: session.player.id,
      now: new Date().toISOString(),
    }, context.rules);
    return response({ success: true, result });
  } catch (error) {
    return response({ success: false, error: error instanceof Error ? error.message : 'Failed to join Grid Alliance.' }, { status: 400 });
  }
}

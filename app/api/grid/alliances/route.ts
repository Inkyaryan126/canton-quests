import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { cantonFoundingSeasonPackage } from '@/lib/grid/cities/canton/founding-season';
import { getGridAllianceDirectory } from '@/lib/grid/server/alliance-directory-service';
import { createGridAlliance } from '@/lib/grid/server/alliance-persistence-service';
import { resolveGridAllianceSeason } from '@/lib/grid/server/alliance-season-service';
import { isGridAllianceEnabled } from '@/lib/grid/server/feature-flags';
import { createSupabaseGridAlliancePersistencePort } from '@/lib/grid/server/supabase-alliance-persistence';
import { createSupabaseGridOnboardingSeasonPort } from '@/lib/grid/server/supabase-onboarding-season';
import { resolveAuthenticatedSession, setAuthCookies } from '@/lib/supabase-auth';

export const dynamic = 'force-dynamic';

function allianceIdentity(body: Record<string, unknown>) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const slug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : '';
  if (name.length < 3 || name.length > 48) {
    throw new Error('Alliance name must be 3-48 characters.');
  }
  if (!/^[a-z0-9][a-z0-9-]{2,31}$/.test(slug)) {
    throw new Error('Alliance slug must be 3-32 lowercase letters, numbers, or hyphens.');
  }
  return { name, slug };
}

async function authenticated(request: Request) {
  const session = await resolveAuthenticatedSession(request);
  const response = (body: unknown, init?: ResponseInit) => {
    const result = NextResponse.json(body, init);
    setAuthCookies(result, session.refreshedSession, session.player?.id);
    return result;
  };
  return { session, response };
}

export async function GET(request: Request) {
  const { session, response } = await authenticated(request);
  if (!isGridAllianceEnabled()) return response({ success: false, error: 'Grid Alliances are not enabled.' }, { status: 404 });
  if (!session.player) return response({ success: false, error: 'Authentication required.' }, { status: 401 });

  try {
    const context = await resolveGridAllianceSeason(
      createSupabaseGridOnboardingSeasonPort(cantonFoundingSeasonPackage),
      cantonFoundingSeasonPackage,
    );
    const directory = await getGridAllianceDirectory(
      createSupabaseGridAlliancePersistencePort(),
      context.seasonId,
      session.player.id,
    );
    return response({ success: true, directory, rules: context.rules });
  } catch (error) {
    return response({ success: false, error: error instanceof Error ? error.message : 'Failed to load Grid Alliances.' }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const { session, response } = await authenticated(request);
  if (!isGridAllianceEnabled()) return response({ success: false, error: 'Grid Alliances are not enabled.' }, { status: 404 });
  if (!session.player) return response({ success: false, error: 'Authentication required.' }, { status: 401 });

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const identity = allianceIdentity(body);
    const context = await resolveGridAllianceSeason(
      createSupabaseGridOnboardingSeasonPort(cantonFoundingSeasonPackage),
      cantonFoundingSeasonPackage,
    );
    const created = await createGridAlliance(
      createSupabaseGridAlliancePersistencePort(),
      {
        allianceId: randomUUID(),
        seasonId: context.seasonId,
        leaderPlayerId: session.player.id,
        slug: identity.slug,
        name: identity.name,
        now: new Date().toISOString(),
      },
      context.rules,
    );
    return response({ success: true, alliance: created.alliance, membership: created.membership });
  } catch (error) {
    return response({ success: false, error: error instanceof Error ? error.message : 'Failed to create Grid Alliance.' }, { status: 400 });
  }
}

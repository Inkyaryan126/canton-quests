import { NextResponse } from 'next/server';
import { getEventBySlugDB } from '@/lib/supabase-db';
import { resolveAuthenticatedSession } from '@/lib/supabase-auth';
import { getOrAssignCoreRoleDB } from '@/lib/personal-roles-db';

/**
 * GET /api/game/personal-roles?eventSlug=canton-weekend-1
 *
 * Strictly own-eyes-only: returns exactly and only the authenticated
 * caller's own role state (lazily assigning their core role on first
 * check). There is no parameter anywhere on this route that could name a
 * different player — "other clients must not be able to query hidden
 * roles" is structural here, not a check that could be bypassed by a
 * client-supplied id.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const eventSlug = url.searchParams.get('eventSlug') || '';
    if (!eventSlug) return NextResponse.json({ roles: [] });

    const event = await getEventBySlugDB(eventSlug);
    if (!event) return NextResponse.json({ roles: [] });

    const session = await resolveAuthenticatedSession(request);
    if (!session.player) {
      return NextResponse.json({ success: false, error: 'Authentication required.' }, { status: 401 });
    }

    const roles = await getOrAssignCoreRoleDB(event.id, session.player.id);
    return NextResponse.json({ roles });
  } catch (error) {
    console.error('[API /game/personal-roles] GET error:', error);
    return NextResponse.json({ error: 'Personal roles unavailable' }, { status: 500 });
  }
}

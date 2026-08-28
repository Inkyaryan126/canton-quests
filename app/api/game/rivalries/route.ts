import { NextResponse } from 'next/server';
import { getEventBySlugDB } from '@/lib/supabase-db';
import { resolveAuthenticatedSession } from '@/lib/supabase-auth';
import { getPlayerRivalryStatusDB } from '@/lib/bounties-db';

/**
 * GET /api/game/rivalries?eventSlug=canton-weekend-1
 *
 * The authenticated caller's own rival signal + bounty progress —
 * never another player's. A rival signal carries only displayName/rank/XP
 * gap (see lib/rivalries.ts) — no location, no PII. Bounty definitions
 * reference only public in-game attributes (path, rank, link type,
 * completed-quest count).
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const eventSlug = url.searchParams.get('eventSlug') || '';
    if (!eventSlug) return NextResponse.json({ rival: null, coreBounty: null, rivalBounty: null });

    const event = await getEventBySlugDB(eventSlug);
    if (!event) return NextResponse.json({ rival: null, coreBounty: null, rivalBounty: null });

    const session = await resolveAuthenticatedSession(request);
    if (!session.player) {
      return NextResponse.json({ success: false, error: 'Authentication required.' }, { status: 401 });
    }

    const status = await getPlayerRivalryStatusDB(event.id, session.player.id);
    return NextResponse.json({ rival: status.rival || null, coreBounty: status.coreBounty, rivalBounty: status.rivalBounty || null });
  } catch (error) {
    console.error('[API /game/rivalries] GET error:', error);
    return NextResponse.json({ error: 'Rivalries unavailable' }, { status: 500 });
  }
}

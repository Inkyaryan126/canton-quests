import { NextResponse } from 'next/server';
import { getEventBySlugDB } from '@/lib/supabase-db';
import { resolveAuthenticatedSession } from '@/lib/supabase-auth';
import { getWatcherStatusDB, evaluateWatcherEligibilityDB, getPersonalizedLiveEventsDB } from '@/lib/watchers-db';

/**
 * GET /api/game/watchers?eventSlug=canton-weekend-1
 *
 * Strictly own-eyes-only, same shape as /api/game/personal-roles: re-checks
 * the real, server-verifiable eligibility conditions this foundation wires
 * up (three sigils, Signal Carrier role), then returns the authenticated
 * caller's own status plus their personalized live-events feed. An
 * ineligible player — or anyone unauthenticated — never receives anything
 * beyond what the public feed already shows; there is no code path here
 * that can return another player's eligibility or a 'personalized' event
 * to someone who doesn't qualify.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const eventSlug = url.searchParams.get('eventSlug') || '';
    if (!eventSlug) return NextResponse.json({ status: null, liveEvents: [] });

    const event = await getEventBySlugDB(eventSlug);
    if (!event) return NextResponse.json({ status: null, liveEvents: [] });

    const session = await resolveAuthenticatedSession(request);
    if (!session.player) {
      return NextResponse.json({ success: false, error: 'Authentication required.' }, { status: 401 });
    }

    await evaluateWatcherEligibilityDB(event.id, session.player.id);
    const status = await getWatcherStatusDB(event.id, session.player.id);
    const liveEvents = await getPersonalizedLiveEventsDB(event.id, eventSlug, session.player.id);

    return NextResponse.json({ status, liveEvents });
  } catch (error) {
    console.error('[API /game/watchers] GET error:', error);
    return NextResponse.json({ error: 'Watcher status unavailable' }, { status: 500 });
  }
}

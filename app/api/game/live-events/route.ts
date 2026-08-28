import { NextResponse } from 'next/server';
import { getEventBySlugDB } from '@/lib/supabase-db';
import { getPublicLiveEventsDB } from '@/lib/live-events-db';

/**
 * Player-facing read for the Live City Events system — every currently
 * active, publicly-visible live event for one operation, sanitized (no
 * admin_payload, no Commander trigger key, no creator identity). No
 * authentication is required: this is what the Live Status HUD polls, the
 * same way GET /api/game/events/[slug] is already unauthenticated for its
 * public quest/event data. A 'private'/'personalized' visibility live event
 * (reserved for a future Watchers-style eligibility-scoped event) never
 * appears here — see the public_live_events view and getPublicLiveEventsDB.
 *
 * GET /api/game/live-events?eventSlug=canton-weekend-1
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const eventSlug = url.searchParams.get('eventSlug') || '';
    if (!eventSlug) {
      return NextResponse.json({ liveEvents: [] });
    }

    const event = await getEventBySlugDB(eventSlug);
    if (!event) {
      return NextResponse.json({ liveEvents: [] });
    }

    const liveEvents = await getPublicLiveEventsDB(event.id, eventSlug);
    return NextResponse.json({ liveEvents });
  } catch (error) {
    console.error('[API /game/live-events] GET error:', error);
    return NextResponse.json({ error: 'Live events unavailable' }, { status: 500 });
  }
}

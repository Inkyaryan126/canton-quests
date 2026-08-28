import { NextResponse } from 'next/server';
import { getEventBySlugDB } from '@/lib/supabase-db';
import { getCityStateDB } from '@/lib/city-state-db';
import { getPublicLiveEventsDB } from '@/lib/live-events-db';

/**
 * GET /api/game/city-state?eventSlug=canton-weekend-1
 *
 * The player-facing (and future GM-room / Watch-page) city-state read —
 * one aggregate projection combining registration/activity/district
 * progress/player links (lib/city-state-db.ts) with the currently-active
 * Live City Events (lib/live-events-db.ts, already sanitized there). No
 * authentication required: every field is a city-wide count/fraction with
 * zero per-player identity, safe for any visitor.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const eventSlug = url.searchParams.get('eventSlug') || '';
    if (!eventSlug) return NextResponse.json({ cityState: null, liveEvents: [] });

    const event = await getEventBySlugDB(eventSlug);
    if (!event) return NextResponse.json({ cityState: null, liveEvents: [] });

    const [cityState, liveEvents] = await Promise.all([getCityStateDB(event.id), getPublicLiveEventsDB(event.id, eventSlug)]);

    const activeFlashDrop = liveEvents.find((le) => le.eventType === 'FLASH_DROP') || null;
    const activeCityEvent = liveEvents.find((le) => le.eventType === 'CITY_EVENT') || null;
    const activeMultiplier = liveEvents.find((le) => le.eventType === 'XP_MULTIPLIER') || null;
    const communityMilestones = liveEvents.filter((le) => le.eventType === 'COMMUNITY_MILESTONE');

    return NextResponse.json({ cityState, activeFlashDrop, activeCityEvent, activeMultiplier, communityMilestones });
  } catch (error) {
    console.error('[API /game/city-state] GET error:', error);
    return NextResponse.json({ error: 'City state unavailable' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { getEventBySlugDB } from '@/lib/supabase-db';
import { getPublicFieldNpcsDB } from '@/lib/field-npcs-db';

/**
 * GET /api/game/field-npcs?eventSlug=canton-weekend-1
 * The sanitized, player-facing list of currently-active field NPCs — never
 * exact location, current code, or operator notes. See lib/field-npcs.ts's
 * toPublicFieldNpc for the exact boundary.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const eventSlug = url.searchParams.get('eventSlug') || '';
    if (!eventSlug) return NextResponse.json({ npcs: [] });

    const event = await getEventBySlugDB(eventSlug);
    if (!event) return NextResponse.json({ npcs: [] });

    const npcs = await getPublicFieldNpcsDB(event.id);
    return NextResponse.json({ npcs });
  } catch (error) {
    console.error('[API /game/field-npcs] GET error:', error);
    return NextResponse.json({ error: 'Field NPCs unavailable' }, { status: 500 });
  }
}

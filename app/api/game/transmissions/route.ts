import { NextResponse } from 'next/server';
import { resolveAuthenticatedSession } from '@/lib/supabase-auth';
import { getEventBySlugDB } from '@/lib/supabase-db';
import { isKnownCantonLaunchSlug } from '@/lib/launch-status';
import { COMMANDER_TRANSMISSIONS } from '@/lib/commander-transmissions';
import { getUnlockedCommanderVideoIds } from '@/lib/commander-video-unlock';

/**
 * Server-side archive-unlock check for the Founder's Cipher numbered
 * Commander video archive. The real registry (with real video/poster URLs
 * for all 15) is only ever imported here — a Route Handler, whose code
 * never ships to the client — and this response only ever includes
 * title/videoUrl/posterUrl for an entry the requesting player has actually
 * unlocked. A locked entry gets id + unlocked:false and nothing else, so a
 * future transmission's real URL is never present in the response body,
 * not even for a player poking at ?id=15 directly.
 *
 * GET /api/game/transmissions?eventSlug=canton-weekend-1              -> list
 * GET /api/game/transmissions?eventSlug=canton-weekend-1&id=7          -> single
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const eventSlug = url.searchParams.get('eventSlug') || '';
    const idParam = url.searchParams.get('id');

    if (!isKnownCantonLaunchSlug(eventSlug)) {
      // This archive is Founder's Cipher-only — any other/unknown slug gets
      // an honest empty/locked response, never the real registry.
      if (idParam) return NextResponse.json({ unlocked: false });
      return NextResponse.json({
        transmissions: COMMANDER_TRANSMISSIONS.map((t) => ({ id: t.id, order: t.order, unlocked: false })),
      });
    }

    const session = await resolveAuthenticatedSession(request);
    const player = session.player;

    let unlockedIds = new Set<number>();
    if (player) {
      const event = await getEventBySlugDB(eventSlug);
      if (event) {
        unlockedIds = await getUnlockedCommanderVideoIds(player.id, event.id);
      }
    }

    if (idParam) {
      const id = Number.parseInt(idParam, 10);
      const entry = COMMANDER_TRANSMISSIONS.find((t) => t.id === id);
      if (!entry || !unlockedIds.has(id)) {
        return NextResponse.json({ unlocked: false });
      }
      return NextResponse.json({
        unlocked: true,
        transmission: {
          id: entry.id,
          order: entry.order,
          title: entry.title,
          videoUrl: entry.videoUrl,
          posterUrl: entry.posterUrl,
        },
      });
    }

    return NextResponse.json({
      transmissions: COMMANDER_TRANSMISSIONS.map((t) => {
        const unlocked = unlockedIds.has(t.id);
        return unlocked
          ? { id: t.id, order: t.order, unlocked: true, title: t.title, posterUrl: t.posterUrl }
          : { id: t.id, order: t.order, unlocked: false };
      }),
    });
  } catch (error) {
    console.error('[API /game/transmissions] GET error:', error);
    return NextResponse.json({ error: 'Transmission archive unavailable' }, { status: 500 });
  }
}

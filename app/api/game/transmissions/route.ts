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
 * never ships to the client.
 *
 * The Transmissions page is a player archive, not a checklist: a
 * transmission the player hasn't reached yet must be entirely invisible —
 * not just its title/media withheld, but its very existence in the
 * response. The list response below therefore only ever includes entries
 * the requesting player has actually unlocked; a not-yet-unlocked entry is
 * omitted from the array outright (no id/order/locked-stub, and no way for
 * the array length to reveal how many more exist). The single-id lookup
 * (`&id=`) still returns a uniform `{ unlocked: false }` for a locked or
 * nonexistent id — no real URL is ever present in the response body, not
 * even for a player poking at ?id=15 directly.
 *
 * GET /api/game/transmissions?eventSlug=canton-weekend-1              -> list (revealed only)
 * GET /api/game/transmissions?eventSlug=canton-weekend-1&id=7          -> single
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const eventSlug = url.searchParams.get('eventSlug') || '';
    const idParam = url.searchParams.get('id');

    if (!isKnownCantonLaunchSlug(eventSlug)) {
      // This archive is Founder's Cipher-only — any other/unknown slug gets
      // an honest empty response, never the real registry.
      if (idParam) return NextResponse.json({ unlocked: false });
      return NextResponse.json({ transmissions: [] });
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
      transmissions: COMMANDER_TRANSMISSIONS.filter((t) => unlockedIds.has(t.id)).map((t) => ({
        id: t.id,
        order: t.order,
        title: t.title,
        posterUrl: t.posterUrl,
      })),
    });
  } catch (error) {
    console.error('[API /game/transmissions] GET error:', error);
    return NextResponse.json({ error: 'Transmission archive unavailable' }, { status: 500 });
  }
}

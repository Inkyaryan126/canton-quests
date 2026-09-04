import { NextResponse } from 'next/server';
import {
  getEventBySlugDB,
  getQuestsForEventDB,
  getLeaderboardDB,
  getPlayerProgressDB,
} from '@/lib/supabase-db';
import { getPlayerCipherProgressDB } from '@/lib/founders-cipher';
import { getPublicQuestView } from '@/lib/game-engine';
import { isKnownCantonLaunchSlug, isPreLaunchEvent } from '@/lib/launch-status';
import { resolveAuthenticatedSession, setAuthCookies } from '@/lib/supabase-auth';

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const slug = params.slug;
    const { searchParams } = new URL(request.url);
    const playerId = searchParams.get('playerId');

    // resolveAuthenticatedSession + withCookies (not the
    // resolveAuthenticatedPlayer shorthand) so a silent access-token
    // refresh gets persisted back to cookies — this route is hit on every
    // Mission page load, so it's a prime place for the rotated refresh
    // token to get silently burned and leave the player's next
    // authenticated request with no way back in.
    const sessionResult = await resolveAuthenticatedSession(request);
    const authenticatedPlayer = sessionResult.player;
    const withCookies = (body: unknown, init?: ResponseInit) => {
      const res = NextResponse.json(body, init);
      if (sessionResult.refreshedSession) setAuthCookies(res, sessionResult.refreshedSession, authenticatedPlayer?.id);
      return res;
    };

    const event = await getEventBySlugDB(slug);

    if (!event) {
      if (isKnownCantonLaunchSlug(slug)) {
        return withCookies({
          isPreLaunch: true,
          eventSlug: slug,
          message: 'Canton Quests activates September 11, 2026.',
        });
      }
      return withCookies({ error: 'Event not found' }, { status: 404 });
    }

    const quests = await getQuestsForEventDB(event.id);
    const safeQuests = quests.map(getPublicQuestView);
    const leaderboard = await getLeaderboardDB(event.id);
    const progress = playerId ? await getPlayerProgressDB(playerId, event.id) : null;
    const cipherProgress =
      playerId && authenticatedPlayer?.id === playerId
        ? await getPlayerCipherProgressDB(event.id, authenticatedPlayer.id)
        : null;

    return withCookies({
      event,
      quests: safeQuests,
      leaderboard,
      progress,
      cipherProgress,
      isPreLaunch: isPreLaunchEvent(event, slug),
    });
  } catch (error: any) {
    // Log server error securely without leaking stack or paths
    console.error('[API /events/[slug]] Server error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch event data' },
      { status: 500 }
    );
  }
}

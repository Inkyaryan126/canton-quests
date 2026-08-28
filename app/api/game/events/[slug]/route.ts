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
import { resolveAuthenticatedPlayer } from '@/lib/supabase-auth';

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const slug = params.slug;
    const { searchParams } = new URL(request.url);
    const playerId = searchParams.get('playerId');

    const event = await getEventBySlugDB(slug);

    if (!event) {
      if (isKnownCantonLaunchSlug(slug)) {
        return NextResponse.json({
          isPreLaunch: true,
          eventSlug: slug,
          message: 'Canton Quests activates September 11, 2026.',
        });
      }
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const quests = await getQuestsForEventDB(event.id);
    const safeQuests = quests.map(getPublicQuestView);
    const leaderboard = await getLeaderboardDB(event.id);
    const progress = playerId ? await getPlayerProgressDB(playerId, event.id) : null;
    const authenticatedPlayer = await resolveAuthenticatedPlayer(request);
    const cipherProgress =
      playerId && authenticatedPlayer?.id === playerId
        ? await getPlayerCipherProgressDB(event.id, authenticatedPlayer.id)
        : null;

    return NextResponse.json({
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

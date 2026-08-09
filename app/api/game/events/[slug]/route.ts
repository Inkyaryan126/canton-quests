import { NextResponse } from 'next/server';
import {
  getEventBySlugDB,
  getQuestsForEventDB,
  getLeaderboardDB,
  getPlayerProgressDB,
} from '@/lib/supabase-db';

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
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const quests = await getQuestsForEventDB(event.id);
    const leaderboard = await getLeaderboardDB(event.id);
    const progress = playerId ? await getPlayerProgressDB(playerId, event.id) : null;

    return NextResponse.json({
      event,
      quests,
      leaderboard,
      progress,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch event data' }, { status: 500 });
  }
}

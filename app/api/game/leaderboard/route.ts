import { NextResponse } from 'next/server';
import { getLeaderboardDB } from '@/lib/supabase-db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId') || 'evt-canton-vol-1';

    const leaderboard = await getLeaderboardDB(eventId);
    return NextResponse.json({ leaderboard: leaderboard || [] });
  } catch (error: any) {
    console.error('[API /leaderboard] Server error:', error);
    return NextResponse.json({ leaderboard: [], error: 'Failed to fetch leaderboard' }, { status: 500 });
  }
}

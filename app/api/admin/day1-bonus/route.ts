import { NextResponse } from 'next/server';
import { awardDay1XpLeaderBonusDB } from '@/lib/supabase-db';
import { getEvents } from '@/lib/game-engine';
import { resolveAdminSessionFromRequest } from '@/lib/admin-auth';

export async function POST(request: Request) {
  const session = resolveAdminSessionFromRequest(request);
  if (!session.isAdmin) {
    return NextResponse.json(
      { error: 'Unauthorized. Game Master admin session is required.' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { eventId, isRehearsal } = body;

    const targetEventId = eventId || getEvents()[0]?.id;
    if (!targetEventId) {
      return NextResponse.json(
        { error: 'Event ID is required.' },
        { status: 400 }
      );
    }

    const result = await awardDay1XpLeaderBonusDB(targetEventId, Boolean(isRehearsal));

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[API /admin/day1-bonus] Server error:', error);
    return NextResponse.json(
      { error: 'Failed to process Day 1 leader bonus.' },
      { status: 500 }
    );
  }
}

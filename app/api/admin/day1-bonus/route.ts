import { NextResponse } from 'next/server';
import { awardDay1XpLeaderBonusDB } from '@/lib/supabase-db';
import { getEvents } from '@/lib/game-engine';

export async function POST(request: Request) {
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
    return NextResponse.json(
      { error: error.message || 'Failed to process Day 1 leader bonus.' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { getEventsDB } from '@/lib/supabase-db';

export async function GET() {
  try {
    const events = await getEventsDB();
    return NextResponse.json({ events: events || [] });
  } catch (error: any) {
    console.error('[API /events] Server error:', error);
    return NextResponse.json({ events: [], error: 'Failed to fetch events' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { getEventsDB } from '@/lib/supabase-db';

export async function GET() {
  try {
    const events = await getEventsDB();
    return NextResponse.json({ events });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch events' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { getPlayerRosterDB } from '@/lib/supabase-db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || undefined;
    const roster = await getPlayerRosterDB(search);
    return NextResponse.json({ success: true, roster });
  } catch (error: any) {
    console.error('[API /game/roster] Server error:', error);
    return NextResponse.json({ success: false, roster: [], error: 'Roster unavailable' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { seedDatabaseDB } from '@/lib/supabase-db';

export async function POST() {
  try {
    const result = await seedDatabaseDB();
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Seed execution failed' }, { status: 500 });
  }
}

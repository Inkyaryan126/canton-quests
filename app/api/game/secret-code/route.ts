import { NextResponse } from 'next/server';
import { redeemSecretCodeDB } from '@/lib/supabase-db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { code, playerId, eventId } = body;

    if (!code || !playerId || !eventId) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields: code, playerId, eventId', pointsAwarded: 0 },
        { status: 400 }
      );
    }

    const result = await redeemSecretCodeDB(code, playerId, eventId);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Secret code redemption failed', pointsAwarded: 0 },
      { status: 500 }
    );
  }
}

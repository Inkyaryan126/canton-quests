import { NextResponse } from 'next/server';
import { redeemSecretCodeDB } from '@/lib/supabase-db';
import { resolveAuthenticatedPlayer } from '@/lib/supabase-auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { code, playerId, eventId } = body;

    if (!code || !eventId) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields: code, eventId', pointsAwarded: 0 },
        { status: 400 }
      );
    }

    const player = await resolveAuthenticatedPlayer(request);
    if (!player) {
      return NextResponse.json(
        { success: false, message: 'Authentication required.', pointsAwarded: 0 },
        { status: 401 }
      );
    }

    if (playerId && playerId !== player.id) {
      return NextResponse.json(
        { success: false, message: 'Authenticated player does not match requested code claimant.', pointsAwarded: 0 },
        { status: 403 }
      );
    }

    const result = await redeemSecretCodeDB(code, player.id, eventId);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Secret code redemption failed', pointsAwarded: 0 },
      { status: 500 }
    );
  }
}

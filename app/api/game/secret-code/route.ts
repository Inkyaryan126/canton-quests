import { NextResponse } from 'next/server';
import { redeemSecretCodeDB } from '@/lib/supabase-db';
import { resolveAuthenticatedSession, setAuthCookies } from '@/lib/supabase-auth';

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

    // resolveAuthenticatedSession + withCookies (not the
    // resolveAuthenticatedPlayer shorthand) so a silent access-token
    // refresh gets persisted back to cookies — otherwise the rotated
    // refresh token is burned here and the player's next authenticated
    // request has no way back in.
    const sessionResult = await resolveAuthenticatedSession(request);
    const player = sessionResult.player;
    const withCookies = (body: unknown, init?: ResponseInit) => {
      const res = NextResponse.json(body, init);
      if (sessionResult.refreshedSession) setAuthCookies(res, sessionResult.refreshedSession, player?.id);
      return res;
    };

    if (!player) {
      return withCookies(
        { success: false, message: 'Authentication required.', pointsAwarded: 0 },
        { status: 401 }
      );
    }

    if (playerId && playerId !== player.id) {
      return withCookies(
        { success: false, message: 'Authenticated player does not match requested code claimant.', pointsAwarded: 0 },
        { status: 403 }
      );
    }

    const result = await redeemSecretCodeDB(code, player.id, eventId);
    return withCookies(result);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Secret code redemption failed', pointsAwarded: 0 },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { resolveAuthenticatedSession, setAuthCookies } from '@/lib/supabase-auth';
import { claimDailyLuckySignalDB, getPlayerByIdDB } from '@/lib/supabase-db';

/**
 * POST /api/player/lucky-signal/claim
 *
 * The Daily Lucky Signal — one random-XP claim per player per calendar day
 * (UTC). The payout is rolled server-side inside claimDailyLuckySignalDB;
 * this route never receives or trusts a client-supplied amount.
 */
export async function POST(request: Request) {
  try {
    const sessionResult = await resolveAuthenticatedSession(request);
    const player = sessionResult.player;
    const withCookies = (body: unknown, init?: ResponseInit) => {
      const res = NextResponse.json(body, init);
      if (sessionResult.refreshedSession) setAuthCookies(res, sessionResult.refreshedSession, player?.id);
      return res;
    };

    if (!player) {
      return withCookies({ success: false, error: 'Authentication required. Please log in to Canton Quests.' }, { status: 401 });
    }

    const result = await claimDailyLuckySignalDB(player.id);
    if (!result.newlyGranted) {
      return withCookies({ success: true, alreadyClaimedToday: true, xpAwarded: 0 });
    }

    const updatedPlayer = await getPlayerByIdDB(player.id);
    return withCookies({
      success: true,
      alreadyClaimedToday: false,
      xpAwarded: result.xpAwarded,
      player: updatedPlayer,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to claim Daily Lucky Signal.' }, { status: 500 });
  }
}

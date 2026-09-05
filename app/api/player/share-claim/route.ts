import { NextResponse } from 'next/server';
import { resolveAuthenticatedSession, setAuthCookies } from '@/lib/supabase-auth';
import { claimSocialShareDB, getPlayerByIdDB } from '@/lib/supabase-db';

/**
 * POST /api/player/share-claim
 *
 * Honor-system daily XP for sharing Canton Quests to social media — the
 * client opens a real platform share-intent link and calls this immediately
 * after, no proof of an actual post required. `platform` is recorded only
 * for the response/analytics; the one-per-day rate limit (claimSocialShareDB)
 * is scoped to the player's account as a whole, not per platform, so
 * clicking multiple share buttons in one day only ever pays out once.
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

    const body = await request.json().catch(() => ({}));
    const platform = typeof body.platform === 'string' ? body.platform.slice(0, 40) : 'unknown';

    const result = await claimSocialShareDB(player.id);
    if (!result.newlyGranted) {
      return withCookies({ success: true, alreadyClaimedToday: true, xpAwarded: 0 });
    }

    const updatedPlayer = await getPlayerByIdDB(player.id);
    return withCookies({
      success: true,
      alreadyClaimedToday: false,
      xpAwarded: result.xpAwarded,
      player: updatedPlayer,
      platform,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to record share.' }, { status: 500 });
  }
}

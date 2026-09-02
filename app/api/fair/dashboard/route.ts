import { NextResponse } from 'next/server';
import { resolveAuthenticatedSession, setAuthCookies } from '@/lib/supabase-auth';
import { getEventBySlugDB, getEventParticipationDB, getFairMysteryBoardDB, getFairMysteryWinnersDB } from '@/lib/supabase-db';
import { FAIR_EVENT_SLUG, getFairOperationPhase } from '@/lib/fair-hunt';

export const dynamic = 'force-dynamic';

/**
 * GET /api/fair/dashboard
 *
 * Always returns the public $300 Mystery Money board (Operation phase, all
 * 20 Signal slots — found/unfound, with cashCents present only for found
 * Signals — plus the revealed/hidden totals and the non-competitive
 * per-player winnings list) so a logged-out visitor can see the whole
 * board. Player-specific fields (Operation participation) are only
 * included when authenticated.
 *
 * SECURITY: this route never reads fair_signal_prizes for an unfound
 * Signal into anything it returns — getFairMysteryBoardDB only attaches
 * cashCents to a signal object once a claim exists for it. There is no
 * field on this response from which an unfound Signal's dollar value can
 * be derived.
 */
export async function GET(request: Request) {
  try {
    const event = await getEventBySlugDB(FAIR_EVENT_SLUG);
    if (!event) {
      return NextResponse.json({ success: false, error: 'Fair QR Hunt event not found.' }, { status: 404 });
    }

    const [board, winners] = await Promise.all([getFairMysteryBoardDB(event.id), getFairMysteryWinnersDB(event.id)]);
    const phase = getFairOperationPhase(event);

    // SECURITY: omit exact aggregate revealed/hidden totals from the public response
    // to prevent math deduction leaks for remaining unfound Signals.
    const publicBoard = {
      signals: board.signals,
      totalPoolCents: board.totalPoolCents,
      foundCount: board.foundCount,
      totalCount: board.totalCount,
    };

    const base = {
      success: true,
      event,
      phase,
      board: publicBoard,
      winners,
    };

    const sessionResult = await resolveAuthenticatedSession(request);
    const player = sessionResult.player;

    if (!player) {
      return NextResponse.json({ ...base, isAuthenticated: false });
    }

    const participation = await getEventParticipationDB(event.id, player.id);
    const myWinnings = winners.find((w) => w.playerId === player.id);

    const response = NextResponse.json({
      ...base,
      isAuthenticated: true,
      player: {
        id: player.id,
        displayName: player.displayName,
        avatarUrl: player.avatarUrl,
        profileImageCropZoom: player.profileImageCropZoom,
        profileImageCropX: player.profileImageCropX,
        profileImageCropY: player.profileImageCropY,
      },
      participation: participation
        ? { id: participation.id, registeredAt: participation.registeredAt }
        : null,
      myWinnings: myWinnings ? { signalsFound: myWinnings.signalsFound, totalCents: myWinnings.totalCents } : { signalsFound: 0, totalCents: 0 },
    });

    if (sessionResult.refreshedSession) {
      setAuthCookies(response, sessionResult.refreshedSession, player.id);
    }

    return response;
  } catch (error: any) {
    console.error('[API /fair/dashboard] Server error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load Fair QR Hunt dashboard.' }, { status: 500 });
  }
}

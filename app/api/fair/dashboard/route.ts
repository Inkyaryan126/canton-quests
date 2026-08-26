import { NextResponse } from 'next/server';
import { resolveAuthenticatedSession, setAuthCookies } from '@/lib/supabase-auth';
import {
  getEventBySlugDB,
  getEventParticipationDB,
  getLeaderboardDB,
  getPlayerProgressDB,
  getQuestsForEventDB,
} from '@/lib/supabase-db';
import { getPublicQuestView } from '@/lib/game-engine';
import { computeFairDashboardProgress, FAIR_EVENT_SLUG, getFairDateKey, getFairOperationPhase } from '@/lib/fair-hunt';

export const dynamic = 'force-dynamic';

const LEADERBOARD_PREVIEW_SIZE = 10;

/**
 * GET /api/fair/dashboard
 *
 * Always returns the public Fair state (Operation phase, all 27 quest
 * slots, leaderboard preview) so a logged-out visitor can see what the
 * Fair QR Hunt is. Player-specific fields (score, rank, per-quest
 * claimed/unclaimed, Operation participation) are only included when
 * authenticated.
 */
export async function GET(request: Request) {
  try {
    const event = await getEventBySlugDB(FAIR_EVENT_SLUG);
    if (!event) {
      return NextResponse.json({ success: false, error: 'Fair QR Hunt event not found.' }, { status: 404 });
    }

    const [quests, leaderboard] = await Promise.all([getQuestsForEventDB(event.id), getLeaderboardDB(event.id)]);
    const activeFairQuests = quests.filter((q) => q.status === 'active');
    const publicQuests = activeFairQuests.map(getPublicQuestView);
    const phase = getFairOperationPhase(event);
    const todayDateKey = getFairDateKey();

    const sessionResult = await resolveAuthenticatedSession(request);
    const player = sessionResult.player;

    const base = {
      success: true,
      event,
      phase,
      todayDateKey,
      quests: publicQuests,
      leaderboardPreview: leaderboard.slice(0, LEADERBOARD_PREVIEW_SIZE),
      leaderboardSize: leaderboard.length,
    };

    if (!player) {
      const response = NextResponse.json({ ...base, isAuthenticated: false });
      return response;
    }

    const [participation, progress] = await Promise.all([
      getEventParticipationDB(event.id, player.id),
      getPlayerProgressDB(player.id, event.id),
    ]);

    const claimedQuestIds = new Set(progress.completedQuestIds);
    const rankEntry = leaderboard.find((entry) => entry.playerId === player.id);

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
      claimedQuestIds: Array.from(claimedQuestIds),
      rank: rankEntry?.rank ?? null,
      progress: computeFairDashboardProgress(publicQuests, claimedQuestIds),
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

import { NextResponse } from 'next/server';
import {
  getAchievementsDB,
  getAchievementsForPlayerDB,
  getDrawingEntriesForPlayerDB,
  getEventByIdDB,
  getEventParticipationDB,
  getLeaderboardDB,
  getParticipatedQuestCountDB,
  getPlayerProgressDB,
  hasEventSubmissionDB,
} from '@/lib/supabase-db';
import { resolveAuthenticatedSession, setAuthCookies, logAuthDiagnostic } from '@/lib/supabase-auth';
import { isSupabaseAdminConfigured, supabaseAdmin } from '@/lib/supabase';
import {
  countPrizeEntries,
  getAvatarPresetPath,
  getBadgeIconPath,
  getPlayerCityRank,
  getPlayerSignalStatus,
  PLAYER_CARD_BADGE_SLOT_COUNT,
  sanitizeFeaturedBadges,
} from '@/lib/player-command-center';

export const dynamic = 'force-dynamic';

const DEFAULT_EVENT_ID = 'evt-canton-vol-1';

async function getOwnerImageUrl(path?: string | null) {
  if (!path || !isSupabaseAdminConfigured || !supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin.storage
    .from('player-profile-images')
    .createSignedUrl(path, 60 * 10);
  return error ? null : data?.signedUrl || null;
}

/**
 * Powers the permanent Player File (/profile): the Player Card, Badge
 * Selection, and Profile Settings — nothing Mission-specific. Every DB call
 * here exists only to fill one of those three. Mission dashboards
 * (app/events/[slug]/*) fetch their own quest/path/district/finale data
 * directly rather than through this endpoint.
 */
export async function GET(request: Request) {
  try {
    const sessionResult = await resolveAuthenticatedSession(request);
    const player = sessionResult.player;
    if (!player) {
      logAuthDiagnostic('GET /api/player/command-center:unauthorized', {
        authenticated: false,
      });
      return NextResponse.json(
        { success: false, error: 'Authentication required. Please log in to Canton Quests.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId') || DEFAULT_EVENT_ID;

    const [progress, leaderboard, achievements, catalog, drawingEntries, participation, participatedQuestCount, activeEvent, hasSubmissionInActiveMission] = await Promise.all([
      getPlayerProgressDB(player.id, eventId),
      getLeaderboardDB(eventId),
      getAchievementsForPlayerDB(player.id),
      getAchievementsDB(),
      getDrawingEntriesForPlayerDB(player.id, eventId),
      getEventParticipationDB(eventId, player.id),
      getParticipatedQuestCountDB(player.id),
      getEventByIdDB(eventId),
      hasEventSubmissionDB(player.id, eventId),
    ]);

    // PLAYER SIGNAL — the Player Card's activity/status field, derived from
    // this Mission's real state (event.status, event_players, and
    // quest_submissions), never from XP or lifetime quest count. See
    // lib/player-command-center.ts getPlayerSignalStatus.
    const playerSignalStatus = getPlayerSignalStatus({
      hasActiveMission: activeEvent?.status === 'active',
      hasJoinedActiveMission: Boolean(participation),
      hasSubmissionInActiveMission,
    });

    const featuredSlugs = sanitizeFeaturedBadges(player.featuredBadgeSlugs || player.showcaseBadges || [], achievements);
    const badgeCatalog = catalog.map((achievement) => ({
      ...achievement,
      iconPath: getBadgeIconPath(achievement),
      earned: achievements.some((item) => item.achievementSlug === achievement.slug || item.achievement?.slug === achievement.slug),
      earnedAt: achievements.find((item) => item.achievementSlug === achievement.slug || item.achievement?.slug === achievement.slug)?.earnedAt,
    }));

    const response = NextResponse.json({
      success: true,
      player: {
        ...player,
        email: undefined,
        userId: undefined,
        profileImageUrl: await getOwnerImageUrl(player.profileImagePath),
        avatarPresetPath: getAvatarPresetPath(player.avatarPresetKey),
      },
      // PLAYER SIGNAL on the permanent Player Card — activity/status for
      // THIS Mission (eventId), not a lifetime or XP-derived value.
      playerSignalStatus,
      stats: {
        // The authoritative lifetime XP total (players.total_xp), not a
        // per-event derived sum — see lib/game-engine.ts getPlayerProgress
        // / lib/supabase-db.ts getPlayerProgressDB.
        totalXp: player.totalXp,
        cityRank: getPlayerCityRank(player.id, leaderboard),
        completedQuests: progress.completedCount,
        prizeEntries: countPrizeEntries(drawingEntries),
        // Distinct quests ever submitted for, across all Missions (lifetime
        // scope) — powers the Player Card's PLAYER LEVEL segments. See
        // lib/supabase-db.ts getParticipatedQuestCountDB.
        participatedQuestCount,
      },
      badges: {
        catalog: badgeCatalog,
        featuredSlugs,
        maxFeatured: PLAYER_CARD_BADGE_SLOT_COUNT,
      },
    });

    if (sessionResult.refreshedSession) {
      setAuthCookies(response, sessionResult.refreshedSession, player.id);
    }

    logAuthDiagnostic('GET /api/player/command-center:success', {
      playerId: player.id,
      displayName: player.displayName,
      wasRefreshed: Boolean(sessionResult.refreshedSession),
    });

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load command center.';
    logAuthDiagnostic('GET /api/player/command-center:error', { error: message });
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

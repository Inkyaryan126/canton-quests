import { NextResponse } from 'next/server';
import {
  getAchievementsDB,
  getAchievementsForPlayerDB,
  getCollectiblesForPlayerDB,
  getDrawingEntriesForPlayerDB,
  getLeaderboardDB,
  getPlayerProgressDB,
  getQuestsForEventDB,
} from '@/lib/supabase-db';
import { resolveAuthenticatedSession, setAuthCookies, logAuthDiagnostic } from '@/lib/supabase-auth';
import { isSupabaseAdminConfigured, supabaseAdmin } from '@/lib/supabase';
import {
  buildRecentActivity,
  computeDistrictProgress,
  countPrizeEntries,
  getAvatarPresetPath,
  getBadgeIconPath,
  getPlayerCityRank,
  getStartingDistrict,
  PLAYER_CARD_BADGE_SLOT_COUNT,
  recommendQuests,
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

    const [quests, progress, leaderboard, achievements, catalog, drawingEntries, playerCollectibles] = await Promise.all([
      getQuestsForEventDB(eventId),
      getPlayerProgressDB(player.id, eventId),
      getLeaderboardDB(eventId),
      getAchievementsForPlayerDB(player.id),
      getAchievementsDB(),
      getDrawingEntriesForPlayerDB(player.id, eventId),
      getCollectiblesForPlayerDB(player.id),
    ]);

    const completedSet = new Set(progress.completedQuestIds);
    const completedQuests = quests.filter((quest) => completedSet.has(quest.id));
    const recommendedQuests = recommendQuests(quests, player, progress);
    const featuredSlugs = sanitizeFeaturedBadges(player.featuredBadgeSlugs || player.showcaseBadges || [], achievements);
    const badgeCatalog = catalog.map((achievement) => ({
      ...achievement,
      iconPath: getBadgeIconPath(achievement),
      earned: achievements.some((item) => item.achievementSlug === achievement.slug || item.achievement?.slug === achievement.slug),
      earnedAt: achievements.find((item) => item.achievementSlug === achievement.slug || item.achievement?.slug === achievement.slug)?.earnedAt,
    }));

    const response = NextResponse.json({
      success: true,
      eventId,
      player: {
        ...player,
        email: undefined,
        userId: undefined,
        profileImageUrl: await getOwnerImageUrl(player.profileImagePath),
        avatarPresetPath: getAvatarPresetPath(player.avatarPresetKey),
      },
      startingDistrict: getStartingDistrict(player.selectedStartingPath),
      progress: {
        ...progress,
        totalPoints: progress.totalPoints,
        rank: getPlayerCityRank(player.id, leaderboard),
        prizeEntries: countPrizeEntries(drawingEntries),
      },
      stats: {
        totalXp: progress.totalPoints,
        cityRank: getPlayerCityRank(player.id, leaderboard),
        completedQuests: progress.completedCount,
        prizeEntries: countPrizeEntries(drawingEntries),
        badgesEarned: achievements.length,
      },
      quests: {
        recommended: recommendedQuests.slice(0, 4),
        startingDistrict: recommendedQuests.filter((quest) => quest.startingPath === (player.selectedStartingPath || 'family')).slice(0, 6),
        citywide: recommendedQuests.filter((quest) => quest.startingPath !== (player.selectedStartingPath || 'family')).slice(0, 12),
        allAvailable: quests.filter((quest) => quest.status === 'active'),
      },
      districtProgress: computeDistrictProgress(quests, progress.completedQuestIds),
      badges: {
        earned: achievements,
        catalog: badgeCatalog,
        featuredSlugs,
        maxFeatured: PLAYER_CARD_BADGE_SLOT_COUNT,
      },
      recentActivity: buildRecentActivity(completedQuests, achievements, drawingEntries),
      founderKeys: {
        mark: playerCollectibles.some((c) => c.collectibleId === 'col-founder-mark'),
        code: playerCollectibles.some((c) => c.collectibleId === 'col-founder-code'),
        word: playerCollectibles.some((c) => c.collectibleId === 'col-founder-word'),
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

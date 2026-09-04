import { NextResponse } from 'next/server';
import { resolveAuthenticatedSession, setAuthCookies } from '@/lib/supabase-auth';
import {
  evaluateAndGrantProfileCompletionRewardDB,
  getAchievementsForPlayerDB,
  getPlayerByIdDB,
  upsertPlayerDB,
} from '@/lib/supabase-db';
import {
  CUSTOM_AVATAR_KEY,
  PLAYER_AVATAR_PRESETS,
  VALID_STARTING_PATHS,
  resolveAvatarUrl,
  validateFeaturedBadges,
} from '@/lib/player-command-center';
import { StartingPath } from '@/lib/types';

const STARTING_PATHS = new Set<StartingPath>(VALID_STARTING_PATHS);

function cleanString(value: unknown, max: number) {
  if (value === undefined) return undefined;
  return String(value).trim().slice(0, max);
}

function cleanNumber(value: unknown, fallback: number, min: number, max: number) {
  // Number(null) is 0 (not NaN), so an explicit null must be excluded
  // before the finite check or it would silently pass as "0" instead of
  // falling back to the existing/default value.
  if (value === null || value === undefined || value === '') return fallback;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
}

export async function GET(request: Request) {
  try {
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
        { success: false, error: 'Authentication required. Please log in to Canton Quests.' },
        { status: 401 }
      );
    }

    return withCookies({
      success: true,
      player,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch player profile.' },
      { status: 500 }
    );
  }
}

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
      return withCookies(
        { success: false, error: 'Authentication required. Please log in to Canton Quests.' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));

    // Server-resolved player ID is authoritative. Ignore / reject attacker attempts to modify other players.
    if (body.playerId && body.playerId !== player.id) {
      return withCookies(
        { success: false, error: 'Unauthorized attempt to modify another player profile.' },
        { status: 403 }
      );
    }

    const earnedBadges = await getAchievementsForPlayerDB(player.id);
    const featuredValidation = validateFeaturedBadges(body.featuredBadgeSlugs ?? body.showcaseBadges, earnedBadges);
    if (!featuredValidation.ok) {
      return withCookies({ success: false, error: featuredValidation.error }, { status: 400 });
    }

    const displayName = cleanString(body.displayName, 30) || player.displayName;
    if (displayName.length < 2) {
      return withCookies({ success: false, error: 'Callsign must be at least 2 characters.' }, { status: 400 });
    }

    const selectedStartingPath = STARTING_PATHS.has(body.selectedStartingPath)
      ? (body.selectedStartingPath as StartingPath)
      : player.selectedStartingPath;
    const avatarPresetKey =
      PLAYER_AVATAR_PRESETS.includes(body.avatarPresetKey) ||
      (body.avatarPresetKey === CUSTOM_AVATAR_KEY && player.profileImagePath)
        ? body.avatarPresetKey
        : player.avatarPresetKey;
    const updated = await upsertPlayerDB({
      id: player.id,
      userId: player.userId,
      email: player.email,
      displayName,
      avatarUrl: resolveAvatarUrl({ id: player.id, avatarPresetKey, profileImagePath: player.profileImagePath }),
      avatarPresetKey,
      profileImagePath: player.profileImagePath,
      profileImageCropZoom: cleanNumber(body.profileImageCropZoom, player.profileImageCropZoom || 1, 1, 3),
      profileImageCropX: cleanNumber(body.profileImageCropX, player.profileImageCropX ?? 50, 0, 100),
      profileImageCropY: cleanNumber(body.profileImageCropY, player.profileImageCropY ?? 50, 0, 100),
      selectedStartingPath,
      bio: body.bio !== undefined ? cleanString(body.bio, 200) : player.bio,
      tagline: body.tagline !== undefined ? cleanString(body.tagline, 60) : player.tagline,
      hometown: body.hometown !== undefined ? cleanString(body.hometown, 40) : player.hometown,
      themeColor: body.themeColor || player.themeColor,
      favoriteStyle: body.favoriteStyle || player.favoriteStyle,
      selectedFlair: body.selectedFlair || player.selectedFlair,
      showcaseBadges: featuredValidation.slugs,
      featuredBadgeSlugs: featuredValidation.slugs,
      isMinor: body.isMinor !== undefined ? Boolean(body.isMinor) : player.isMinor,
    });

    const profileCompletionResult = await evaluateAndGrantProfileCompletionRewardDB(player.id);
    // Re-read the authoritative row rather than hand-computing totalXp/level
    // client-side — the grant above already persisted both, and a
    // freshly-added score-ledger row could double-count if summed here.
    const finalPlayer = profileCompletionResult.newlyGranted
      ? (await getPlayerByIdDB(player.id)) || updated
      : updated;

    return withCookies({
      success: true,
      player: finalPlayer,
      message: 'Profile updated successfully.',
      profileCompletionReward: profileCompletionResult.newlyGranted,
      profileCompletionXp: profileCompletionResult.xpAwarded,
      newAchievement: profileCompletionResult.newAchievement,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update profile.' },
      { status: 500 }
    );
  }
}

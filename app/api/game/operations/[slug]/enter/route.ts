import { NextResponse } from 'next/server';
import { resolveAuthenticatedPlayer } from '@/lib/supabase-auth';
import {
  awardAchievementDB,
  getAchievementsForPlayerDB,
  getEventBySlugDB,
  getOrCreateEventParticipationDB,
  upsertPlayerDB,
} from '@/lib/supabase-db';
import { VALID_STARTING_PATHS } from '@/lib/player-command-center';
import { isKnownCantonLaunchSlug } from '@/lib/launch-status';
import { PlayerAchievement, StartingPath } from '@/lib/types';

/**
 * POST /api/game/operations/[slug]/enter
 *
 * "Enter Operation" — finds or creates the player's event_players
 * participation record for this Operation. Never creates a duplicate
 * (event_players' real UNIQUE(event_id, player_id) constraint, upheld by
 * getOrCreateEventParticipationDB). Requires an authenticated permanent
 * player — Canton Quests has no per-Operation login, and no anonymous
 * participation model.
 *
 * Path is a UNIVERSAL player identity attribute
 * (players.selected_starting_path — see lib/player-command-center.ts).
 * When a path is submitted here (only possible for an Operation that
 * requiresPath), this route is the single place that persists it — onto
 * the player's permanent profile via upsertPlayerDB, the same call
 * app/api/player/profile/route.ts makes, so it becomes the canonical,
 * platform-wide choice immediately, not just something scoped to this one
 * Operation. It's also mirrored onto this Operation's own event_players
 * row for backward compatibility only; that field is never read back as
 * the source of truth for whether a path is "needed".
 */
export async function POST(request: Request, { params }: { params: { slug: string } }) {
  try {
    const player = await resolveAuthenticatedPlayer(request);
    if (!player) {
      return NextResponse.json(
        { success: false, error: 'Access Command Center to enter this Operation.' },
        { status: 401 }
      );
    }

    const event = await getEventBySlugDB(params.slug);
    if (!event) {
      return NextResponse.json({ success: false, error: 'Operation not found.' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    let path: StartingPath | undefined;
    if (event.requiresPath && VALID_STARTING_PATHS.includes(body?.path)) {
      path = body.path as StartingPath;
    }

    let currentPlayer = player;
    if (path && !VALID_STARTING_PATHS.includes(player.selectedStartingPath as StartingPath)) {
      currentPlayer = await upsertPlayerDB({ ...player, id: player.id, selectedStartingPath: path });
    }

    const participation = await getOrCreateEventParticipationDB(event.id, currentPlayer.id, path);
    const needsPath = Boolean(event.requiresPath) && !VALID_STARTING_PATHS.includes(currentPlayer.selectedStartingPath as StartingPath);

    // Pre-launch badges — real, earnable the moment their actual
    // precondition is met, never backdated. Both are scoped to known
    // Canton Quests launches only (not every Operation, e.g. the
    // path-free Fair QR Hunt has no "path chosen" moment to earn).
    const newAchievements: PlayerAchievement[] = [];
    if (isKnownCantonLaunchSlug(params.slug)) {
      const earned = await getAchievementsForPlayerDB(currentPlayer.id);
      const earnedSlugs = new Set(earned.map((pa) => pa.achievementSlug));

      if (!earnedSlugs.has('first-to-arrive')) {
        const granted = await awardAchievementDB(currentPlayer.id, 'first-to-arrive', event.id, 'Entered the Mission and confirmed Player Identity');
        if (granted) newAchievements.push(granted);
      }
      if (path && !earnedSlugs.has('path-chosen')) {
        const granted = await awardAchievementDB(currentPlayer.id, 'path-chosen', event.id, `Chose the ${path} starting path`);
        if (granted) newAchievements.push(granted);
      }
    }

    return NextResponse.json({
      success: true,
      event,
      participation,
      needsPath,
      player: currentPlayer,
      newAchievements,
    });
  } catch (error: any) {
    console.error('[API /game/operations/[slug]/enter] Server error:', error);
    return NextResponse.json({ success: false, error: 'Unable to enter this Operation.' }, { status: 500 });
  }
}

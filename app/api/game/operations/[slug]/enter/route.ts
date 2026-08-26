import { NextResponse } from 'next/server';
import { resolveAuthenticatedPlayer } from '@/lib/supabase-auth';
import { getEventBySlugDB, getOrCreateEventParticipationDB } from '@/lib/supabase-db';
import { VALID_STARTING_PATHS } from '@/lib/player-command-center';
import { StartingPath } from '@/lib/types';

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
 * Also doubles as "Choose Your Path": pass { path } in the body once the
 * player has entered an Operation that requiresPath. A path is only
 * accepted/stored for Operations that actually use one; it's ignored for
 * path-free Operations like the Fair QR Hunt.
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

    const participation = await getOrCreateEventParticipationDB(event.id, player.id, path);
    const needsPath = Boolean(event.requiresPath) && !participation.path;

    return NextResponse.json({
      success: true,
      event,
      participation,
      needsPath,
    });
  } catch (error: any) {
    console.error('[API /game/operations/[slug]/enter] Server error:', error);
    return NextResponse.json({ success: false, error: 'Unable to enter this Operation.' }, { status: 500 });
  }
}

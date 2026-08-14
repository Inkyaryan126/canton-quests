import { NextResponse } from 'next/server';
import { resolveAuthenticatedPlayer } from '@/lib/supabase-auth';
import { upsertPlayerDB } from '@/lib/supabase-db';

export async function GET(request: Request) {
  try {
    const player = await resolveAuthenticatedPlayer(request);
    if (!player) {
      return NextResponse.json(
        { success: false, error: 'Authentication required. Please log in with email OTP.' },
        { status: 401 }
      );
    }

    return NextResponse.json({
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
    const player = await resolveAuthenticatedPlayer(request);
    if (!player) {
      return NextResponse.json(
        { success: false, error: 'Authentication required. Please log in with email OTP.' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));

    // Server-resolved player ID is authoritative. Ignore / reject attacker attempts to modify other players.
    if (body.playerId && body.playerId !== player.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized attempt to modify another player profile.' },
        { status: 403 }
      );
    }

    const updated = await upsertPlayerDB({
      id: player.id,
      userId: player.userId,
      email: player.email,
      displayName: body.displayName ? String(body.displayName).trim() : player.displayName,
      avatarUrl: body.avatarUrl || player.avatarUrl,
      selectedStartingPath: body.selectedStartingPath || player.selectedStartingPath,
      bio: body.bio !== undefined ? String(body.bio).trim() : player.bio,
      tagline: body.tagline !== undefined ? String(body.tagline).trim() : player.tagline,
      hometown: body.hometown !== undefined ? String(body.hometown).trim() : player.hometown,
      themeColor: body.themeColor || player.themeColor,
      favoriteStyle: body.favoriteStyle || player.favoriteStyle,
      selectedFlair: body.selectedFlair || player.selectedFlair,
      showcaseBadges: body.showcaseBadges || player.showcaseBadges,
      isMinor: body.isMinor !== undefined ? Boolean(body.isMinor) : player.isMinor,
    });

    return NextResponse.json({
      success: true,
      player: updated,
      message: 'Profile updated successfully.',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update profile.' },
      { status: 500 }
    );
  }
}

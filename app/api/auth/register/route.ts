import { NextResponse } from 'next/server';
import {
  resolveAuthenticatedSupabaseUser,
  resolveOrCreatePlayerForAuthUser,
} from '@/lib/supabase-auth';
import { StartingPath } from '@/lib/types';
import { isSupabaseConfigured } from '@/lib/supabase';
import * as localEngine from '@/lib/game-engine';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      displayName,
      email,
      avatarUrl,
      selectedStartingPath,
      acquisitionSource,
      isMinor,
      bio,
      tagline,
      hometown,
      themeColor,
      favoriteStyle,
      selectedFlair,
    } = body;

    if (!displayName || typeof displayName !== 'string' || displayName.trim().length < 2) {
      return NextResponse.json(
        { success: false, error: 'Callsign must be at least 2 characters.' },
        { status: 400 }
      );
    }

    const path: StartingPath = ['family', 'challenge', 'secret'].includes(selectedStartingPath)
      ? selectedStartingPath
      : 'family';

    const source = acquisitionSource || 'main_site';

    // Verify Supabase Auth Session
    const authUser = await resolveAuthenticatedSupabaseUser(request);

    if (!authUser) {
      if (isSupabaseConfigured) {
        return NextResponse.json(
          {
            success: false,
            error: 'Verified email session is required to register a player profile. Please complete OTP verification first.',
          },
          { status: 401 }
        );
      }

      // Offline dev fallback
      const localPlayer = localEngine.registerPlayer({
        displayName: displayName.trim(),
        email: email?.trim() || undefined,
        avatarUrl: avatarUrl || '⚡',
        selectedStartingPath: path,
        acquisitionSource: source,
        isMinor: Boolean(isMinor),
        bio: bio?.trim() || undefined,
        tagline: tagline?.trim() || undefined,
        hometown: hometown?.trim() || undefined,
        themeColor: themeColor || undefined,
        favoriteStyle: favoriteStyle || undefined,
        selectedFlair: selectedFlair || undefined,
      });

      const response = NextResponse.json({
        success: true,
        player: localPlayer,
        message: `Welcome to Canton Quests, ${localPlayer.displayName}!`,
      });

      response.cookies.set('canton_player_id', localPlayer.id, {
        path: '/',
        httpOnly: false,
        maxAge: 60 * 60 * 24 * 30,
        sameSite: 'lax',
      });

      return response;
    }

    const player = await resolveOrCreatePlayerForAuthUser(authUser, {
      displayName: displayName.trim(),
      selectedStartingPath: path,
      acquisitionSource: source,
      avatarUrl: avatarUrl || '⚡',
      isMinor: Boolean(isMinor),
      bio: bio?.trim() || undefined,
      tagline: tagline?.trim() || undefined,
      hometown: hometown?.trim() || undefined,
      themeColor: themeColor || undefined,
      favoriteStyle: favoriteStyle || undefined,
      selectedFlair: selectedFlair || undefined,
    });

    const response = NextResponse.json({
      success: true,
      player,
      message: `Welcome to Canton Quests, ${player.displayName}!`,
    });

    // Set non-authoritative convenience cookie for mobile client UX
    response.cookies.set('canton_player_id', player.id, {
      path: '/',
      httpOnly: false,
      maxAge: 60 * 60 * 24 * 30,
      sameSite: 'lax',
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to register player account.' },
      { status: 500 }
    );
  }
}

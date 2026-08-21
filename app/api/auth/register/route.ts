import { NextResponse } from 'next/server';
import {
  signUpWithPassword,
  resolveAuthenticatedSupabaseUser,
  resolveOrCreatePlayerForAuthUser,
  setAuthCookies,
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
      password,
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
      redirectTo,
    } = body;

    if (!displayName || typeof displayName !== 'string' || displayName.trim().length < 2) {
      return NextResponse.json(
        { success: false, error: 'Callsign must be at least 2 characters.' },
        { status: 400 }
      );
    }

    const path: StartingPath | undefined = ['family', 'challenge', 'secret'].includes(selectedStartingPath)
      ? selectedStartingPath
      : undefined;

    const source = acquisitionSource || 'main_site';

    // 1. Password Signup Flow
    if (password) {
      if (!email || typeof email !== 'string' || !email.includes('@')) {
        return NextResponse.json(
          { success: false, error: 'Valid email address is required.' },
          { status: 400 }
        );
      }
      if (typeof password !== 'string' || password.length < 6) {
        return NextResponse.json(
          { success: false, error: 'Password must be at least 6 characters.' },
          { status: 400 }
        );
      }

      const signUpRes = await signUpWithPassword({
        displayName: displayName.trim(),
        email: email.trim(),
        password,
        selectedStartingPath: path,
        acquisitionSource: source,
        avatarUrl,
        isMinor: Boolean(isMinor),
        redirectTo,
      });

      if (!signUpRes.success) {
        return NextResponse.json(
          { success: false, error: signUpRes.error || 'Registration failed.' },
          { status: 400 }
        );
      }

      if (signUpRes.confirmationRequired) {
        return NextResponse.json({
          success: true,
          confirmationRequired: true,
          message: signUpRes.message || 'Verification link sent to your email. Check your inbox to activate your player account.',
        });
      }

      const response = NextResponse.json({
        success: true,
        player: signUpRes.player,
        session: signUpRes.session,
        message: signUpRes.message || `Welcome to Canton Quests, ${signUpRes.player?.displayName}!`,
      });

      setAuthCookies(response, signUpRes.session, signUpRes.player?.id);

      return response;
    }

    // Verify Supabase Auth Session
    const authUser = await resolveAuthenticatedSupabaseUser(request);

    if (!authUser) {
      if (isSupabaseConfigured) {
        return NextResponse.json(
          {
            success: false,
            error: 'Verified email session is required to register a player profile. Please complete email verification or sign up with a password.',
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

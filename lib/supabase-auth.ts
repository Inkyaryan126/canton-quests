// Canton Quests — Supabase Authentication & Player Identity Resolution Layer
// Canonical Model: SUPABASE AUTH USER -> players.user_id -> players.id -> gameplay mutations

import { supabase, supabaseAdmin, isSupabaseConfigured, isSupabaseAdminConfigured } from './supabase';
import { Player, StartingPath } from './types';
import * as localEngine from './game-engine';

export interface AuthSessionUser {
  id: string;
  email?: string;
  user_metadata?: Record<string, any>;
}

export interface AuthVerificationResult {
  success: boolean;
  user?: AuthSessionUser;
  session?: {
    access_token: string;
    expires_at?: number;
    refresh_token?: string;
  };
  player?: Player;
  message?: string;
  error?: string;
}

// In-memory dev/test OTP store when Supabase is not configured (e.g. unit testing / offline dev)
const mockOtpStore = new Map<string, { code: string; expiresAt: number; path?: StartingPath; source?: string }>();

/**
 * Sends a 6-digit email OTP (magic code) to the player's email using Supabase Auth.
 */
export async function sendEmailOtp(
  email: string,
  options?: {
    startingPath?: StartingPath;
    acquisitionSource?: string;
    redirectTo?: string;
  }
): Promise<{ success: boolean; message: string; error?: string }> {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return { success: false, message: 'Valid email address is required.', error: 'Invalid email address.' };
  }

  if (isSupabaseConfigured && supabase) {
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: options?.redirectTo,
          data: {
            selected_starting_path: options?.startingPath || undefined,
            acquisition_source: options?.acquisitionSource || 'main_site',
          },
        },
      });

      if (error) {
        return { success: false, message: error.message, error: error.message };
      }

      return {
        success: true,
        message: '6-digit verification code sent to your email. Check your inbox to enter Canton Quests.',
      };
    } catch (err: any) {
      return { success: false, message: err.message || 'Failed to send verification code.', error: err.message };
    }
  }

  // Development / Test runner fallback
  const mockCode = '123456';
  mockOtpStore.set(cleanEmail, {
    code: mockCode,
    expiresAt: Date.now() + 15 * 60 * 1000,
    path: options?.startingPath,
    source: options?.acquisitionSource,
  });

  return {
    success: true,
    message: `[DEV/TEST MODE] Verification code sent: ${mockCode}`,
  };
}

/**
 * Verifies the 6-digit email OTP with Supabase Auth and returns the authenticated user session.
 */
export async function verifyEmailOtp(
  email: string,
  token: string
): Promise<AuthVerificationResult> {
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanToken = (token || '').trim();

  if (!cleanEmail || !cleanToken) {
    return { success: false, error: 'Email and 6-digit verification code are required.' };
  }

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: cleanToken,
        type: 'email',
      });

      if (error || !data.user) {
        return {
          success: false,
          error: error?.message || 'Invalid or expired verification code.',
        };
      }

      const authUser: AuthSessionUser = {
        id: data.user.id,
        email: data.user.email,
        user_metadata: data.user.user_metadata,
      };

      return {
        success: true,
        user: authUser,
        session: data.session
          ? {
              access_token: data.session.access_token,
              expires_at: data.session.expires_at,
              refresh_token: data.session.refresh_token,
            }
          : undefined,
        message: 'Email ownership verified successfully.',
      };
    } catch (err: any) {
      return { success: false, error: err.message || 'OTP verification failed.' };
    }
  }

  // Dev / Test runner fallback
  const stored = mockOtpStore.get(cleanEmail);
  if (stored && (stored.code === cleanToken || cleanToken === '123456') && Date.now() <= stored.expiresAt) {
    const testUserId = `usr-${cleanEmail.replace(/[^a-z0-9]/g, '_')}`;
    const authUser: AuthSessionUser = {
      id: testUserId,
      email: cleanEmail,
      user_metadata: {
        selected_starting_path: stored.path || undefined,
        acquisition_source: stored.source || 'main_site',
      },
    };

    mockVerifiedUserStore.set(testUserId, authUser);

    return {
      success: true,
      user: authUser,
      session: {
        access_token: `mock-jwt-${testUserId}`,
        expires_at: Math.floor(Date.now() / 1000) + 3600 * 24 * 7,
      },
      message: 'Verified in test environment.',
    };
  }

  return { success: false, error: 'Invalid or expired verification code.' };
}

export const mockVerifiedUserStore = new Map<string, AuthSessionUser>();

/**
 * Registers a mock verified auth user for testing/dev environments.
 */
export function registerMockAuthUser(user: AuthSessionUser) {
  mockVerifiedUserStore.set(user.id, user);
}

/**
 * Extracts and cryptographically verifies the Supabase Auth user from a Bearer token or Request.
 */
export async function resolveAuthenticatedSupabaseUser(
  requestOrToken?: Request | string | null
): Promise<AuthSessionUser | null> {
  if (!requestOrToken) return null;

  let token = '';
  if (typeof requestOrToken === 'string') {
    token = requestOrToken.replace(/^Bearer\s+/i, '').trim();
  } else if (requestOrToken && typeof requestOrToken === 'object' && 'headers' in requestOrToken) {
    const authHeader = requestOrToken.headers.get('authorization') || '';
    token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      const cookieHeader = requestOrToken.headers.get('cookie') || '';
      const match = cookieHeader.match(/sb-access-token=([^;]+)/) || cookieHeader.match(/supabase-auth-token=([^;]+)/);
      if (match) token = match[1].trim();
    }
  }

  if (!token) return null;

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data.user) return null;
      return {
        id: data.user.id,
        email: data.user.email,
        user_metadata: data.user.user_metadata,
      };
    } catch {
      return null;
    }
  }

  // Dev / Test token parser
  if (token.startsWith('mock-jwt-') || token.startsWith('test-jwt-') || token.startsWith('usr-')) {
    const userId = token.replace(/^(mock-jwt-|test-jwt-)/, '');
    const verified = mockVerifiedUserStore.get(userId);
    if (verified) return verified;

    const allPlayers = localEngine.getAllPlayers();
    const existingPlayer = allPlayers.find((p) => p.userId === userId);
    if (existingPlayer && existingPlayer.email) {
      return {
        id: userId,
        email: existingPlayer.email,
      };
    }

    return {
      id: userId,
      email: `${userId.replace(/^usr-/, '')}@example.com`,
    };
  }

  return null;
}

/**
 * Canonical Server-Side Player Resolver.
 * Resolves the Canton Quests player linked to the verified Supabase Auth user.
 * If an unlinked legacy player exists with the same verified email, safely claims it.
 */
export async function resolveAuthenticatedPlayer(
  requestOrToken?: Request | string | null
): Promise<Player | null> {
  const authUser = await resolveAuthenticatedSupabaseUser(requestOrToken);
  if (!authUser || !authUser.id) {
    return null;
  }

  if (isSupabaseConfigured && supabase) {
    const db = supabaseAdmin || supabase;

    // 1. First resolve by exact user_id match
    const { data: playerByUserId, error: err1 } = await db
      .from('players')
      .select('*')
      .eq('user_id', authUser.id)
      .maybeSingle();

    if (!err1 && playerByUserId) {
      return {
        id: playerByUserId.id,
        userId: playerByUserId.user_id,
        displayName: playerByUserId.display_name,
        avatarUrl: playerByUserId.avatar_url || '⚡',
        role: playerByUserId.role || 'player',
        totalXp: playerByUserId.total_xp || 0,
        level: playerByUserId.level || 1,
        selectedStartingPath: (playerByUserId.selected_starting_path as StartingPath) || undefined,
        acquisitionSource: playerByUserId.acquisition_source || 'main_site',
        bio: playerByUserId.bio,
        tagline: playerByUserId.tagline,
        hometown: playerByUserId.hometown,
        themeColor: playerByUserId.theme_color,
        favoriteStyle: playerByUserId.favorite_style,
        selectedFlair: playerByUserId.selected_flair,
        showcaseBadges: playerByUserId.showcase_badges,
        isMinor: playerByUserId.is_minor,
        email: playerByUserId.email,
        createdAt: playerByUserId.created_at,
        updatedAt: playerByUserId.updated_at,
      };
    }

    // 2. Safe Legacy Account Claiming via Verified Email Ownership
    if (authUser.email) {
      const { data: legacyPlayer, error: err2 } = await db
        .from('players')
        .select('*')
        .ilike('email', authUser.email)
        .is('user_id', null)
        .maybeSingle();

      if (!err2 && legacyPlayer) {
        const { data: claimedPlayer, error: claimErr } = await db
          .from('players')
          .update({
            user_id: authUser.id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', legacyPlayer.id)
          .select()
          .single();

        if (!claimErr && claimedPlayer) {
          return {
            id: claimedPlayer.id,
            userId: claimedPlayer.user_id,
            displayName: claimedPlayer.display_name,
            avatarUrl: claimedPlayer.avatar_url || '⚡',
            role: claimedPlayer.role || 'player',
            totalXp: claimedPlayer.total_xp || 0,
            level: claimedPlayer.level || 1,
            selectedStartingPath: (claimedPlayer.selected_starting_path as StartingPath) || undefined,
            acquisitionSource: claimedPlayer.acquisition_source || 'main_site',
            bio: claimedPlayer.bio,
            tagline: claimedPlayer.tagline,
            hometown: claimedPlayer.hometown,
            themeColor: claimedPlayer.theme_color,
            favoriteStyle: claimedPlayer.favorite_style,
            selectedFlair: claimedPlayer.selected_flair,
            showcaseBadges: claimedPlayer.showcase_badges,
            isMinor: claimedPlayer.is_minor,
            email: claimedPlayer.email,
            createdAt: claimedPlayer.created_at,
            updatedAt: claimedPlayer.updated_at,
          };
        }
      }
    }

    return null;
  }

  // Dev / Test runner fallback
  const allPlayers = localEngine.getAllPlayers();
  const playerByUserId = allPlayers.find((p) => p.userId === authUser.id);
  if (playerByUserId) return playerByUserId;

  if (authUser.email) {
    const legacy = allPlayers.find(
      (p) => p.email && p.email.toLowerCase() === authUser.email!.toLowerCase() && !p.userId
    );
    if (legacy) {
      legacy.userId = authUser.id;
      return legacy;
    }
  }

  return null;
}

/**
 * Resolves the authoritative player ID for privileged gameplay endpoints.
 * Throws if unauthenticated or no player profile exists.
 */
export async function resolveAuthenticatedPlayerId(
  requestOrToken?: Request | string | null
): Promise<string> {
  const player = await resolveAuthenticatedPlayer(requestOrToken);
  if (!player || !player.id) {
    throw new Error('Authenticated player session is required.');
  }
  return player.id;
}

/**
 * Resolves or creates a player record for a verified Supabase Auth user.
 */
export async function resolveOrCreatePlayerForAuthUser(
  authUser: AuthSessionUser,
  params?: {
    displayName?: string;
    selectedStartingPath?: StartingPath;
    acquisitionSource?: string;
    avatarUrl?: string;
    isMinor?: boolean;
    bio?: string;
    tagline?: string;
    hometown?: string;
    themeColor?: string;
    favoriteStyle?: string;
    selectedFlair?: string;
  }
): Promise<Player> {
  if (!authUser || !authUser.id) {
    throw new Error('Verified Supabase user required.');
  }

  const existing = await resolveAuthenticatedPlayer(authUser.id);
  if (existing) {
    return existing;
  }

  const path: StartingPath | undefined = ['family', 'challenge', 'secret'].includes(params?.selectedStartingPath as any)
    ? (params!.selectedStartingPath as StartingPath)
    : (authUser.user_metadata?.selected_starting_path as StartingPath) || undefined;

  const source = params?.acquisitionSource || authUser.user_metadata?.acquisition_source || 'main_site';
  const cleanName = (params?.displayName || authUser.email?.split('@')[0] || 'Canton Explorer').trim();

  if (isSupabaseConfigured && supabase) {
    const db = supabaseAdmin || supabase;
    const { data: inserted, error: insertErr } = await db
      .from('players')
      .insert({
        user_id: authUser.id,
        email: authUser.email,
        display_name: cleanName,
        avatar_url: params?.avatarUrl || '⚡',
        selected_starting_path: path,
        acquisition_source: source,
        is_minor: Boolean(params?.isMinor),
        bio: params?.bio,
        tagline: params?.tagline,
        hometown: params?.hometown,
        theme_color: params?.themeColor,
        favorite_style: params?.favoriteStyle,
        selected_flair: params?.selectedFlair,
      })
      .select()
      .single();

    if (insertErr || !inserted) {
      throw new Error(`Failed to create player profile: ${insertErr?.message || 'Database error'}`);
    }

    return {
      id: inserted.id,
      userId: inserted.user_id,
      displayName: inserted.display_name,
      avatarUrl: inserted.avatar_url || '⚡',
      role: inserted.role || 'player',
      totalXp: inserted.total_xp || 0,
      level: inserted.level || 1,
      selectedStartingPath: inserted.selected_starting_path as StartingPath,
      acquisitionSource: inserted.acquisition_source,
      isMinor: inserted.is_minor,
      email: inserted.email,
      createdAt: inserted.created_at,
      updatedAt: inserted.updated_at,
    };
  }

  // Dev / Test runner fallback
  return localEngine.registerPlayer({
    displayName: cleanName,
    email: authUser.email,
    userId: authUser.id,
    selectedStartingPath: path,
    acquisitionSource: source,
    avatarUrl: params?.avatarUrl || '⚡',
    isMinor: params?.isMinor,
    bio: params?.bio,
    tagline: params?.tagline,
    hometown: params?.hometown,
    themeColor: params?.themeColor,
    favoriteStyle: params?.favoriteStyle,
    selectedFlair: params?.selectedFlair,
  });
}

/**
 * Strips private account information (email, userId) for public APIs (leaderboard, spectator feeds, etc.)
 */
export function sanitizePlayerForPublic(player: Player): Omit<Player, 'email' | 'userId'> {
  const { email, userId, ...publicPlayer } = player;
  return publicPlayer;
}

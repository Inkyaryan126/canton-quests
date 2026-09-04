import { NextResponse } from 'next/server';
import { resolveAuthenticatedSession, setAuthCookies } from '@/lib/supabase-auth';
import { isSupabaseAdminConfigured, supabaseAdmin } from '@/lib/supabase';
import { evaluateAndGrantProfileCompletionRewardDB, getPlayerByIdDB, upsertPlayerDB } from '@/lib/supabase-db';
import { CUSTOM_AVATAR_KEY, getAvatarPresetPath, PLAYER_AVATAR_PRESETS } from '@/lib/player-command-center';

export const dynamic = 'force-dynamic';

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function cleanNumber(value: FormDataEntryValue | null, fallback: number, min: number, max: number) {
  // FormData.get() returns null for an absent field, and Number(null) is 0
  // (not NaN) — so a missing field would silently pass as a valid "0"
  // instead of falling back, unless null is excluded explicitly first.
  if (value === null || value === '') return fallback;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
}

function extensionForType(type: string) {
  if (type === 'image/png') return 'png';
  if (type === 'image/webp') return 'webp';
  return 'jpg';
}

export async function POST(request: Request) {
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
      return withCookies({ success: false, error: 'Authentication required.' }, { status: 401 });
    }
    if (!isSupabaseAdminConfigured || !supabaseAdmin) {
      return withCookies(
        { success: false, error: 'Profile photo storage is not configured on this server.' },
        { status: 503 }
      );
    }

    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return withCookies({ success: false, error: 'Image file is required.' }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return withCookies({ success: false, error: 'Only JPG, PNG, or WebP images are allowed.' }, { status: 400 });
    }
    if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
      return withCookies({ success: false, error: 'Image must be 4 MB or smaller.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const path = `${player.id}/${Date.now()}.${extensionForType(file.type)}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from('player-profile-images')
      .upload(path, bytes, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false,
      });
    if (uploadError) {
      return withCookies({ success: false, error: uploadError.message }, { status: 500 });
    }

    if (player.profileImagePath) {
      await supabaseAdmin.storage.from('player-profile-images').remove([player.profileImagePath]);
    }

    const updated = await upsertPlayerDB({
      ...player,
      profileImagePath: path,
      profileImageCropZoom: cleanNumber(form.get('cropZoom'), 1, 1, 3),
      profileImageCropX: cleanNumber(form.get('cropX'), 50, 0, 100),
      profileImageCropY: cleanNumber(form.get('cropY'), 50, 0, 100),
      avatarPresetKey: CUSTOM_AVATAR_KEY,
      avatarUrl: `/api/player/${player.id}/avatar`,
      displayName: player.displayName,
    });

    const profileCompletionResult = await evaluateAndGrantProfileCompletionRewardDB(player.id);
    // Re-read the authoritative row rather than hand-computing totalXp/level
    // client-side — the grant above already persisted both.
    const finalPlayer = profileCompletionResult.newlyGranted
      ? (await getPlayerByIdDB(player.id)) || updated
      : updated;

    return withCookies({
      success: true,
      player: finalPlayer,
      profileCompletionReward: profileCompletionResult.newlyGranted,
      profileCompletionXp: profileCompletionResult.xpAwarded,
      newAchievement: profileCompletionResult.newAchievement,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to upload profile image.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const sessionResult = await resolveAuthenticatedSession(request);
    const player = sessionResult.player;
    const withCookies = (body: unknown, init?: ResponseInit) => {
      const res = NextResponse.json(body, init);
      if (sessionResult.refreshedSession) setAuthCookies(res, sessionResult.refreshedSession, player?.id);
      return res;
    };

    if (!player) {
      return withCookies({ success: false, error: 'Authentication required.' }, { status: 401 });
    }
    if (player.profileImagePath && isSupabaseAdminConfigured && supabaseAdmin) {
      await supabaseAdmin.storage.from('player-profile-images').remove([player.profileImagePath]);
    }

    // Prefer the player's most recently selected numbered preset (passed by
    // the client from in-session UI state) so removing a custom photo
    // returns them to whichever preset they last had active, not always '1'.
    const body = await request.json().catch(() => ({} as { lastNumberedPresetKey?: string }));
    const requestedFallback = body?.lastNumberedPresetKey;
    const fallbackPresetKey = PLAYER_AVATAR_PRESETS.includes(requestedFallback)
      ? requestedFallback
      : PLAYER_AVATAR_PRESETS.includes(player.avatarPresetKey as any)
        ? player.avatarPresetKey
        : '1';

    const updated = await upsertPlayerDB({
      ...player,
      profileImagePath: null,
      profileImageCropZoom: 1,
      profileImageCropX: 50,
      profileImageCropY: 50,
      displayName: player.displayName,
      avatarPresetKey: fallbackPresetKey,
      avatarUrl: getAvatarPresetPath(fallbackPresetKey),
    });

    const profileCompletionResult = await evaluateAndGrantProfileCompletionRewardDB(player.id);
    // Re-read the authoritative row rather than hand-computing totalXp/level
    // client-side — the grant above already persisted both.
    const finalPlayer = profileCompletionResult.newlyGranted
      ? (await getPlayerByIdDB(player.id)) || updated
      : updated;

    return withCookies({
      success: true,
      player: finalPlayer,
      profileCompletionReward: profileCompletionResult.newlyGranted,
      profileCompletionXp: profileCompletionResult.xpAwarded,
      newAchievement: profileCompletionResult.newAchievement,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to remove profile image.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

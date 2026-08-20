import { NextResponse } from 'next/server';
import { resolveAuthenticatedPlayer } from '@/lib/supabase-auth';
import { isSupabaseAdminConfigured, supabaseAdmin } from '@/lib/supabase';
import { upsertPlayerDB } from '@/lib/supabase-db';

export const dynamic = 'force-dynamic';

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function cleanNumber(value: FormDataEntryValue | null, fallback: number, min: number, max: number) {
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
    const player = await resolveAuthenticatedPlayer(request);
    if (!player) {
      return NextResponse.json({ success: false, error: 'Authentication required.' }, { status: 401 });
    }
    if (!isSupabaseAdminConfigured || !supabaseAdmin) {
      return NextResponse.json(
        { success: false, error: 'Profile photo storage is not configured on this server.' },
        { status: 503 }
      );
    }

    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: 'Image file is required.' }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ success: false, error: 'Only JPG, PNG, or WebP images are allowed.' }, { status: 400 });
    }
    if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ success: false, error: 'Image must be 4 MB or smaller.' }, { status: 400 });
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
      return NextResponse.json({ success: false, error: uploadError.message }, { status: 500 });
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
      avatarUrl: player.avatarUrl || '⚡',
      displayName: player.displayName,
    });

    return NextResponse.json({ success: true, player: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to upload profile image.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const player = await resolveAuthenticatedPlayer(request);
    if (!player) {
      return NextResponse.json({ success: false, error: 'Authentication required.' }, { status: 401 });
    }
    if (player.profileImagePath && isSupabaseAdminConfigured && supabaseAdmin) {
      await supabaseAdmin.storage.from('player-profile-images').remove([player.profileImagePath]);
    }
    const updated = await upsertPlayerDB({
      ...player,
      profileImagePath: undefined,
      displayName: player.displayName,
      avatarUrl: player.avatarUrl || '⚡',
    });
    return NextResponse.json({ success: true, player: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to remove profile image.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

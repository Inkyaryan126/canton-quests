import { NextResponse } from 'next/server';
import { getPlayerByIdDB } from '@/lib/supabase-db';
import { resolveAuthenticatedPlayer } from '@/lib/supabase-auth';
import { isSupabaseAdminConfigured, supabaseAdmin } from '@/lib/supabase';
import { shouldExposePlayerImage } from '@/lib/player-command-center';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const player = await getPlayerByIdDB(params.id);
  if (!player || !player.profileImagePath) {
    return NextResponse.json({ success: false, error: 'No player image found.' }, { status: 404 });
  }

  const viewer = await resolveAuthenticatedPlayer(request).catch(() => null);
  const isOwner = Boolean(viewer && viewer.id === player.id);
  if (!shouldExposePlayerImage(player, isOwner)) {
    return NextResponse.json({ success: false, error: 'This player image is private.' }, { status: 403 });
  }

  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return NextResponse.json({ success: false, error: 'Image storage is not configured on this server.' }, { status: 503 });
  }

  const { data, error } = await supabaseAdmin.storage
    .from('player-profile-images')
    .createSignedUrl(player.profileImagePath, 300);
  if (error || !data?.signedUrl) {
    return NextResponse.json({ success: false, error: 'Unable to resolve player image.' }, { status: 500 });
  }

  return NextResponse.redirect(data.signedUrl, { status: 302 });
}

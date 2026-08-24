import { NextResponse } from 'next/server';
import { getPlayerByIdDB } from '@/lib/supabase-db';
import { isSupabaseAdminConfigured, supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Player avatars are always public — any player with a custom uploaded
// photo is servable to any viewer. The storage bucket itself stays
// private; this route is the only way to reach the image, minting a
// fresh short-lived signed URL per request rather than persisting one.
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const player = await getPlayerByIdDB(params.id);
  if (!player || !player.profileImagePath) {
    return NextResponse.json({ success: false, error: 'No player image found.' }, { status: 404 });
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

import { NextResponse } from 'next/server';
import { resolveAdminSessionFromRequest } from '@/lib/admin-auth';
import { cantonFoundingSeasonPackage } from '@/lib/grid/cities/canton/founding-season';
import { isGridChatEnabled } from '@/lib/grid/server/chat-feature-flags';
import { createSupabaseGridChatModeration } from '@/lib/grid/server/chat-moderation';
import { resolveSupabaseGridChatSeasonId } from '@/lib/grid/server/supabase-chat';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const admin = resolveAdminSessionFromRequest(request);
  if (!admin.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isGridChatEnabled()) {
    return NextResponse.json({ error: 'Grid chat is not enabled.' }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const message = typeof body.body === 'string' ? body.body : '';
  const clientNonce = typeof body.clientNonce === 'string' ? body.clientNonce : '';

  try {
    const seasonId = await resolveSupabaseGridChatSeasonId(cantonFoundingSeasonPackage);
    if (!seasonId) return NextResponse.json({ error: 'Grid season is not available.' }, { status: 404 });
    const result = await createSupabaseGridChatModeration().broadcastCity({
      seasonId,
      body: message,
      clientNonce,
      now: new Date().toISOString(),
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const messageText = error instanceof Error ? error.message : 'Commander broadcast failed.';
    if (messageText.startsWith('Chat message') || messageText.startsWith('Missing chat') || messageText.includes('nonce')) {
      return NextResponse.json({ error: messageText }, { status: 400 });
    }
    console.error('[Grid Commander broadcast]', error);
    return NextResponse.json({ error: 'Commander broadcast failed.' }, { status: 500 });
  }
}

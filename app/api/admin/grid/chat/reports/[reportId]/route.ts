import { NextResponse } from 'next/server';
import { resolveAdminSessionFromRequest } from '@/lib/admin-auth';
import { createSupabaseGridChatModeration, type GridChatModerationAction } from '@/lib/grid/server/chat-moderation';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: { reportId: string } }) {
  const admin = resolveAdminSessionFromRequest(request);
  if (!admin.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const action = typeof body.action === 'string' ? body.action : '';
  if (!['hide', 'remove', 'restore', 'dismiss'].includes(action)) {
    return NextResponse.json({ error: 'Invalid moderation action.' }, { status: 400 });
  }
  try {
    const result = await createSupabaseGridChatModeration().moderate(
      params.reportId,
      action as GridChatModerationAction,
      admin.adminName,
      new Date().toISOString(),
    );
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('[Grid chat moderation action]', error);
    return NextResponse.json({ error: 'Failed to moderate Grid chat report.' }, { status: 500 });
  }
}

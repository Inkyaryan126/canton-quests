import { createSupabaseGridChatPort } from '@/lib/grid/server/supabase-chat';
import { gridChatError, gridChatJson, requireGridChatContext } from '@/lib/grid/server/chat-http';

export const dynamic = 'force-dynamic';

export async function PUT(request: Request) {
  const context = await requireGridChatContext(request);
  if ('response' in context) return context.response;
  const body = await request.json().catch(() => ({}));
  const blockedPlayerId = typeof body.playerId === 'string' ? body.playerId : '';
  const blocked = body.blocked !== false;
  if (!blockedPlayerId) {
    return gridChatJson(context.session, { success: false, error: 'Missing player.' }, { status: 400 });
  }

  try {
    await createSupabaseGridChatPort().setBlock(
      context.playerId,
      blockedPlayerId,
      blocked,
      new Date().toISOString(),
    );
    return gridChatJson(context.session, { success: true, playerId: blockedPlayerId, blocked });
  } catch (error) {
    const mapped = gridChatError(error);
    return gridChatJson(context.session, { success: false, error: mapped.message }, { status: mapped.status });
  }
}

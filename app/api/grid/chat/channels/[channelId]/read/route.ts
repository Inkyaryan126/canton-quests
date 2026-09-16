import { createSupabaseGridChatPort } from '@/lib/grid/server/supabase-chat';
import { gridChatError, gridChatJson, requireGridChatContext } from '@/lib/grid/server/chat-http';

export const dynamic = 'force-dynamic';

export async function PUT(request: Request, { params }: { params: { channelId: string } }) {
  const context = await requireGridChatContext(request);
  if ('response' in context) return context.response;
  const readAt = new Date().toISOString();
  try {
    await createSupabaseGridChatPort().markRead(params.channelId, context.playerId, readAt);
    return gridChatJson(context.session, { success: true, readAt });
  } catch (error) {
    const mapped = gridChatError(error);
    return gridChatJson(context.session, { success: false, error: mapped.message }, { status: mapped.status });
  }
}

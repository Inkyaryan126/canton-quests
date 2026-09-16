import { createSupabaseGridChatPort } from '@/lib/grid/server/supabase-chat';
import { gridChatError, gridChatJson, requireGridChatContext } from '@/lib/grid/server/chat-http';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: { channelId: string } }) {
  const context = await requireGridChatContext(request);
  if ('response' in context) return context.response;
  try {
    await createSupabaseGridChatPort().joinRoom(params.channelId, context.playerId, new Date().toISOString());
    return gridChatJson(context.session, { success: true, channelId: params.channelId, joined: true });
  } catch (error) {
    const mapped = gridChatError(error);
    return gridChatJson(context.session, { success: false, error: mapped.message }, { status: mapped.status });
  }
}

import { createSupabaseGridChatPort } from '@/lib/grid/server/supabase-chat';
import { gridChatError, gridChatJson, requireGridChatContext } from '@/lib/grid/server/chat-http';

export const dynamic = 'force-dynamic';

export async function PUT(request: Request, { params }: { params: { channelId: string } }) {
  const context = await requireGridChatContext(request);
  if ('response' in context) return context.response;
  const body = await request.json().catch(() => ({}));
  if (typeof body.enabled !== 'boolean') {
    return gridChatJson(context.session, { success: false, error: 'Missing notification preference.' }, { status: 400 });
  }

  try {
    await createSupabaseGridChatPort().setNotifications(params.channelId, context.playerId, body.enabled);
    return gridChatJson(context.session, { success: true, notificationsEnabled: body.enabled });
  } catch (error) {
    const mapped = gridChatError(error);
    return gridChatJson(context.session, { success: false, error: mapped.message }, { status: mapped.status });
  }
}

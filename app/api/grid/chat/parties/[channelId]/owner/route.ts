import { createSupabaseGridChatPort } from '@/lib/grid/server/supabase-chat';
import { gridChatError, gridChatJson, requireGridChatContext } from '@/lib/grid/server/chat-http';

export const dynamic = 'force-dynamic';

export async function PUT(request: Request, { params }: { params: { channelId: string } }) {
  const context = await requireGridChatContext(request);
  if ('response' in context) return context.response;
  const body = await request.json().catch(() => ({}));
  const targetPlayerId = typeof body.playerId === 'string' ? body.playerId : '';
  if (!targetPlayerId) return gridChatJson(context.session, { success: false, error: 'Missing party member.' }, { status: 400 });
  try {
    await createSupabaseGridChatPort().transferPartyOwner(params.channelId, context.playerId, targetPlayerId, new Date().toISOString());
    return gridChatJson(context.session, { success: true, ownerPlayerId: targetPlayerId });
  } catch (error) {
    const mapped = gridChatError(error);
    return gridChatJson(context.session, { success: false, error: mapped.message }, { status: mapped.status });
  }
}

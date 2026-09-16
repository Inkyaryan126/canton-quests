import { createSupabaseGridChatPort } from '@/lib/grid/server/supabase-chat';
import { gridChatError, gridChatJson, requireGridChatContext } from '@/lib/grid/server/chat-http';

export const dynamic = 'force-dynamic';

export async function PUT(request: Request, { params }: { params: { channelId: string; playerId: string } }) {
  const context = await requireGridChatContext(request);
  if ('response' in context) return context.response;
  const body = await request.json().catch(() => ({}));
  const role = body.role === 'moderator' ? 'moderator' : body.role === 'member' ? 'member' : null;
  if (!role) return gridChatJson(context.session, { success: false, error: 'Invalid party role.' }, { status: 400 });
  try {
    await createSupabaseGridChatPort().setPartyMemberRole(params.channelId, context.playerId, params.playerId, role, new Date().toISOString());
    return gridChatJson(context.session, { success: true, playerId: params.playerId, role });
  } catch (error) {
    const mapped = gridChatError(error);
    return gridChatJson(context.session, { success: false, error: mapped.message }, { status: mapped.status });
  }
}

export async function DELETE(request: Request, { params }: { params: { channelId: string; playerId: string } }) {
  const context = await requireGridChatContext(request);
  if ('response' in context) return context.response;
  try {
    await createSupabaseGridChatPort().removePartyMember(params.channelId, context.playerId, params.playerId, new Date().toISOString());
    return gridChatJson(context.session, { success: true, playerId: params.playerId, removed: true });
  } catch (error) {
    const mapped = gridChatError(error);
    return gridChatJson(context.session, { success: false, error: mapped.message }, { status: mapped.status });
  }
}

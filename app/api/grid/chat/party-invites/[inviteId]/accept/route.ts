import { acceptGridPartyInvite } from '@/lib/grid/server/chat-service';
import { createSupabaseGridChatPort } from '@/lib/grid/server/supabase-chat';
import {
  gridChatError,
  gridChatJson,
  requireGridChatContext,
} from '@/lib/grid/server/chat-http';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: { inviteId: string } },
) {
  const context = await requireGridChatContext(request);
  if ('response' in context) return context.response;

  try {
    const result = await acceptGridPartyInvite(
      createSupabaseGridChatPort(),
      params.inviteId,
      context.playerId,
      new Date().toISOString(),
    );
    return gridChatJson(context.session, {
      success: true,
      channelId: result.channelId,
    });
  } catch (error) {
    const mapped = gridChatError(error);
    return gridChatJson(
      context.session,
      { success: false, error: mapped.message },
      { status: mapped.status },
    );
  }
}

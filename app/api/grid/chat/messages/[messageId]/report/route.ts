import { reportGridChatMessage } from '@/lib/grid/server/chat-service';
import { createSupabaseGridChatPort } from '@/lib/grid/server/supabase-chat';
import { gridChatError, gridChatJson, requireGridChatContext } from '@/lib/grid/server/chat-http';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: { messageId: string } }) {
  const context = await requireGridChatContext(request);
  if ('response' in context) return context.response;
  const body = await request.json().catch(() => ({}));

  try {
    const result = await reportGridChatMessage(createSupabaseGridChatPort(), {
      messageId: params.messageId,
      reporterPlayerId: context.playerId,
      reason: typeof body.reason === 'string' ? body.reason : '',
      details: typeof body.details === 'string' ? body.details : null,
      now: new Date().toISOString(),
    });
    return gridChatJson(context.session, { success: true, ...result });
  } catch (error) {
    const mapped = gridChatError(error);
    return gridChatJson(context.session, { success: false, error: mapped.message }, { status: mapped.status });
  }
}

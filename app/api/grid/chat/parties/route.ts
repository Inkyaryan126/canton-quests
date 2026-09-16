import { createGridPartyChat } from '@/lib/grid/server/chat-service';
import { createSupabaseGridChatPort } from '@/lib/grid/server/supabase-chat';
import { gridChatError, gridChatJson, requireGridChatContext } from '@/lib/grid/server/chat-http';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const context = await requireGridChatContext(request);
  if ('response' in context) return context.response;
  const body = await request.json().catch(() => ({}));
  try {
    const result = await createGridPartyChat(createSupabaseGridChatPort(), {
      seasonId: context.seasonId,
      ownerPlayerId: context.playerId,
      displayName: typeof body.name === 'string' ? body.name : '',
      now: new Date().toISOString(),
    });
    return gridChatJson(context.session, { success: true, ...result });
  } catch (error) {
    const mapped = gridChatError(error);
    return gridChatJson(context.session, { success: false, error: mapped.message }, { status: mapped.status });
  }
}

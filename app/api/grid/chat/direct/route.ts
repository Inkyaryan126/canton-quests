import { startGridDirectChat } from '@/lib/grid/server/chat-service';
import { createSupabaseGridChatPort } from '@/lib/grid/server/supabase-chat';
import { gridChatError, gridChatJson, requireGridChatContext } from '@/lib/grid/server/chat-http';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const context = await requireGridChatContext(request);
  if ('response' in context) return context.response;
  const body = await request.json().catch(() => ({}));
  const callsign = typeof body.callsign === 'string' ? body.callsign : '';

  try {
    const result = await startGridDirectChat(createSupabaseGridChatPort(), {
      seasonId: context.seasonId,
      playerId: context.playerId,
      callsign,
      now: new Date().toISOString(),
    });
    return gridChatJson(context.session, { success: true, ...result });
  } catch (error) {
    const mapped = gridChatError(error);
    return gridChatJson(context.session, { success: false, error: mapped.message }, { status: mapped.status });
  }
}

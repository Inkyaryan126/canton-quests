import { openGridChat } from '@/lib/grid/server/chat-service';
import { createSupabaseGridChatPort } from '@/lib/grid/server/supabase-chat';
import { isGridChatEnabled } from '@/lib/grid/server/chat-feature-flags';
import { gridChatError, gridChatJson, requireGridChatContext } from '@/lib/grid/server/chat-http';
import { resolveAuthenticatedSession } from '@/lib/supabase-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!isGridChatEnabled()) {
    const session = await resolveAuthenticatedSession(request);
    return gridChatJson(session, { success: true, enabled: false, channels: [] });
  }
  const context = await requireGridChatContext(request);
  if ('response' in context) return context.response;

  try {
    const channels = await openGridChat(
      createSupabaseGridChatPort(),
      context.seasonId,
      context.playerId,
      new Date().toISOString(),
    );
    return gridChatJson(context.session, { success: true, enabled: true, channels });
  } catch (error) {
    const mapped = gridChatError(error);
    return gridChatJson(context.session, { success: false, error: mapped.message }, { status: mapped.status });
  }
}

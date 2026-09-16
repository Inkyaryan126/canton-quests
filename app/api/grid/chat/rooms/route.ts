import { createGridChatRoom } from '@/lib/grid/server/chat-service';
import { createSupabaseGridChatPort } from '@/lib/grid/server/supabase-chat';
import { gridChatError, gridChatJson, requireGridChatContext } from '@/lib/grid/server/chat-http';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const context = await requireGridChatContext(request);
  if ('response' in context) return context.response;
  try {
    const rooms = await createSupabaseGridChatPort().listRooms(context.seasonId, context.playerId);
    return gridChatJson(context.session, { success: true, rooms });
  } catch (error) {
    const mapped = gridChatError(error);
    return gridChatJson(context.session, { success: false, error: mapped.message }, { status: mapped.status });
  }
}

export async function POST(request: Request) {
  const context = await requireGridChatContext(request);
  if ('response' in context) return context.response;
  const body = await request.json().catch(() => ({}));
  try {
    const result = await createGridChatRoom(createSupabaseGridChatPort(), {
      seasonId: context.seasonId,
      ownerPlayerId: context.playerId,
      displayName: typeof body.name === 'string' ? body.name : '',
      topic: typeof body.topic === 'string' ? body.topic : '',
      memberLimit: typeof body.memberLimit === 'number' ? body.memberLimit : 50,
      now: new Date().toISOString(),
    });
    return gridChatJson(context.session, { success: true, ...result });
  } catch (error) {
    const mapped = gridChatError(error);
    return gridChatJson(context.session, { success: false, error: mapped.message }, { status: mapped.status });
  }
}

import { inviteGridPartyMember } from '@/lib/grid/server/chat-service';
import { createSupabaseGridChatPort } from '@/lib/grid/server/supabase-chat';
import { gridChatError, gridChatJson, requireGridChatContext } from '@/lib/grid/server/chat-http';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: { channelId: string } }) {
  const context = await requireGridChatContext(request);
  if ('response' in context) return context.response;
  try {
    const members = await createSupabaseGridChatPort().listPartyMembers(params.channelId, context.playerId);
    return gridChatJson(context.session, { success: true, members });
  } catch (error) {
    const mapped = gridChatError(error);
    return gridChatJson(context.session, { success: false, error: mapped.message }, { status: mapped.status });
  }
}

export async function POST(request: Request, { params }: { params: { channelId: string } }) {
  const context = await requireGridChatContext(request);
  if ('response' in context) return context.response;
  const body = await request.json().catch(() => ({}));
  try {
    const result = await inviteGridPartyMember(createSupabaseGridChatPort(), {
      channelId: params.channelId,
      actorPlayerId: context.playerId,
      callsign: typeof body.callsign === 'string' ? body.callsign : '',
      now: new Date().toISOString(),
    });
    return gridChatJson(context.session, {
      success: true,
      target: result.target,
      invite: result.invite,
    });
  } catch (error) {
    const mapped = gridChatError(error);
    return gridChatJson(context.session, { success: false, error: mapped.message }, { status: mapped.status });
  }
}

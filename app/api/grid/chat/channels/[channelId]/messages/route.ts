import { sendGridChatMessage } from '@/lib/grid/server/chat-service';
import { createSupabaseGridChatPort } from '@/lib/grid/server/supabase-chat';
import { gridChatError, gridChatJson, requireGridChatContext } from '@/lib/grid/server/chat-http';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: { channelId: string } }) {
  const context = await requireGridChatContext(request);
  if ('response' in context) return context.response;
  const url = new URL(request.url);
  const parsedLimit = Number(url.searchParams.get('limit') ?? 60);
  const limit = Number.isFinite(parsedLimit) ? parsedLimit : 60;
  const before = url.searchParams.get('before');

  try {
    const page = await createSupabaseGridChatPort().listMessages({
      channelId: params.channelId,
      playerId: context.playerId,
      limit,
      before,
    });
    return gridChatJson(context.session, { success: true, ...page });
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
    const result = await sendGridChatMessage(createSupabaseGridChatPort(), {
      channelId: params.channelId,
      senderPlayerId: context.playerId,
      body: typeof body.body === 'string' ? body.body : '',
      clientNonce: typeof body.clientNonce === 'string' ? body.clientNonce : '',
      replyToMessageId: typeof body.replyToMessageId === 'string' ? body.replyToMessageId : null,
      now: new Date().toISOString(),
    });
    return gridChatJson(context.session, { success: true, ...result });
  } catch (error) {
    const mapped = gridChatError(error);
    return gridChatJson(context.session, { success: false, error: mapped.message }, { status: mapped.status });
  }
}

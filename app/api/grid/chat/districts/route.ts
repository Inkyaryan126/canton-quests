import { createSupabaseGridChatPort } from '@/lib/grid/server/supabase-chat';
import { gridChatError, gridChatJson, requireGridChatContext } from '@/lib/grid/server/chat-http';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const context = await requireGridChatContext(request);
  if ('response' in context) return context.response;
  try {
    const districts = await createSupabaseGridChatPort().listDistricts(context.seasonId, context.playerId);
    return gridChatJson(context.session, { success: true, districts });
  } catch (error) {
    const mapped = gridChatError(error);
    return gridChatJson(context.session, { success: false, error: mapped.message }, { status: mapped.status });
  }
}

export async function POST(request: Request) {
  const context = await requireGridChatContext(request);
  if ('response' in context) return context.response;
  const body = await request.json().catch(() => ({}));
  const districtId = typeof body.districtId === 'string' ? body.districtId : '';
  if (!districtId) return gridChatJson(context.session, { success: false, error: 'Missing district.' }, { status: 400 });
  try {
    const result = await createSupabaseGridChatPort().joinDistrict(
      context.seasonId,
      context.playerId,
      districtId,
      new Date().toISOString(),
    );
    return gridChatJson(context.session, { success: true, ...result });
  } catch (error) {
    const mapped = gridChatError(error);
    return gridChatJson(context.session, { success: false, error: mapped.message }, { status: mapped.status });
  }
}

import { NextResponse } from 'next/server';
import { resolveAdminSessionFromRequest } from '@/lib/admin-auth';
import { createSupabaseGridChatModeration } from '@/lib/grid/server/chat-moderation';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const admin = resolveAdminSessionFromRequest(request);
  if (!admin.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const url = new URL(request.url);
  const status = url.searchParams.get('status') ?? 'pending';
  const limit = Number(url.searchParams.get('limit') ?? 100);
  try {
    const reports = await createSupabaseGridChatModeration().listReports(
      status,
      Number.isFinite(limit) ? limit : 100,
    );
    return NextResponse.json({ success: true, reports });
  } catch (error) {
    console.error('[Grid chat moderation reports]', error);
    return NextResponse.json({ error: 'Failed to load Grid chat reports.' }, { status: 500 });
  }
}

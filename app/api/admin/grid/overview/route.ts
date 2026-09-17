import { NextResponse } from 'next/server';
import { resolveAdminSessionFromRequest } from '@/lib/admin-auth';
import { readGridAdminOverview } from '@/lib/grid/server/grid-admin-overview';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!resolveAdminSessionFromRequest(request).isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const search = new URL(request.url).searchParams.get('q') || '';
  if (search.length > 80) return NextResponse.json({ error: 'Search query is too long' }, { status: 400 });
  try {
    return NextResponse.json({ overview: await readGridAdminOverview(undefined, search) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Grid admin read failed' }, { status: 500 });
  }
}

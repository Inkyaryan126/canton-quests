import { NextResponse } from 'next/server';
import { resolveAdminSessionFromRequest } from '@/lib/admin-auth';
import { collectGridBuilderOsSnapshot } from '@/lib/grid/ops/grid-builder-os';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const session = resolveAdminSessionFromRequest(request);
  if (!session.isAdmin) {
    return NextResponse.json({ error: 'Admin authorization required.' }, { status: 401 });
  }

  try {
    const hostname = new URL(request.url).hostname;
    const snapshot = collectGridBuilderOsSnapshot({
      cwd: process.cwd(),
      hostname,
      nodeEnv: process.env.NODE_ENV,
    });
    return NextResponse.json({ snapshot }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to read Builder OS status.' },
      { status: 500 },
    );
  }
}


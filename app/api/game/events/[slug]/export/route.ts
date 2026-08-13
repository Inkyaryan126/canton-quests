import { NextResponse } from 'next/server';
import { exportEventJSON, getEventBySlug } from '@/lib/game-engine';
import { authorizeGameMasterRequest } from '@/lib/admin-auth';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const adminSession = authorizeGameMasterRequest({
      authorization: request.headers.get('authorization') || undefined,
      'x-admin-key': request.headers.get('x-admin-key') || undefined,
    });
    if (!adminSession.isAdmin) {
      return NextResponse.json({ error: 'Game Master authorization required.' }, { status: 401 });
    }

    const resolvedParams = await params;
    const slug = resolvedParams.slug;
    const event = getEventBySlug(slug);

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const jsonStr = exportEventJSON(event.id);
    return new NextResponse(jsonStr, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${slug}-export.json"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Export failed' }, { status: 500 });
  }
}

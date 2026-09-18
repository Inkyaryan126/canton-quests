import { NextResponse } from 'next/server';
import { cantonFoundingSeasonPackage } from '@/lib/grid/cities/canton/founding-season';
import { isGridWorldReadEnabled } from '@/lib/grid/server/feature-flags';
import { createSupabaseGridWorldRevisionPort } from '@/lib/grid/server/supabase-world-revision';
import { readGridWorldRevision } from '@/lib/grid/server/world-revision-service';
import {
  resolveAuthenticatedSession,
  setAuthCookies,
} from '@/lib/supabase-auth';

export const dynamic = 'force-dynamic';

function revisionHeaders(revision: string | null, pollMs: number): HeadersInit {
  const headers: Record<string, string> = {
    'cache-control': 'private, no-cache, max-age=0',
    'x-grid-poll-after-ms': String(pollMs),
  };
  if (revision) headers.etag = `"${revision}"`;
  return headers;
}

export async function GET(request: Request) {
  const session = await resolveAuthenticatedSession(request);
  const respond = (body: unknown, init?: ResponseInit) => {
    const response = NextResponse.json(body, init);
    setAuthCookies(response, session.refreshedSession, session.player?.id);
    return response;
  };

  if (!isGridWorldReadEnabled()) {
    return respond(
      { success: false, error: 'Grid runtime is not enabled.' },
      { status: 404 },
    );
  }

  if (!session.player) {
    return respond(
      { success: false, error: 'Authentication required.' },
      { status: 401 },
    );
  }

  try {
    const signal = await readGridWorldRevision(
      createSupabaseGridWorldRevisionPort(),
      cantonFoundingSeasonPackage.city.slug,
      cantonFoundingSeasonPackage.seasonTemplate.slug,
    );
    const headers = revisionHeaders(signal.revision, signal.recommendedPollMs);
    const incomingEtag = request.headers.get('if-none-match');
    const currentEtag = signal.revision ? `"${signal.revision}"` : null;

    if (currentEtag && incomingEtag === currentEtag) {
      const response = new NextResponse(null, { status: 304, headers });
      setAuthCookies(response, session.refreshedSession, session.player.id);
      return response;
    }

    return respond({ success: true, signal }, { headers });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to read Grid world revision.';
    return respond({ success: false, error: message }, { status: 500 });
  }
}

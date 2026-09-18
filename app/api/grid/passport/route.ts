import { NextResponse } from 'next/server';
import { isGridFoundationEnabled } from '@/lib/grid/server/feature-flags';
import { readGridPassport } from '@/lib/grid/server/passport-read-service';
import { createSupabaseGridPassportReadPort } from '@/lib/grid/server/supabase-passport-read';
import { resolveAuthenticatedSession, setAuthCookies } from '@/lib/supabase-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await resolveAuthenticatedSession(request);
  const respond = (body: unknown, init?: ResponseInit) => {
    const response = NextResponse.json(body, init);
    response.headers.set('cache-control', 'private, no-store, max-age=0');
    response.headers.set('vary', 'Cookie');
    setAuthCookies(response, session.refreshedSession, session.player?.id);
    return response;
  };

  if (!isGridFoundationEnabled()) {
    return respond({ success: false, error: 'Grid Passport is not enabled.' }, { status: 404 });
  }
  if (!session.player) {
    return respond({ success: false, error: 'Authentication required.' }, { status: 401 });
  }

  try {
    const passport = await readGridPassport(
      createSupabaseGridPassportReadPort(),
      session.player.id,
    );
    return respond({ success: true, passport });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to read Grid Passport.';
    return respond({ success: false, error: message }, { status: 500 });
  }
}

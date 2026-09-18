import { NextResponse } from 'next/server';
import { isGridWorldReadEnabled } from '@/lib/grid/server/feature-flags';
import { readGridPassport } from '@/lib/grid/server/passport-read-service';
import { createSupabaseGridPassportReadPort } from '@/lib/grid/server/supabase-passport-read';
import {
  resolveAuthenticatedSession,
  setAuthCookies,
} from '@/lib/supabase-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await resolveAuthenticatedSession(request);
  const response = (body: unknown, init?: ResponseInit) => {
    const result = NextResponse.json(body, init);
    result.headers.set('Cache-Control', 'no-store, max-age=0');
    setAuthCookies(result, session.refreshedSession, session.player?.id);
    return result;
  };

  if (!isGridWorldReadEnabled()) {
    return response(
      { success: false, error: 'Grid runtime is not enabled.' },
      { status: 404 },
    );
  }

  if (!session.player) {
    return response(
      { success: false, error: 'Authentication required.' },
      { status: 401 },
    );
  }

  try {
    const result = await readGridPassport(
      createSupabaseGridPassportReadPort(),
      session.player.id,
    );

    return response({ success: true, ...result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to read Grid Passport.';
    return response({ success: false, error: message }, { status: 500 });
  }
}

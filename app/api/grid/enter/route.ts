import { NextResponse } from 'next/server';
import { extractAuthTokens, resolveAuthenticatedSession, setAuthCookies } from '@/lib/supabase-auth';

export const dynamic = 'force-dynamic';

/**
 * Trusted same-site handoff to the separately deployed Grid application.
 * Refreshes the existing Canton Quests session if necessary, sets the
 * Secure HttpOnly parent-domain cookies, then navigates normally.
 * Credentials are never placed in a URL, form, or response body.
 */
export async function GET(request: Request) {
  const response = NextResponse.redirect('https://grid.cantonquests.com/grid', 303);
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('Vary', 'Cookie');

  const session = await resolveAuthenticatedSession(request);
  if (session.user && session.player) {
    const received = extractAuthTokens(request);
    const credentials = session.refreshedSession ?? {
      access_token: received.accessToken,
      refresh_token: received.refreshToken,
    };
    if (credentials.access_token && credentials.refresh_token) {
      setAuthCookies(response, credentials, session.player.id);
    }
  }
  return response;
}

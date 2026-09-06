import { NextResponse } from 'next/server';
import * as supabaseModule from '@/lib/supabase';
import { resolveAuthenticatedSession } from '@/lib/supabase-auth';
import { CAMPAIGN_ATTRIBUTION_COOKIE, classifyUserAgent } from '@/lib/qr-campaigns';
import {
  VISITOR_ID_COOKIE,
  SESSION_ID_COOKIE,
  VISITOR_ID_MAX_AGE_SECONDS,
  SESSION_ID_MAX_AGE_SECONDS,
  resolveVisitorId,
  resolveSessionId,
  readCookie,
  isTrackablePath,
  buildSiteVisitEventRow,
} from '@/lib/site-analytics';

// In-memory dedup for site_visit_events: only guards
// against a literal double-fire (e.g. a stray duplicate network send) within
// the same tick. It must NOT suppress a genuine revisit of the same page a
// few seconds later, so the window is short — the real "don't double-count
// on remount" fix lives client-side in components/VisitorTracker.tsx, which
// only fires once per pathname change.
const recentSiteVisitEvents = new Map<string, number>();
const SITE_VISIT_EVENT_DEDUPE_WINDOW_MS = 3_000;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const pagePath: string = (body.page || '/').substring(0, 200);
    const referrer: string = (body.referrer || '').substring(0, 500);
    const search: string = typeof body.search === 'string' ? body.search.substring(0, 500) : '';

    const ua = request.headers.get('user-agent') || '';
    const cookieHeader = request.headers.get('cookie') || '';

    // ---- Visitor/session identity (cq_vid / cq_sid) — established
    // regardless of whether Supabase is configured, so identity is stable
    // from the very first hit. ----
    const existingVisitorId = readCookie(cookieHeader, VISITOR_ID_COOKIE);
    const existingSessionId = readCookie(cookieHeader, SESSION_ID_COOKIE);
    const visitor = resolveVisitorId(existingVisitorId);
    const session = resolveSessionId(existingSessionId);

    const response = NextResponse.json({ ok: true });
    response.cookies.set({
      name: VISITOR_ID_COOKIE,
      value: visitor.id,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: VISITOR_ID_MAX_AGE_SECONDS,
    });
    response.cookies.set({
      name: SESSION_ID_COOKIE,
      value: session.id,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: SESSION_ID_MAX_AGE_SECONDS, // renewed on every hit — inactivity beyond this naturally expires the session
    });

    if (!supabaseModule.supabaseAdmin) {
      return response;
    }

    // ---- site_visit_events insert — the production analytics pipeline ----
    if (isTrackablePath(pagePath)) {
      const dedupeKey = `${visitor.id}:${session.id}:${pagePath}`;
      const now = Date.now();
      const lastSeen = recentSiteVisitEvents.get(dedupeKey);
      if (!lastSeen || now - lastSeen >= SITE_VISIT_EVENT_DEDUPE_WINDOW_MS) {
        recentSiteVisitEvents.set(dedupeKey, now);
        if (recentSiteVisitEvents.size > 1000) {
          const cutoff = now - SITE_VISIT_EVENT_DEDUPE_WINDOW_MS;
          for (const [k, v] of recentSiteVisitEvents.entries()) {
            if (v < cutoff) recentSiteVisitEvents.delete(k);
          }
        }

        // allowRefresh: false — this endpoint fires on nearly every page load
        // (components/VisitorTracker.tsx) via sendBeacon/fetch-and-ignore, so
        // it routinely runs concurrently with a real, response-reading
        // session call on the same page (e.g. /api/auth/me on the QR landing
        // page). Supabase refresh tokens are single-use: if both requests
        // raced to refresh the same stale token, the loser would wrongly
        // report the user logged out. Attribution here is best-effort only —
        // when the access token has expired, just skip player attribution
        // for this pageview rather than contending for the refresh.
        let playerId: string | null = null;
        try {
          const sessionResult = await resolveAuthenticatedSession(request, { allowRefresh: false });
          playerId = sessionResult.player?.id || null;
        } catch {
          playerId = null;
        }

        const row = buildSiteVisitEventRow({
          visitorId: visitor.id,
          sessionId: session.id,
          playerId,
          path: pagePath,
          referrer,
          userAgent: ua,
          userAgentClass: classifyUserAgent(ua),
          search,
          campaignAttributionCookieValue: readCookie(cookieHeader, CAMPAIGN_ATTRIBUTION_COOKIE),
        });

        await supabaseModule.supabaseAdmin.from('site_visit_events').insert(row);
      }
    }

    return response;
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}

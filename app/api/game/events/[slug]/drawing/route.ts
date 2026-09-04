import { NextResponse } from 'next/server';
import {
  getEventBySlugDB,
  getEventByIdDB,
  getPublicDrawingPageDataDB,
  getAuthenticatedPlayerDrawingQualificationDB,
} from '@/lib/supabase-db';
import { resolveAuthenticatedSession, setAuthCookies, AuthSessionTokens } from '@/lib/supabase-auth';
import { isKnownCantonLaunchSlug, isPreLaunchEvent } from '@/lib/launch-status';
import { AuthenticatedPlayerDrawingQualification } from '@/lib/types';

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const slug = params.slug;
    let event = await getEventBySlugDB(slug);

    if (!event && isKnownCantonLaunchSlug(slug)) {
      event = (await getEventBySlugDB('canton-weekend-1')) || (await getEventByIdDB('b0000001-0000-4000-8000-000000000001'));
    }

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // resolveAuthenticatedSession + withCookies (not the
    // resolveAuthenticatedPlayer shorthand) so a silent access-token
    // refresh gets persisted back to cookies — otherwise the rotated
    // refresh token is burned here and the player's next authenticated
    // request has no way back in.
    let authenticatedPlayerQualification: AuthenticatedPlayerDrawingQualification | null = null;
    let refreshedSession: AuthSessionTokens | undefined;
    let authPlayerId: string | undefined;
    try {
      const sessionResult = await resolveAuthenticatedSession(request);
      refreshedSession = sessionResult.refreshedSession;
      authPlayerId = sessionResult.player?.id;
      if (sessionResult.player) {
        authenticatedPlayerQualification = await getAuthenticatedPlayerDrawingQualificationDB(
          sessionResult.player.id,
          event.id
        );
      }
    } catch {
      // Unauthenticated or invalid session: qualification stays null
    }
    const withCookies = (body: unknown, init?: ResponseInit) => {
      const res = NextResponse.json(body, init);
      if (refreshedSession) setAuthCookies(res, refreshedSession, authPlayerId);
      return res;
    };

    if (isPreLaunchEvent(event, slug)) {
      try {
        const drawingData = await getPublicDrawingPageDataDB(event.id);
        return withCookies({
          ...drawingData,
          authenticatedPlayerQualification,
          isPreLaunch: true,
        });
      } catch {
        return withCookies({
          isPreLaunch: true,
          eventSlug: slug,
          eventTitle: event.title,
          authenticatedPlayerQualification,
          message: 'The official Canton Quests prize drawing opens with the September 11 event.',
        });
      }
    }

    const drawingData = await getPublicDrawingPageDataDB(event.id);
    return withCookies({
      ...drawingData,
      authenticatedPlayerQualification,
    });
  } catch (error: any) {
    // Log diagnostics server-side only; never leak internal require stacks or paths
    console.error('[API /events/[slug]/drawing] Server error:', error);
    return NextResponse.json(
      {
        error: 'SYSTEM_TEMPORARILY_UNAVAILABLE',
        message: 'This part of Canton Quests could not be loaded right now.',
      },
      { status: 500 }
    );
  }
}

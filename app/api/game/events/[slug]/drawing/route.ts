import { NextResponse } from 'next/server';
import {
  getEventBySlugDB,
  getPublicDrawingPageDataDB,
  getAuthenticatedPlayerDrawingQualificationDB,
} from '@/lib/supabase-db';
import { resolveAuthenticatedPlayer } from '@/lib/supabase-auth';
import { isKnownCantonLaunchSlug, isPreLaunchEvent } from '@/lib/launch-status';
import { AuthenticatedPlayerDrawingQualification } from '@/lib/types';

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const slug = params.slug;
    const event = await getEventBySlugDB(slug);

    if (!event) {
      if (isKnownCantonLaunchSlug(slug)) {
        return NextResponse.json({
          isPreLaunch: true,
          eventSlug: slug,
          message: 'The official Canton Quests prize drawing opens with the September 11 event.',
        });
      }
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    let authenticatedPlayerQualification: AuthenticatedPlayerDrawingQualification | null = null;
    try {
      const authPlayer = await resolveAuthenticatedPlayer(request);
      if (authPlayer && authPlayer.id) {
        authenticatedPlayerQualification = await getAuthenticatedPlayerDrawingQualificationDB(
          authPlayer.id,
          event.id
        );
      }
    } catch {
      // Unauthenticated or invalid session: qualification stays null
    }

    if (isPreLaunchEvent(event, slug)) {
      try {
        const drawingData = await getPublicDrawingPageDataDB(event.id);
        return NextResponse.json({
          ...drawingData,
          authenticatedPlayerQualification,
          isPreLaunch: true,
        });
      } catch {
        return NextResponse.json({
          isPreLaunch: true,
          eventSlug: slug,
          eventTitle: event.title,
          authenticatedPlayerQualification,
          message: 'The official Canton Quests prize drawing opens with the September 11 event.',
        });
      }
    }

    const drawingData = await getPublicDrawingPageDataDB(event.id);
    return NextResponse.json({
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

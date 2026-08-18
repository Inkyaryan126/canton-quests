import { NextResponse } from 'next/server';
import { getEventBySlugDB, getPublicDrawingPageDataDB } from '@/lib/supabase-db';
import { isKnownCantonLaunchSlug, isPreLaunchEvent } from '@/lib/launch-status';

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

    if (isPreLaunchEvent(event, slug)) {
      try {
        const drawingData = await getPublicDrawingPageDataDB(event.id);
        return NextResponse.json({
          ...drawingData,
          isPreLaunch: true,
        });
      } catch {
        return NextResponse.json({
          isPreLaunch: true,
          eventSlug: slug,
          eventTitle: event.title,
          message: 'The official Canton Quests prize drawing opens with the September 11 event.',
        });
      }
    }

    const drawingData = await getPublicDrawingPageDataDB(event.id);
    return NextResponse.json(drawingData);
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

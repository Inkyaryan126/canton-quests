import { NextResponse } from 'next/server';
import { getEventBySlugDB, getPublicDrawingPageDataDB } from '@/lib/supabase-db';

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const slug = params.slug;
    const event = await getEventBySlugDB(slug);
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const drawingData = await getPublicDrawingPageDataDB(event.id);
    return NextResponse.json(drawingData);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch public drawing data' },
      { status: 500 }
    );
  }
}

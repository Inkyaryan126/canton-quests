import { NextResponse } from 'next/server';
import { getEventBySlugDB } from '@/lib/supabase-db';
import { resolveAuthenticatedSession } from '@/lib/supabase-auth';
import { getPlayerFinaleStatusDB, submitFinaleAnswerDB } from '@/lib/finale-db';

/**
 * GET /api/game/finale?eventSlug=canton-weekend-1
 * Own-eyes-only convergence status: sigil count, eligibility, and — only
 * once eligible — the master cipher clue pieces. The answer hash is never
 * part of this response, at any eligibility state.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const eventSlug = url.searchParams.get('eventSlug') || '';
    if (!eventSlug) return NextResponse.json({ status: null });

    const event = await getEventBySlugDB(eventSlug);
    if (!event) return NextResponse.json({ status: null });

    const session = await resolveAuthenticatedSession(request);
    if (!session.player) {
      return NextResponse.json({ success: false, error: 'Authentication required.' }, { status: 401 });
    }

    const status = await getPlayerFinaleStatusDB(event.id, session.player.id);
    return NextResponse.json({ status });
  } catch (error) {
    console.error('[API /game/finale] GET error:', error);
    return NextResponse.json({ error: 'Finale status unavailable' }, { status: 500 });
  }
}

/**
 * POST /api/game/finale
 * Body: { eventSlug, answer }
 * Submits a Master Cipher attempt. Never automatically triggers the prize
 * drawing system — completion only records player_finale_progress and
 * grants a fixed one-time XP token via the existing reward_grants ledger.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const eventSlug: string = body.eventSlug || '';
    const answer: string = body.answer || '';
    if (!eventSlug || !answer) {
      return NextResponse.json({ success: false, error: 'Missing eventSlug or answer' }, { status: 400 });
    }

    const event = await getEventBySlugDB(eventSlug);
    if (!event) return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 });

    const session = await resolveAuthenticatedSession(request);
    if (!session.player) {
      return NextResponse.json({ success: false, error: 'Authentication required.' }, { status: 401 });
    }

    const result = await submitFinaleAnswerDB(event.id, session.player.id, answer);
    if (!result.eligibility.ok) {
      return NextResponse.json({ success: false, error: result.eligibility.message, reason: result.eligibility.reason }, { status: 400 });
    }

    return NextResponse.json({ success: true, outcome: result.outcome });
  } catch (error: any) {
    console.error('[API /game/finale] POST error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to submit' }, { status: 500 });
  }
}

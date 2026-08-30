import { NextResponse } from 'next/server';
import { getEventByIdDB, getQuestByTargetCodeDB } from '@/lib/supabase-db';

/**
 * GET /api/qr/lookup?code=...
 *
 * Unauthenticated, read-only resolution of a scanned QR code to the
 * public-safe fact registration actually needs: which Mission it belongs
 * to, and whether that Mission requires a starting path. Never claims
 * anything and never returns quest content — that stays behind
 * POST /api/qr/claim, which requires auth. A physical QR card is public by
 * definition, so confirming "this belongs to the Fair, no path required"
 * reveals nothing a scanner didn't already have in hand.
 *
 * Exists so app/register/page.tsx can pick the right signup form
 * (path selector vs. the simpler no-path panel) for a first-time player who
 * scanned a QR before ever creating an account — previously it only made
 * that decision for an /events/[slug] destination, silently defaulting to
 * "path required" for a /qr/[code] destination like every Fair QR, showing
 * the Family/Challenge/Secret selector to a path-free Mission's player.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = (searchParams.get('code') || '').trim();
    if (!code) {
      return NextResponse.json({ found: false }, { status: 400 });
    }

    const quest = await getQuestByTargetCodeDB(code);
    if (!quest || !quest.eventId) {
      return NextResponse.json({ found: false });
    }

    const event = await getEventByIdDB(quest.eventId);
    if (!event) {
      return NextResponse.json({ found: false });
    }

    return NextResponse.json({
      found: true,
      eventSlug: event.slug,
      requiresPath: Boolean(event.requiresPath),
    });
  } catch (error: any) {
    console.error('[API /qr/lookup] Server error:', error);
    return NextResponse.json({ found: false }, { status: 500 });
  }
}

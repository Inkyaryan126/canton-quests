import { NextResponse } from 'next/server';
import { getEventBySlugDB } from '@/lib/supabase-db';
import { resolveAuthenticatedSession } from '@/lib/supabase-auth';
import { decodeDistrictCipherDB } from '@/lib/founders-cipher';
import { decodeLocalCipherDistrict, getEventBySlug } from '@/lib/game-engine';
import { isSupabaseAdminConfigured } from '@/lib/supabase';
import { CipherDistrictKey } from '@/lib/types';

/**
 * POST /api/game/cipher/decode
 * Body: { eventSlug: string, districtKey: 'arts' | 'challenge' | 'secret', sequence: string[] }
 * Validates player identity server-side, verifies required fragment collection,
 * validates fragment sequence against canonical district solution, and unlocks district Sigil.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const eventSlug: string = body.eventSlug || '';
    const districtKey = body.districtKey as CipherDistrictKey;
    const sequence: string[] = Array.isArray(body.sequence) ? body.sequence : [];

    if (!eventSlug || !districtKey || sequence.length !== 3) {
      return NextResponse.json(
        { success: false, error: 'Missing eventSlug, districtKey, or 3-fragment sequence.' },
        { status: 400 }
      );
    }

    if (districtKey !== 'arts' && districtKey !== 'challenge' && districtKey !== 'secret') {
      return NextResponse.json(
        { success: false, error: 'Invalid district key.' },
        { status: 400 }
      );
    }

    const session = await resolveAuthenticatedSession(request);
    if (!session.player) {
      return NextResponse.json(
        { success: false, error: 'Authentication required.' },
        { status: 401 }
      );
    }

    if (isSupabaseAdminConfigured) {
      const event = await getEventBySlugDB(eventSlug);
      if (!event) {
        return NextResponse.json({ success: false, error: 'Event not found.' }, { status: 404 });
      }

      const result = await decodeDistrictCipherDB({
        eventId: event.id,
        playerId: session.player.id,
        districtKey,
        sequence,
      });

      if (!result.success) {
        return NextResponse.json(
          { success: false, correct: result.correct ?? false, error: result.error || 'Decode failed.' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        correct: true,
        status: result.status,
        tokenLabel: result.tokenLabel,
        sigilSymbol: result.sigilSymbol,
        decodedSentence: result.decodedSentence,
        alreadyUnlocked: result.alreadyUnlocked,
      });
    }

    // Local / offline test engine fallback
    const localEvent = getEventBySlug(eventSlug);
    if (!localEvent) {
      return NextResponse.json({ success: false, error: 'Event not found.' }, { status: 404 });
    }

    const localResult = decodeLocalCipherDistrict({
      eventId: localEvent.id,
      playerId: session.player.id,
      districtKey,
      sequence,
    });

    if (!localResult.success) {
      return NextResponse.json(
        { success: false, correct: localResult.correct ?? false, error: localResult.error || 'Decode failed.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      correct: true,
      status: localResult.status,
      tokenLabel: localResult.tokenLabel,
      sigilSymbol: localResult.sigilSymbol,
      decodedSentence: localResult.decodedSentence,
      alreadyUnlocked: localResult.alreadyUnlocked,
    });
  } catch (error: any) {
    console.error('[API /game/cipher/decode] POST error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error.' },
      { status: 500 }
    );
  }
}

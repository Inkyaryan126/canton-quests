import { NextResponse } from 'next/server';
import { submitQuestProofDB } from '@/lib/supabase-db';
import { resolveAuthenticatedPlayer } from '@/lib/supabase-auth';

export async function POST(request: Request) {
  try {
    // The acting player is always derived from the authenticated session —
    // never trusted from the client body. Canton Quests has no guest/
    // anonymous identity model (every player.id is backed by an
    // authenticated Supabase Auth user, see lib/supabase-auth.ts), so quest
    // submission requires a valid session.
    const authenticatedPlayer = await resolveAuthenticatedPlayer(request);
    if (!authenticatedPlayer) {
      return NextResponse.json(
        { success: false, error: 'Authentication required to submit quest proof.', awardedPoints: 0 },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      playerId,
      questId,
      eventId,
      proofType,
      submittedContent,
      proofUrl,
      userLat,
      userLon,
      userAccuracyMeters,
      stepIndex,
    } = body;

    // A client-supplied playerId is accepted only for backward compatibility
    // and must exactly match the authenticated player — any mismatch is a
    // forged-identity attempt and is rejected outright, not silently
    // resubmitted under the real player's identity.
    if (playerId && playerId !== authenticatedPlayer.id) {
      return NextResponse.json(
        { success: false, error: 'Cannot submit proof on behalf of another player.', awardedPoints: 0 },
        { status: 403 }
      );
    }

    if (!questId || !eventId || !proofType) {
      return NextResponse.json(
        { error: 'Missing required fields: questId, eventId, proofType' },
        { status: 400 }
      );
    }

    const result = await submitQuestProofDB(
      {
        playerId: authenticatedPlayer.id,
        questId,
        eventId,
        proofType,
        submittedContent,
        proofUrl,
        userLat,
        userLon,
        userAccuracyMeters,
        stepIndex,
      },
      request
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[API /submit] Server error:', error);
    return NextResponse.json({ error: 'Submission processing failed' }, { status: 500 });
  }
}

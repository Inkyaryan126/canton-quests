import { NextResponse } from 'next/server';
import { submitQuestProofDB } from '@/lib/supabase-db';

export async function POST(request: Request) {
  try {
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

    if (!playerId || !questId || !eventId || !proofType) {
      return NextResponse.json(
        { error: 'Missing required fields: playerId, questId, eventId, proofType' },
        { status: 400 }
      );
    }

    const authHeader = request.headers.get('authorization') || '';
    const authToken = authHeader.replace(/^Bearer\s+/i, '').trim() || undefined;

    const result = await submitQuestProofDB(
      {
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
      },
      authToken
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[API /submit] Server error:', error);
    return NextResponse.json({ error: 'Submission processing failed' }, { status: 500 });
  }
}

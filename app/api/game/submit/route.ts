import { NextResponse } from 'next/server';
import { submitQuestProofDB } from '@/lib/supabase-db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { playerId, questId, eventId, proofType, submittedContent, proofUrl } = body;

    if (!playerId || !questId || !eventId || !proofType) {
      return NextResponse.json(
        { error: 'Missing required fields: playerId, questId, eventId, proofType' },
        { status: 400 }
      );
    }

    const result = await submitQuestProofDB({
      playerId,
      questId,
      eventId,
      proofType,
      submittedContent,
      proofUrl,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Submission failed' }, { status: 500 });
  }
}

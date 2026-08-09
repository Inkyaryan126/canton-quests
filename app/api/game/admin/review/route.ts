import { NextResponse } from 'next/server';
import { reviewSubmissionDB } from '@/lib/supabase-db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { submissionId, status, feedback } = body;

    if (!submissionId || !status) {
      return NextResponse.json(
        { error: 'Missing required fields: submissionId, status' },
        { status: 400 }
      );
    }

    const submission = await reviewSubmissionDB(submissionId, status, feedback);
    return NextResponse.json({ success: true, submission });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Review action failed' }, { status: 500 });
  }
}

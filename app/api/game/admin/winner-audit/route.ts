import { NextResponse } from 'next/server';
import { resolveAdminSessionFromRequest } from '@/lib/admin-auth';
import { getWinnerAuditQueueDB, resolveWinnerAuditSubmissionDB } from '@/lib/supabase-db';
import { supabaseAdmin, isSupabaseAdminConfigured } from '@/lib/supabase';
import { QUEST_EVIDENCE_BUCKET } from '@/lib/quest-evidence';

// Winner Audit is never a general moderation queue — it only ever contains
// the photo/video evidence belonging to a player who has actually been
// drawn as a prize candidate (see flagPlayerEvidenceForWinnerAudit). This
// route is the only place a short-lived signed READ URL is ever minted for
// that private evidence, and only for an authenticated Game Master.

export async function GET(request: Request) {
  const session = resolveAdminSessionFromRequest(request);
  if (!session.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized. Game Master admin session is required.' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get('eventId');
  if (!eventId) {
    return NextResponse.json({ error: 'Missing required query param: eventId' }, { status: 400 });
  }

  const queue = await getWinnerAuditQueueDB(eventId);

  const withSignedUrls = await Promise.all(
    queue.map(async (submission) => {
      let signedEvidenceUrl: string | null = null;
      if (isSupabaseAdminConfigured && supabaseAdmin && submission.proofUrl) {
        const { data } = await supabaseAdmin.storage
          .from(QUEST_EVIDENCE_BUCKET)
          .createSignedUrl(submission.proofUrl, 300);
        signedEvidenceUrl = data?.signedUrl || null;
      }
      return { ...submission, signedEvidenceUrl };
    })
  );

  return NextResponse.json({ success: true, queue: withSignedUrls });
}

export async function POST(request: Request) {
  const session = resolveAdminSessionFromRequest(request);
  if (!session.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized. Game Master admin session is required.' }, { status: 401 });
  }

  const body = await request.json();
  const { submissionId, decision } = body;

  if (!submissionId || (decision !== 'approved' && decision !== 'rejected')) {
    return NextResponse.json(
      { error: 'Missing/invalid fields: submissionId, decision ("approved" | "rejected")' },
      { status: 400 }
    );
  }

  const resolved = await resolveWinnerAuditSubmissionDB(submissionId, decision);
  if (!resolved) {
    return NextResponse.json({ error: 'Submission not found or update failed.' }, { status: 404 });
  }

  return NextResponse.json({ success: true, submission: resolved });
}

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { authorizeGameMasterRequest, verifyAdminSecret, ADMIN_COOKIE_NAME } from '@/lib/admin-auth';
import { reviewSubmissionDB } from '@/lib/supabase-db';

function getAdminSessionFromRequest(request: Request) {
  const headersObj = Object.fromEntries(request.headers.entries());
  const headerSession = authorizeGameMasterRequest(headersObj);
  if (headerSession.isAdmin) {
    return { isAdmin: true, adminName: headerSession.adminName };
  }

  const cookieStore = cookies();
  const adminCookie = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (adminCookie && verifyAdminSecret(adminCookie)) {
    return { isAdmin: true, adminName: 'Game Master' };
  }

  return { isAdmin: false, adminName: 'Guest' };
}

export async function POST(request: Request) {
  try {
    const session = getAdminSessionFromRequest(request);

    if (!session.isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized. Game Master admin session is required.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { submissionId, status, feedback, reviewerNotes } = body;

    if (!submissionId || !status) {
      return NextResponse.json(
        { error: 'Missing required fields: submissionId, status' },
        { status: 400 }
      );
    }

    const submission = await reviewSubmissionDB(submissionId, status, feedback, reviewerNotes || session.adminName);
    return NextResponse.json({ success: true, submission });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Review action failed' }, { status: 400 });
  }
}

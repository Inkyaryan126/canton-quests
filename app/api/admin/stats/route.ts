import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminSecret, authorizeGameMasterRequest, ADMIN_COOKIE_NAME } from '@/lib/admin-auth';
import { getAllPlayers, getAllSubmissions } from '@/lib/game-engine';
import { getSpectatorSessionCount } from '@/lib/spectator-engine';

function isAdminRequest(request: Request): boolean {
  const headersObj = Object.fromEntries(request.headers.entries());
  const headerSession = authorizeGameMasterRequest(headersObj);
  if (headerSession.isAdmin) return true;
  const cookieStore = cookies();
  const adminCookie = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  return Boolean(adminCookie && verifyAdminSecret(adminCookie));
}

export async function GET(request: Request) {
  try {
    if (!isAdminRequest(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const players = getAllPlayers();
    const submissions = getAllSubmissions();

    return NextResponse.json({
      totalPlayers: players.length,
      activeSpectators: getSpectatorSessionCount(),
      totalSubmissions: submissions.length,
      pendingSubmissions: submissions.filter((s) => s.status === 'pending').length,
      verifiedSubmissions: submissions.filter((s) => s.status === 'verified').length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

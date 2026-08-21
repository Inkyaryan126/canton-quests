import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({
    success: true,
    message: 'Signed out successfully. Session terminated.',
  });

  // Expire player cookie
  response.cookies.set('canton_player_id', '', {
    path: '/',
    maxAge: 0,
  });

  // Expire supabase session cookies if set
  response.cookies.set('sb-access-token', '', {
    path: '/',
    maxAge: 0,
  });

  response.cookies.set('sb-refresh-token', '', {
    path: '/',
    maxAge: 0,
  });

  response.cookies.set('supabase-auth-token', '', {
    path: '/',
    maxAge: 0,
  });

  return response;
}

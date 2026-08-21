import { NextResponse } from 'next/server';
import { clearAuthCookies, signOutUser } from '@/lib/supabase-auth';

export async function POST(request: Request) {
  try {
    await signOutUser(request);
  } catch {
    // ignore
  }

  const response = NextResponse.json({
    success: true,
    message: 'Signed out successfully. Session terminated.',
  });

  // Expire all auth and session cookies
  clearAuthCookies(response);

  return response;
}

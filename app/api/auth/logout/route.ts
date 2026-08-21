import { NextResponse } from 'next/server';
import { clearAuthCookies } from '@/lib/supabase-auth';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export async function POST() {
  try {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut().catch(() => {});
    }
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

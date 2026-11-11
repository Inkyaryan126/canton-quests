import { NextResponse } from 'next/server';

/** Legacy game entry. Keep a simple redirect for existing bookmarks. */
export async function GET() {
  const response = NextResponse.redirect('https://dominatethegrid.com', 303);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

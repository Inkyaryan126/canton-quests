import { NextResponse } from 'next/server';
import {
  CAMPAIGN_ATTRIBUTION_COOKIE,
  CAMPAIGN_VISITOR_COOKIE,
  createAnonymousVisitorId,
  createAttributionCookieValue,
  recordCampaignVisit,
} from '@/lib/qr-campaigns';

export async function GET(request: Request, { params }: { params: { slug: string } }) {
  const cookieHeader = request.headers.get('cookie') || '';
  const visitorCookie = cookieHeader
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${CAMPAIGN_VISITOR_COOKIE}=`))
    ?.split('=')[1];
  const visitorId = visitorCookie || createAnonymousVisitorId();

  const result = await recordCampaignVisit({
    trackingSlug: params.slug,
    anonymousVisitorId: visitorId,
    referrer: request.headers.get('referer'),
    userAgent: request.headers.get('user-agent'),
  });

  if (!result.qrCode) {
    return NextResponse.redirect(new URL('/quests?campaign=invalid', request.url));
  }

  const destination = new URL(result.qrCode.destinationUrl, request.url);
  const response = NextResponse.redirect(destination);

  response.cookies.set({
    name: CAMPAIGN_VISITOR_COOKIE,
    value: visitorId,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 90,
  });

  response.cookies.set({
    name: CAMPAIGN_ATTRIBUTION_COOKIE,
    value: createAttributionCookieValue(result.qrCode),
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}

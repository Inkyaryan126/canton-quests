import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminSecret, authorizeGameMasterRequest, ADMIN_COOKIE_NAME } from '@/lib/admin-auth';
import * as supabaseModule from '@/lib/supabase';

function isAdminRequest(request: Request): boolean {
  const headersObj = Object.fromEntries(request.headers.entries());
  const headerSession = authorizeGameMasterRequest(headersObj);
  if (headerSession.isAdmin) return true;
  const cookieStore = cookies();
  const adminCookie = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  return Boolean(adminCookie && verifyAdminSecret(adminCookie));
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function startOfToday(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

const COUNTRY_NAMES: Record<string, string> = {
  US: 'United States', CA: 'Canada', GB: 'United Kingdom', AU: 'Australia',
  DE: 'Germany', FR: 'France', JP: 'Japan', IN: 'India', BR: 'Brazil',
  MX: 'Mexico', ES: 'Spain', IT: 'Italy', NL: 'Netherlands', KR: 'South Korea',
  RU: 'Russia', PL: 'Poland', SE: 'Sweden', NO: 'Norway', DK: 'Denmark',
  FI: 'Finland', NZ: 'New Zealand', ZA: 'South Africa', NG: 'Nigeria',
  PH: 'Philippines', SG: 'Singapore', MY: 'Malaysia', TH: 'Thailand',
  ID: 'Indonesia', VN: 'Vietnam', AR: 'Argentina', CO: 'Colombia',
  CL: 'Chile', PT: 'Portugal', IE: 'Ireland', BE: 'Belgium', CH: 'Switzerland',
  AT: 'Austria', CZ: 'Czech Republic', HU: 'Hungary', RO: 'Romania',
  UA: 'Ukraine', TR: 'Turkey', IL: 'Israel', AE: 'United Arab Emirates',
};

export async function GET(request: Request) {
  try {
    if (!isAdminRequest(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!supabaseModule.supabaseAdmin) {
      return NextResponse.json({ error: 'no_db' }, { status: 200 });
    }

    const url = new URL(request.url);
    const range = url.searchParams.get('range') || '30d';
    const since = range === '7d' ? daysAgo(7) : range === 'all' ? '2020-01-01T00:00:00Z' : daysAgo(30);

    // Fetch all visits in range (we aggregate in JS for flexibility; fine for <100k rows)
    const { data: visits, error } = await supabaseModule.supabaseAdmin
      .from('site_visits')
      .select('session_hash,page_path,country,country_code,region,city,device_type,referrer,visited_at')
      .gte('visited_at', since)
      .order('visited_at', { ascending: false })
      .limit(10000);

    if (error) {
      if (error.code === '42P01') {
        // Table doesn't exist yet
        return NextResponse.json({ error: 'table_missing' }, { status: 200 });
      }
      throw error;
    }

    const rows = visits || [];

    // Total visits
    const totalVisits = rows.length;

    // Unique visitors (by session_hash)
    const uniqueSessions = new Set(rows.map((r) => r.session_hash).filter(Boolean));
    const uniqueVisitors = uniqueSessions.size;

    // Today's visits
    const todayCutoff = startOfToday();
    const todayVisits = rows.filter((r) => r.visited_at >= todayCutoff).length;

    // Visits by day (last 30 days)
    const dayMap: Record<string, number> = {};
    const dayCount = range === '7d' ? 7 : 30;
    for (let i = dayCount - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      dayMap[key] = 0;
    }
    for (const r of rows) {
      const day = r.visited_at?.slice(0, 10);
      if (day && day in dayMap) dayMap[day]++;
    }
    const visitsByDay = Object.entries(dayMap).map(([date, count]) => ({ date, count }));

    // Top countries
    const countryMap: Record<string, number> = {};
    for (const r of rows) {
      if (r.country_code) countryMap[r.country_code] = (countryMap[r.country_code] || 0) + 1;
    }
    const topCountries = Object.entries(countryMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([code, count]) => ({ code, name: COUNTRY_NAMES[code] || code, count }));

    // Top cities (country_code + city)
    const cityMap: Record<string, { city: string; country: string; count: number }> = {};
    for (const r of rows) {
      if (r.city) {
        const key = `${r.city}|${r.country_code || ''}`;
        if (!cityMap[key]) cityMap[key] = { city: r.city, country: r.country_code || '', count: 0 };
        cityMap[key].count++;
      }
    }
    const topCities = Object.values(cityMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Top pages
    const pageMap: Record<string, number> = {};
    for (const r of rows) {
      if (r.page_path) pageMap[r.page_path] = (pageMap[r.page_path] || 0) + 1;
    }
    const topPages = Object.entries(pageMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([page, count]) => ({ page, count }));

    // Device breakdown
    const deviceMap: Record<string, number> = { desktop: 0, mobile: 0, tablet: 0 };
    for (const r of rows) {
      const d = r.device_type || 'desktop';
      if (d in deviceMap) deviceMap[d]++;
    }
    const deviceBreakdown = Object.entries(deviceMap).map(([type, count]) => ({ type, count }));

    // Referrer breakdown
    const refMap: Record<string, number> = {};
    for (const r of rows) {
      const ref = r.referrer ? new URL(r.referrer).hostname.replace(/^www\./, '') : 'direct';
      refMap[ref] = (refMap[ref] || 0) + 1;
    }
    const topReferrers = Object.entries(refMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([source, count]) => ({ source, count }));

    // Recent 30 visits
    const recentVisits = rows.slice(0, 30).map((r) => ({
      city: r.city,
      country: COUNTRY_NAMES[r.country_code || ''] || r.country_code || '—',
      countryCode: r.country_code,
      page: r.page_path,
      device: r.device_type || 'desktop',
      visitedAt: r.visited_at,
    }));

    return NextResponse.json({
      totalVisits,
      uniqueVisitors,
      todayVisits,
      visitsByDay,
      topCountries,
      topCities,
      topPages,
      deviceBreakdown,
      topReferrers,
      recentVisits,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

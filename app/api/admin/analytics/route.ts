import { NextResponse } from 'next/server';
import { resolveAdminSessionFromRequest } from '@/lib/admin-auth';
import * as supabaseModule from '@/lib/supabase';
import {
  ANALYTICS_PERIODS,
  AnalyticsPeriod,
  SiteVisitEventRow,
  getPeriodStart,
  hourlyBuckets,
  isAnalyticsPeriod,
  startOfDay,
  summarizeHumanTraffic,
  summarizeNewVsReturning,
  topCampaigns,
  topPaths,
  topReferrers,
} from '@/lib/site-analytics';

// How far back we fetch rows for. Must cover every period selector (7d is
// the widest) plus enough lookback before "today" to correctly classify
// today's visitors as new vs. returning (summarizeNewVsReturning needs each
// visitor's true first-ever appearance, not just today's rows).
const HISTORY_LOOKBACK_DAYS = 30;
const ROW_FETCH_LIMIT = 50_000;

const SELECT_COLUMNS =
  'visitor_id,session_id,player_id,event_type,path,referrer,utm_source,utm_medium,utm_campaign,utm_content,utm_term,qr_code_id,flyer_variant_id,campaign_id,is_bot,created_at';

export async function GET(request: Request) {
  try {
    const session = resolveAdminSessionFromRequest(request);
    if (!session.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!supabaseModule.supabaseAdmin) {
      return NextResponse.json({ error: 'no_db' }, { status: 200 });
    }

    const url = new URL(request.url);
    const requestedPeriod = url.searchParams.get('period');
    const period: AnalyticsPeriod = isAnalyticsPeriod(requestedPeriod) ? requestedPeriod : '2h';

    const now = new Date();
    const historySince = new Date(now.getTime() - HISTORY_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

    // Exact query logic for "unique humans": filter to non-bot rows within
    // the lookback window at the database layer (using the (is_bot,
    // created_at) index), equivalent to:
    //   SELECT ... FROM site_visit_events
    //   WHERE is_bot = false AND created_at >= :historySince
    //   ORDER BY created_at DESC LIMIT :ROW_FETCH_LIMIT
    // Period-specific cutoffs (1h/2h/6h/24h/7d, and "today") are then
    // applied in-process via the same getPeriodStart/summarizeHumanTraffic
    // helpers unit-tested in tests/site-visit-analytics.test.ts, so the
    // semantics are identical between production and tests.
    const { data, error } = await supabaseModule.supabaseAdmin
      .from('site_visit_events')
      .select(SELECT_COLUMNS)
      .eq('is_bot', false)
      .gte('created_at', historySince.toISOString())
      .order('created_at', { ascending: false })
      .limit(ROW_FETCH_LIMIT);

    if (error) {
      if (error.code === '42P01') {
        return NextResponse.json({ error: 'table_missing' }, { status: 200 });
      }
      throw error;
    }

    const rows = (data || []) as SiteVisitEventRow[];

    const periodStartIso = getPeriodStart(period, now).toISOString();
    const rightNowRows = rows.filter((row) => (row.created_at || '') >= periodStartIso);
    const rightNow = summarizeHumanTraffic(rightNowRows);

    const todayStartIso = startOfDay(now).toISOString();
    const todayRows = rows.filter((row) => (row.created_at || '') >= todayStartIso);
    const today = {
      ...summarizeHumanTraffic(todayRows),
      ...summarizeNewVsReturning(rows, todayStartIso),
    };

    const last24hIso = getPeriodStart('24h', now).toISOString();
    const last24hRows = rows.filter((row) => (row.created_at || '') >= last24hIso);

    const traffic = {
      hourly: hourlyBuckets(last24hRows),
      topPages: topPaths(rightNowRows, 10),
      topReferrers: topReferrers(rightNowRows, 10),
      topCampaigns: topCampaigns(rightNowRows, 10),
    };

    return NextResponse.json({
      period,
      periods: ANALYTICS_PERIODS,
      generatedAt: now.toISOString(),
      rightNow,
      today,
      traffic,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to load analytics.' }, { status: 500 });
  }
}

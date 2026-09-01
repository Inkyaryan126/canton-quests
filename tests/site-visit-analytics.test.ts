// Canton Quests — First-Party Visitor Analytics (site_visit_events) Tests
//
// Covers the pure identity/bot/attribution/aggregation logic in
// lib/site-analytics.ts, the /api/track route's cookie + insert wiring
// (with a mocked Supabase client so DB writes can be asserted directly),
// and the admin analytics endpoint's authorization gate.

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ANALYTICS_PERIODS,
  buildSiteVisitEventRow,
  classifyDevice,
  detectBot,
  getPeriodStart,
  hourlyBuckets,
  isTrackablePath,
  parseAttribution,
  readCookie,
  resolveSessionId,
  resolveVisitorId,
  startOfDay,
  summarizeHumanTraffic,
  summarizeNewVsReturning,
  topCampaigns,
  topPaths,
  topReferrers,
  type SiteVisitEventRow,
} from '../lib/site-analytics';
import { createAttributionCookieValue } from '../lib/qr-campaigns';
import type { CampaignQrCode } from '../lib/types';

function row(overrides: Partial<SiteVisitEventRow>): SiteVisitEventRow {
  return {
    visitor_id: 'visitor-a',
    session_id: 'session-a',
    player_id: null,
    event_type: 'page_view',
    path: '/quests',
    referrer: null,
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    utm_content: null,
    utm_term: null,
    qr_code_id: null,
    flyer_variant_id: null,
    campaign_id: null,
    device_class: 'desktop',
    user_agent_class: 'desktop',
    is_bot: false,
    bot_reason: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('Trackable path filtering (static/API routes never count as page views)', () => {
  it('rejects API, Next.js internal, robots/sitemap/manifest, and static asset paths', () => {
    for (const path of [
      '/api/track',
      '/api/admin/analytics',
      '/_next/static/chunks/main.js',
      '/robots.txt',
      '/sitemap.xml',
      '/manifest.json',
      '/favicon.ico',
      '/logo.png',
      '/canton-quests/quests/family/bell.png',
      '/styles/app.css',
      '/fonts/inter.woff2',
    ]) {
      expect(isTrackablePath(path)).toBe(false);
    }
  });

  it('accepts real navigational page paths', () => {
    for (const path of ['/', '/quests', '/events/canton-weekend-1/quests/qst-kraken-wall', '/leaderboard']) {
      expect(isTrackablePath(path)).toBe(true);
    }
  });

  it('rejects empty, non-absolute, or absurdly long paths', () => {
    expect(isTrackablePath('')).toBe(false);
    expect(isTrackablePath('quests')).toBe(false);
    expect(isTrackablePath('/' + 'a'.repeat(400))).toBe(false);
  });
});

describe('Bot detection', () => {
  it('flags the exact junk traffic pattern already seen in production (/wp-admin/install.php) regardless of user agent', () => {
    const result = detectBot({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', path: '/wp-admin/install.php' });
    expect(result.isBot).toBe(true);
    expect(result.reason).toBe('scanner_path');
  });

  it('flags other common scanner/exploit-probe paths regardless of user agent', () => {
    for (const path of ['/wp-login.php', '/.env', '/.git/config', '/phpmyadmin/index.php', '/xmlrpc.php', '/cgi-bin/test.cgi', '/actuator/health']) {
      expect(detectBot({ userAgent: 'Mozilla/5.0 real browser string', path }).isBot).toBe(true);
    }
  });

  it('flags known search-engine and AI crawlers by user agent', () => {
    for (const ua of ['Googlebot/2.1 (+http://www.google.com/bot.html)', 'Mozilla/5.0 (compatible; Bingbot/2.0)', 'GPTBot/1.0']) {
      expect(detectBot({ userAgent: ua, path: '/quests' }).isBot).toBe(true);
    }
  });

  it('flags uptime/monitoring probes so they never inflate human visitor counts', () => {
    expect(detectBot({ userAgent: 'UptimeRobot/2.0', path: '/' }).isBot).toBe(true);
    expect(detectBot({ userAgent: 'Pingdom.com_bot_version_1.4', path: '/' }).reason).toBe('monitoring_probe');
  });

  it('flags automation tools/headless clients', () => {
    for (const ua of ['curl/8.4.0', 'python-requests/2.31.0', 'axios/1.6.0', 'HeadlessChrome/120.0']) {
      expect(detectBot({ userAgent: ua, path: '/quests' }).isBot).toBe(true);
    }
  });

  it('flags a missing user agent as a bot', () => {
    expect(detectBot({ userAgent: '', path: '/quests' }).reason).toBe('missing_user_agent');
    expect(detectBot({ userAgent: null, path: '/quests' }).isBot).toBe(true);
  });

  it('does not flag a normal real browser on a real page as a bot', () => {
    const result = detectBot({
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
      path: '/events/canton-weekend-1/quests',
    });
    expect(result.isBot).toBe(false);
    expect(result.reason).toBeNull();
  });
});

describe('Device classification', () => {
  it('classifies mobile, tablet, and desktop user agents', () => {
    expect(classifyDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)')).toBe('mobile');
    expect(classifyDevice('Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X)')).toBe('tablet');
    expect(classifyDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('desktop');
    expect(classifyDevice('')).toBe('unknown');
  });
});

describe('Visitor/session identity resolution (cq_vid / cq_sid)', () => {
  it('mints a new visitor id when no cookie is present', () => {
    const { id, isNew } = resolveVisitorId(null);
    expect(isNew).toBe(true);
    expect(id).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('reuses a valid existing visitor id cookie', () => {
    const existing = resolveVisitorId(null).id;
    const { id, isNew } = resolveVisitorId(existing);
    expect(isNew).toBe(false);
    expect(id).toBe(existing);
  });

  it('rejects a malformed/tampered cookie value and mints a fresh id instead of trusting it', () => {
    const { id, isNew } = resolveVisitorId('not-a-real-uuid; DROP TABLE site_visit_events;');
    expect(isNew).toBe(true);
    expect(id).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('session id resolution follows the same reuse-or-mint rule, independent of visitor id', () => {
    const session = resolveSessionId(null);
    expect(session.isNew).toBe(true);
    const reused = resolveSessionId(session.id);
    expect(reused.id).toBe(session.id);
    expect(reused.isNew).toBe(false);
  });

  it('readCookie extracts one named cookie out of a full Cookie header', () => {
    expect(readCookie('cq_vid=abc-123; cq_sid=def-456; other=1', 'cq_sid')).toBe('def-456');
    expect(readCookie('cq_vid=abc-123', 'cq_sid')).toBeNull();
    expect(readCookie(null, 'cq_vid')).toBeNull();
  });
});

describe('URL/QR/UTM attribution persistence', () => {
  it('parses UTM parameters from the page querystring', () => {
    const attribution = parseAttribution({ search: '?utm_source=facebook&utm_medium=cpc&utm_campaign=fall2026&utm_content=ad1&utm_term=canton' });
    expect(attribution.utmSource).toBe('facebook');
    expect(attribution.utmMedium).toBe('cpc');
    expect(attribution.utmCampaign).toBe('fall2026');
    expect(attribution.utmContent).toBe('ad1');
    expect(attribution.utmTerm).toBe('canton');
  });

  it('decodes the real CAMPAIGN_ATTRIBUTION_COOKIE produced by /go/[slug] so QR/campaign source persists onto page views after redirect', () => {
    const qrCode: CampaignQrCode = {
      id: 'cqr-canonical-f1',
      campaignId: 'camp-street-team-2026',
      flyerVariantId: 'flyer-family',
      distributorId: 'dist-dustin',
      internalName: 'test',
      destinationUrl: '/start/family',
      trackingSlug: 'f1',
      trackingUrl: 'https://www.cantonquests.com/go/f1',
      status: 'active',
      createdAt: new Date().toISOString(),
    };
    const cookieValue = createAttributionCookieValue(qrCode);
    const attribution = parseAttribution({ campaignAttributionCookieValue: cookieValue });
    expect(attribution.qrCodeId).toBe('cqr-canonical-f1');
    expect(attribution.flyerVariantId).toBe('flyer-family');
    expect(attribution.campaignId).toBe('camp-street-team-2026');
  });

  it('never throws on a malformed/tampered attribution cookie — attribution just stays null', () => {
    expect(() => parseAttribution({ campaignAttributionCookieValue: 'not-valid-base64url-json' })).not.toThrow();
    const attribution = parseAttribution({ campaignAttributionCookieValue: 'not-valid-base64url-json' });
    expect(attribution.qrCodeId).toBeNull();
  });

  it('querystring qr/campaign/flyer params take precedence over a stale cookie value', () => {
    const attribution = parseAttribution({
      search: '?qr=direct-override',
      campaignAttributionCookieValue: Buffer.from(JSON.stringify({ qrCodeId: 'cookie-value' })).toString('base64url'),
    });
    expect(attribution.qrCodeId).toBe('direct-override');
  });
});

describe('site_visit_events row assembly', () => {
  it('authenticated users attach a real player_id while still retaining the anonymous visitor id', () => {
    const built = buildSiteVisitEventRow({
      visitorId: 'vid-1',
      sessionId: 'sid-1',
      playerId: 'plyr-123',
      path: '/events/canton-weekend-1/quests',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      userAgentClass: 'desktop',
    });
    expect(built.player_id).toBe('plyr-123');
    expect(built.visitor_id).toBe('vid-1');
  });

  it('anonymous users still track, with player_id left null', () => {
    const built = buildSiteVisitEventRow({
      visitorId: 'vid-2',
      sessionId: 'sid-2',
      path: '/quests',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      userAgentClass: 'desktop',
    });
    expect(built.player_id).toBeNull();
    expect(built.visitor_id).toBe('vid-2');
    expect(built.is_bot).toBe(false);
  });

  it('marks obvious bot traffic is_bot=true with a reason, rather than dropping the row silently', () => {
    const built = buildSiteVisitEventRow({
      visitorId: 'vid-3',
      sessionId: 'sid-3',
      path: '/wp-admin/install.php',
      userAgent: 'Mozilla/5.0',
      userAgentClass: 'desktop',
    });
    expect(built.is_bot).toBe(true);
    expect(built.bot_reason).toBe('scanner_path');
  });
});

describe('Human traffic aggregation semantics', () => {
  it('the same visitor id across multiple pages counts as exactly one unique visitor, with one page view per page', () => {
    const rows = [
      row({ path: '/', visitor_id: 'v1', session_id: 's1' }),
      row({ path: '/quests', visitor_id: 'v1', session_id: 's1' }),
      row({ path: '/leaderboard', visitor_id: 'v1', session_id: 's1' }),
    ];
    const summary = summarizeHumanTraffic(rows);
    expect(summary.uniqueVisitors).toBe(1);
    expect(summary.pageViews).toBe(3);
    expect(summary.sessions).toBe(1);
  });

  it('a human moving through 10 pages equals 1 unique visitor, 1 session, 10 page views — never 10 visitors', () => {
    const rows = Array.from({ length: 10 }, (_, i) => row({ path: `/page-${i}`, visitor_id: 'same-human', session_id: 'same-session' }));
    const summary = summarizeHumanTraffic(rows);
    expect(summary.uniqueVisitors).toBe(1);
    expect(summary.sessions).toBe(1);
    expect(summary.pageViews).toBe(10);
  });

  it('different visitor ids count separately', () => {
    const rows = [row({ visitor_id: 'v1', session_id: 's1' }), row({ visitor_id: 'v2', session_id: 's2' }), row({ visitor_id: 'v3', session_id: 's3' })];
    const summary = summarizeHumanTraffic(rows);
    expect(summary.uniqueVisitors).toBe(3);
    expect(summary.sessions).toBe(3);
    expect(summary.pageViews).toBe(3);
  });

  it('excludes is_bot rows from unique visitors, page views, and sessions entirely', () => {
    const rows = [
      row({ visitor_id: 'human-1', session_id: 's1', is_bot: false }),
      row({ visitor_id: 'scanner-1', session_id: 's2', is_bot: true, bot_reason: 'scanner_path' }),
      row({ visitor_id: 'crawler-1', session_id: 's3', is_bot: true, bot_reason: 'known_crawler' }),
    ];
    const summary = summarizeHumanTraffic(rows);
    expect(summary.uniqueVisitors).toBe(1);
    expect(summary.pageViews).toBe(1);
    expect(summary.sessions).toBe(1);
  });

  it('counts distinct authenticated players separately from anonymous visitors', () => {
    const rows = [
      row({ visitor_id: 'v1', session_id: 's1', player_id: 'p1' }),
      row({ visitor_id: 'v1', session_id: 's1', player_id: 'p1', path: '/leaderboard' }),
      row({ visitor_id: 'v2', session_id: 's2', player_id: null }),
    ];
    const summary = summarizeHumanTraffic(rows);
    expect(summary.uniqueVisitors).toBe(2);
    expect(summary.authenticatedPlayers).toBe(1);
  });

  it('new vs returning: a visitor first seen before today counts as returning; a visitor first seen today counts as new', () => {
    const todayStart = '2026-09-01T00:00:00.000Z';
    const rows = [
      row({ visitor_id: 'returning-visitor', created_at: '2026-08-20T10:00:00.000Z' }),
      row({ visitor_id: 'returning-visitor', created_at: '2026-09-01T09:00:00.000Z' }),
      row({ visitor_id: 'new-visitor', created_at: '2026-09-01T11:00:00.000Z' }),
    ];
    const result = summarizeNewVsReturning(rows, todayStart);
    expect(result.newVisitors).toBe(1);
    expect(result.returningVisitors).toBe(1);
  });

  it('hourlyBuckets groups unique visitors and page views per hour', () => {
    const rows = [
      row({ visitor_id: 'v1', created_at: '2026-09-01T10:15:00.000Z' }),
      row({ visitor_id: 'v1', created_at: '2026-09-01T10:45:00.000Z', path: '/quests' }),
      row({ visitor_id: 'v2', created_at: '2026-09-01T11:05:00.000Z' }),
    ];
    const buckets = hourlyBuckets(rows);
    expect(buckets).toEqual([
      { hour: '2026-09-01T10:00:00.000Z', uniqueVisitors: 1, pageViews: 2 },
      { hour: '2026-09-01T11:00:00.000Z', uniqueVisitors: 1, pageViews: 1 },
    ]);
  });

  it('topPaths / topReferrers / topCampaigns rank by human traffic only', () => {
    const rows = [
      row({ path: '/quests', is_bot: false }),
      row({ path: '/quests', is_bot: false }),
      row({ path: '/leaderboard', is_bot: false }),
      row({ path: '/wp-admin/install.php', is_bot: true, bot_reason: 'scanner_path' }),
      row({ path: '/quests', is_bot: false, referrer: 'https://www.facebook.com/x', campaign_id: 'camp-street-team-2026', qr_code_id: 'cqr-f1' }),
    ];
    expect(topPaths(rows)[0]).toEqual({ value: '/quests', count: 3 });
    expect(topReferrers(rows).find((r) => r.value === 'facebook.com')?.count).toBe(1);
    expect(topReferrers(rows).find((r) => r.value === 'direct')?.count).toBe(3);
    expect(topCampaigns(rows)[0].count).toBe(1);
  });
});

describe('Period math — the exact timestamps behind 1H | 2H | 6H | 24H | 7D', () => {
  it('every declared period is exposed', () => {
    expect(ANALYTICS_PERIODS).toEqual(['1h', '2h', '6h', '24h', '7d']);
  });

  it('a 2-hour query uses exactly now-minus-2-hours as its cutoff', () => {
    const now = new Date('2026-09-01T12:00:00.000Z');
    expect(getPeriodStart('2h', now).toISOString()).toBe('2026-09-01T10:00:00.000Z');
  });

  it('1h/6h/24h/7d all compute the correct cutoff relative to now', () => {
    const now = new Date('2026-09-01T12:00:00.000Z');
    expect(getPeriodStart('1h', now).toISOString()).toBe('2026-09-01T11:00:00.000Z');
    expect(getPeriodStart('6h', now).toISOString()).toBe('2026-09-01T06:00:00.000Z');
    expect(getPeriodStart('24h', now).toISOString()).toBe('2026-08-31T12:00:00.000Z');
    expect(getPeriodStart('7d', now).toISOString()).toBe('2026-08-25T12:00:00.000Z');
  });

  it('startOfDay zeroes the clock but keeps the calendar date', () => {
    const now = new Date('2026-09-01T17:42:33.123Z');
    const start = startOfDay(now);
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(start.getSeconds()).toBe(0);
    expect(start.getDate()).toBe(now.getDate());
  });
});

// ---------------------------------------------------------------------------
// /api/track route integration — mocked Supabase client so the real insert
// wiring (not just the pure functions above) is exercised end-to-end.
// ---------------------------------------------------------------------------

const insertedRows: Record<string, any[]> = {};

function resetInsertedRows() {
  insertedRows.site_visits = [];
  insertedRows.site_visit_events = [];
}

vi.mock('@/lib/supabase', () => {
  const mockAdmin = {
    from(table: string) {
      return {
        insert: async (row: any) => {
          insertedRows[table] = insertedRows[table] || [];
          insertedRows[table].push(row);
          return { data: row, error: null };
        },
      };
    },
  };
  return {
    supabaseAdmin: mockAdmin,
    supabase: null,
    isSupabaseAdminConfigured: true,
    isSupabaseConfigured: true,
  };
});

async function postTrack(body: Record<string, any>, headers: Record<string, string> = {}) {
  const { POST } = await import('../app/api/track/route');
  return POST(
    new Request('http://localhost/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', ...headers },
      body: JSON.stringify(body),
    })
  );
}

describe('/api/track route wiring (mocked Supabase)', () => {
  afterEach(() => {
    resetInsertedRows();
  });

  it('a normal page view inserts exactly one site_visit_events row and sets both identity cookies', async () => {
    resetInsertedRows();
    const res = await postTrack({ page: '/quests', referrer: '' });
    expect(res.cookies.get('cq_vid')?.value).toBeTruthy();
    expect(res.cookies.get('cq_sid')?.value).toBeTruthy();
    expect(insertedRows.site_visit_events).toHaveLength(1);
    expect(insertedRows.site_visit_events[0].path).toBe('/quests');
    expect(insertedRows.site_visit_events[0].is_bot).toBe(false);
  });

  it('reusing the cq_vid cookie across two requests (two page views) keeps the same visitor_id — one unique visitor, two page views', async () => {
    resetInsertedRows();
    const first = await postTrack({ page: '/' });
    const vid = first.cookies.get('cq_vid')!.value;
    const sid = first.cookies.get('cq_sid')!.value;

    await postTrack({ page: '/leaderboard' }, { cookie: `cq_vid=${vid}; cq_sid=${sid}` });

    expect(insertedRows.site_visit_events).toHaveLength(2);
    const visitorIds = new Set(insertedRows.site_visit_events.map((r) => r.visitor_id));
    expect(visitorIds.size).toBe(1);
    expect(insertedRows.site_visit_events.map((r) => r.path)).toEqual(['/', '/leaderboard']);
  });

  it('a request with no cq_vid cookie gets a freshly generated one, distinct from another visitor', async () => {
    resetInsertedRows();
    const a = await postTrack({ page: '/' });
    const b = await postTrack({ page: '/' });
    expect(insertedRows.site_visit_events[0].visitor_id).not.toBe(insertedRows.site_visit_events[1].visitor_id);
    expect(a.cookies.get('cq_vid')!.value).not.toBe(b.cookies.get('cq_vid')!.value);
  });

  it('obvious bot traffic (/wp-admin/install.php) is still stored for diagnostics but marked is_bot=true', async () => {
    resetInsertedRows();
    await postTrack({ page: '/wp-admin/install.php' });
    expect(insertedRows.site_visit_events).toHaveLength(1);
    expect(insertedRows.site_visit_events[0].is_bot).toBe(true);
    expect(insertedRows.site_visit_events[0].bot_reason).toBe('scanner_path');
  });

  it('a known crawler user agent is stored as is_bot=true', async () => {
    resetInsertedRows();
    await postTrack({ page: '/quests' }, { 'user-agent': 'Googlebot/2.1 (+http://www.google.com/bot.html)' });
    expect(insertedRows.site_visit_events[0].is_bot).toBe(true);
  });

  it('static asset / API-shaped paths reported by a client payload never create a site_visit_events row', async () => {
    resetInsertedRows();
    await postTrack({ page: '/favicon.ico' });
    await postTrack({ page: '/api/track' });
    await postTrack({ page: '/robots.txt' });
    expect(insertedRows.site_visit_events).toHaveLength(0);
  });

  it('QR/campaign attribution carried in the CAMPAIGN_ATTRIBUTION_COOKIE persists onto the inserted row', async () => {
    resetInsertedRows();
    const qrCode: CampaignQrCode = {
      id: 'cqr-canonical-f1',
      campaignId: 'camp-street-team-2026',
      flyerVariantId: 'flyer-family',
      distributorId: 'dist-dustin',
      internalName: 'test',
      destinationUrl: '/start/family',
      trackingSlug: 'f1',
      trackingUrl: 'https://www.cantonquests.com/go/f1',
      status: 'active',
      createdAt: new Date().toISOString(),
    };
    const cookieValue = createAttributionCookieValue(qrCode);
    await postTrack({ page: '/start/family' }, { cookie: `cq_campaign_attribution=${cookieValue}` });
    expect(insertedRows.site_visit_events[0].campaign_id).toBe('camp-street-team-2026');
    expect(insertedRows.site_visit_events[0].qr_code_id).toBe('cqr-canonical-f1');
    expect(insertedRows.site_visit_events[0].flyer_variant_id).toBe('flyer-family');
  });

  it('UTM params on the page querystring persist onto the inserted row', async () => {
    resetInsertedRows();
    await postTrack({ page: '/quests', search: '?utm_source=instagram&utm_campaign=launch' });
    expect(insertedRows.site_visit_events[0].utm_source).toBe('instagram');
    expect(insertedRows.site_visit_events[0].utm_campaign).toBe('launch');
  });

  it('anonymous visitors (no auth cookie) still produce a tracked row with player_id null', async () => {
    resetInsertedRows();
    await postTrack({ page: '/quests' });
    expect(insertedRows.site_visit_events[0].player_id).toBeNull();
    expect(insertedRows.site_visit_events[0].visitor_id).toBeTruthy();
  });

  it('a duplicate POST for the same visitor/session/path fired immediately (React double-mount style) does not create two rows', async () => {
    resetInsertedRows();
    const first = await postTrack({ page: '/quests' });
    const vid = first.cookies.get('cq_vid')!.value;
    const sid = first.cookies.get('cq_sid')!.value;
    await postTrack({ page: '/quests' }, { cookie: `cq_vid=${vid}; cq_sid=${sid}` });
    expect(insertedRows.site_visit_events).toHaveLength(1);
  });
});

describe('Admin analytics endpoint authorization', () => {
  it('requires admin authorization — no credentials returns 401', async () => {
    const { GET } = await import('../app/api/admin/analytics/route');
    const res = await GET(new Request('http://localhost/api/admin/analytics?period=2h'));
    expect(res.status).toBe(401);
  });

  it('a valid Game Master credential is authorized (never blocked by the auth check itself)', async () => {
    const { GET } = await import('../app/api/admin/analytics/route');
    const res = await GET(
      new Request('http://localhost/api/admin/analytics?period=2h', { headers: { 'x-admin-key': 'canton-gm-2026' } })
    );
    expect(res.status).not.toBe(401);
  });

  it('rejects an invalid admin credential', async () => {
    const { GET } = await import('../app/api/admin/analytics/route');
    const res = await GET(
      new Request('http://localhost/api/admin/analytics?period=2h', { headers: { 'x-admin-key': 'wrong-secret' } })
    );
    expect(res.status).toBe(401);
  });
});

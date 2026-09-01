// Canton Quests — First-Party Visitor Analytics
//
// Pure, dependency-free logic for the site_visit_events tracking pipeline:
// visitor/session identity, bot detection, URL attribution parsing, and the
// human-traffic aggregation semantics used by the admin analytics endpoint.
// Kept free of any Supabase/Next.js runtime imports so every rule here is
// directly unit-testable without a live database or request object.
//
// Deliberately separate from lib/qr-campaigns.ts (campaign_visits / QR
// short-link attribution) — this module tracks organic on-site page views,
// not QR redirect hits. The two systems share the CAMPAIGN_ATTRIBUTION_COOKIE
// shape so a QR-driven visit can still be attributed here once the visitor
// lands on a real page.
import crypto from 'crypto';

export const VISITOR_ID_COOKIE = 'cq_vid';
export const SESSION_ID_COOKIE = 'cq_sid';
export const VISITOR_ID_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1 year — persistent visitor identity
export const SESSION_ID_MAX_AGE_SECONDS = 60 * 30; // 30 minutes, sliding — reset on every hit so inactivity naturally expires the cookie

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function generateId(): string {
  return crypto.randomUUID();
}

function isValidId(value: string | null | undefined): value is string {
  return Boolean(value) && UUID_RE.test(value as string);
}

export interface ResolvedId {
  id: string;
  isNew: boolean;
}

/** cq_vid: reuse a valid existing cookie value, otherwise mint a new persistent visitor id. */
export function resolveVisitorId(existingCookieValue: string | null | undefined): ResolvedId {
  if (isValidId(existingCookieValue)) return { id: existingCookieValue, isNew: false };
  return { id: generateId(), isNew: true };
}

/**
 * cq_sid: reuse a valid existing cookie value, otherwise mint a new session id.
 * The ~30-minute inactivity window is enforced entirely by the cookie's own
 * maxAge (reset on every hit): once a visitor goes quiet for 30 minutes the
 * browser drops the cookie on its own, so the next hit naturally lands here
 * with no existing value and gets a fresh session — no server-side "last
 * seen" bookkeeping required.
 */
export function resolveSessionId(existingCookieValue: string | null | undefined): ResolvedId {
  if (isValidId(existingCookieValue)) return { id: existingCookieValue, isNew: false };
  return { id: generateId(), isNew: true };
}

/** Extracts one cookie's raw value from a request's `Cookie` header string. */
export function readCookie(cookieHeader: string | null | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  if (!match) return null;
  return decodeURIComponent(match.slice(name.length + 1));
}

// ---------------------------------------------------------------------------
// Trackable-path filtering — static assets, API routes, and system files
// never count as a page view, even if a malformed/forged client payload
// claims one of these paths.
// ---------------------------------------------------------------------------

const NON_PAGE_PATH_PATTERNS: RegExp[] = [
  /^\/api\//,
  /^\/_next\//,
  /^\/robots\.txt$/,
  /^\/sitemap\.xml$/,
  /^\/manifest\.(json|webmanifest)$/i,
  /^\/favicon\.ico$/,
  /^\/sw\.js$/,
  /^\/service-worker\.js$/,
  /\.(png|jpe?g|gif|svg|webp|avif|ico|css|js|mjs|map|woff2?|ttf|eot|mp4|webm|mp3|wav|pdf|xml|json|txt|zip)$/i,
];

export function isTrackablePath(rawPath: string | null | undefined): boolean {
  if (!rawPath || typeof rawPath !== 'string') return false;
  const clean = rawPath.split('?')[0].split('#')[0].trim();
  if (!clean || !clean.startsWith('/')) return false;
  if (clean.length > 300) return false;
  return !NON_PAGE_PATH_PATTERNS.some((pattern) => pattern.test(clean));
}

// ---------------------------------------------------------------------------
// Device classification (form factor only — bot-vs-human is decided by
// detectBot below, kept separate so a bot's device class can still be
// recorded for diagnostics).
// ---------------------------------------------------------------------------

export type DeviceClass = 'mobile' | 'tablet' | 'desktop' | 'unknown';

export function classifyDevice(userAgent: string | null | undefined): DeviceClass {
  const ua = (userAgent || '').toLowerCase();
  if (!ua) return 'unknown';
  if (/tablet|ipad|kindle|silk|playbook/.test(ua)) return 'tablet';
  if (/mobile|android|iphone|ipod|blackberry|windows phone|opera mini|iemobile/.test(ua)) return 'mobile';
  return 'desktop';
}

// ---------------------------------------------------------------------------
// Bot / crawler / scanner detection
// ---------------------------------------------------------------------------

const BOT_UA_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  {
    reason: 'monitoring_probe',
    pattern: /uptimerobot|pingdom|statuscake|site24x7|updown\.io|freshping|better ?uptime|healthcheck|monitor/i,
  },
  {
    reason: 'automation_tool',
    pattern:
      /curl\/|wget\/|python-requests|python-urllib|go-http-client|libwww-perl|java\/|apache-httpclient|okhttp|axios\/|node-fetch|scrapy|phantomjs|headlesschrome|puppeteer|playwright|selenium/i,
  },
  {
    reason: 'known_crawler',
    pattern:
      /googlebot|bingbot|slurp|duckduckbot|baiduspider|yandexbot|sogou|exabot|facebookexternalhit|ia_archiver|ahrefsbot|semrushbot|mj12bot|dotbot|petalbot|bytespider|gptbot|ccbot|claudebot|applebot|discordbot|telegrambot|slackbot|whatsapp/i,
  },
  { reason: 'known_crawler', pattern: /bot|crawler|spider|scraper|slurp/i },
];

// Paths that only ever show up in automated scanner/exploit traffic — Canton
// Quests is a Next.js app and has none of these routes, so a hit on any of
// them is definitionally not a real player regardless of what user agent
// string it presents.
const SCANNER_PATH_PATTERNS: RegExp[] = [
  /wp-admin|wp-login|wp-content|wp-json|wp-includes|xmlrpc\.php/i,
  /\.php$/i,
  /(^|\/)\.(env|git|aws|ssh)(\/|$)/i,
  /phpmyadmin|\bpma\b|adminer/i,
  /\bcgi-bin\b/i,
  /actuator|telescope|_profiler/i,
  /\bvendor\/phpunit\b/i,
  /hnap1|boaform/i,
  /\bid_rsa\b|\.well-known\/pki-validation|\bconfig\.json$|backup\.(zip|sql|tar\.gz)$/i,
  /%2e%2e|\.\.\//i,
];

export function isScannerPath(path: string): boolean {
  return SCANNER_PATH_PATTERNS.some((pattern) => pattern.test(path));
}

export interface BotDetectionResult {
  isBot: boolean;
  reason: string | null;
}

export function detectBot(input: { userAgent: string | null | undefined; path: string }): BotDetectionResult {
  const ua = (input.userAgent || '').trim();

  if (isScannerPath(input.path)) {
    return { isBot: true, reason: 'scanner_path' };
  }

  if (!ua) {
    return { isBot: true, reason: 'missing_user_agent' };
  }

  const lower = ua.toLowerCase();
  for (const { pattern, reason } of BOT_UA_PATTERNS) {
    if (pattern.test(lower)) {
      return { isBot: true, reason };
    }
  }

  return { isBot: false, reason: null };
}

// ---------------------------------------------------------------------------
// URL attribution — UTM params (from the page's own querystring) plus
// QR/campaign attribution carried in lib/qr-campaigns.ts's
// CAMPAIGN_ATTRIBUTION_COOKIE, when present. Never throws on a
// missing/malformed cookie — attribution is best-effort.
// ---------------------------------------------------------------------------

export interface AttributionFields {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  qrCodeId: string | null;
  flyerVariantId: string | null;
  campaignId: string | null;
}

function trimOrNull(value: string | null | undefined, max = 200): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

export function parseAttribution(input: {
  search?: string | null;
  campaignAttributionCookieValue?: string | null;
}): AttributionFields {
  let params: URLSearchParams | null = null;
  if (input.search) {
    try {
      params = new URLSearchParams(input.search.startsWith('?') ? input.search : `?${input.search}`);
    } catch {
      params = null;
    }
  }

  let qrCodeId: string | null = null;
  let flyerVariantId: string | null = null;
  let campaignId: string | null = null;

  if (input.campaignAttributionCookieValue) {
    try {
      const decoded = JSON.parse(Buffer.from(input.campaignAttributionCookieValue, 'base64url').toString('utf8'));
      qrCodeId = trimOrNull(decoded?.qrCodeId);
      flyerVariantId = trimOrNull(decoded?.flyerVariantId);
      campaignId = trimOrNull(decoded?.campaignId);
    } catch {
      // Malformed or tampered cookie value — ignore, attribution stays null.
    }
  }

  return {
    utmSource: trimOrNull(params?.get('utm_source')),
    utmMedium: trimOrNull(params?.get('utm_medium')),
    utmCampaign: trimOrNull(params?.get('utm_campaign')),
    utmContent: trimOrNull(params?.get('utm_content')),
    utmTerm: trimOrNull(params?.get('utm_term')),
    qrCodeId: trimOrNull(params?.get('qr')) || qrCodeId,
    flyerVariantId: trimOrNull(params?.get('flyer')) || flyerVariantId,
    campaignId: trimOrNull(params?.get('campaign')) || campaignId,
  };
}

// ---------------------------------------------------------------------------
// site_visit_events row assembly
// ---------------------------------------------------------------------------

export interface SiteVisitEventRow {
  visitor_id: string;
  session_id: string;
  player_id: string | null;
  event_type: string;
  path: string;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  qr_code_id: string | null;
  flyer_variant_id: string | null;
  campaign_id: string | null;
  device_class: string | null;
  user_agent_class: string | null;
  is_bot: boolean;
  bot_reason: string | null;
  created_at?: string;
}

export function buildSiteVisitEventRow(input: {
  visitorId: string;
  sessionId: string;
  playerId?: string | null;
  path: string;
  referrer?: string | null;
  userAgent?: string | null;
  userAgentClass: string;
  search?: string | null;
  campaignAttributionCookieValue?: string | null;
}): SiteVisitEventRow {
  const attribution = parseAttribution({
    search: input.search,
    campaignAttributionCookieValue: input.campaignAttributionCookieValue,
  });
  const bot = detectBot({ userAgent: input.userAgent, path: input.path });

  return {
    visitor_id: input.visitorId,
    session_id: input.sessionId,
    player_id: input.playerId || null,
    event_type: 'page_view',
    path: input.path.slice(0, 300),
    referrer: trimOrNull(input.referrer, 500),
    utm_source: attribution.utmSource,
    utm_medium: attribution.utmMedium,
    utm_campaign: attribution.utmCampaign,
    utm_content: attribution.utmContent,
    utm_term: attribution.utmTerm,
    qr_code_id: attribution.qrCodeId,
    flyer_variant_id: attribution.flyerVariantId,
    campaign_id: attribution.campaignId,
    device_class: classifyDevice(input.userAgent),
    user_agent_class: input.userAgentClass,
    is_bot: bot.isBot,
    bot_reason: bot.reason,
  };
}

// ---------------------------------------------------------------------------
// Period math — RIGHT NOW / TRAFFIC selectors (1H | 2H | 6H | 24H | 7D)
// ---------------------------------------------------------------------------

export const ANALYTICS_PERIODS = ['1h', '2h', '6h', '24h', '7d'] as const;
export type AnalyticsPeriod = (typeof ANALYTICS_PERIODS)[number];

const PERIOD_HOURS: Record<AnalyticsPeriod, number> = {
  '1h': 1,
  '2h': 2,
  '6h': 6,
  '24h': 24,
  '7d': 24 * 7,
};

export function isAnalyticsPeriod(value: string | null | undefined): value is AnalyticsPeriod {
  return Boolean(value) && (ANALYTICS_PERIODS as readonly string[]).includes(value as string);
}

export function getPeriodStart(period: AnalyticsPeriod, now: Date = new Date()): Date {
  return new Date(now.getTime() - PERIOD_HOURS[period] * 60 * 60 * 1000);
}

export function startOfDay(now: Date = new Date()): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ---------------------------------------------------------------------------
// Human-traffic aggregation — the single source of truth for what "unique
// visitors" / "page views" / "sessions" mean across the whole app.
//
//   unique visitors = COUNT(DISTINCT visitor_id) WHERE is_bot = false
//   page views      = COUNT(*)                   WHERE is_bot = false AND event_type = 'page_view'
//   sessions        = COUNT(DISTINCT session_id)  WHERE is_bot = false
//
// These functions operate on plain row arrays (already filtered to the
// desired time window by the caller) so they can run identically against
// rows fetched from Supabase in production or literal fixtures in tests.
// ---------------------------------------------------------------------------

export interface HumanTrafficSummary {
  uniqueVisitors: number;
  pageViews: number;
  sessions: number;
  authenticatedPlayers: number;
}

function humanPageViews(rows: SiteVisitEventRow[]): SiteVisitEventRow[] {
  return rows.filter((row) => !row.is_bot && row.event_type === 'page_view');
}

export function summarizeHumanTraffic(rows: SiteVisitEventRow[]): HumanTrafficSummary {
  const human = humanPageViews(rows);
  return {
    uniqueVisitors: new Set(human.map((row) => row.visitor_id)).size,
    pageViews: human.length,
    sessions: new Set(human.map((row) => row.session_id)).size,
    authenticatedPlayers: new Set(human.filter((row) => row.player_id).map((row) => row.player_id as string)).size,
  };
}

export interface NewVsReturningSummary {
  newVisitors: number;
  returningVisitors: number;
}

/**
 * `historyRows` must include every human page_view for each visitor seen
 * during `[todayStartIso, now]` — i.e. a lookback window, not just today's
 * rows — so each visitor's true first-ever appearance can be determined.
 */
export function summarizeNewVsReturning(historyRows: SiteVisitEventRow[], todayStartIso: string): NewVsReturningSummary {
  const human = humanPageViews(historyRows);
  const firstSeenByVisitor = new Map<string, string>();
  for (const row of human) {
    if (!row.created_at) continue;
    const existing = firstSeenByVisitor.get(row.visitor_id);
    if (!existing || row.created_at < existing) {
      firstSeenByVisitor.set(row.visitor_id, row.created_at);
    }
  }

  const todayVisitorIds = new Set(
    human.filter((row) => (row.created_at || '') >= todayStartIso).map((row) => row.visitor_id)
  );

  let newVisitors = 0;
  let returningVisitors = 0;
  for (const visitorId of todayVisitorIds) {
    const firstSeen = firstSeenByVisitor.get(visitorId);
    if (firstSeen && firstSeen >= todayStartIso) newVisitors += 1;
    else returningVisitors += 1;
  }

  return { newVisitors, returningVisitors };
}

export interface HourlyBucket {
  hour: string; // ISO hour, e.g. 2026-09-01T14:00:00.000Z
  uniqueVisitors: number;
  pageViews: number;
}

export function hourlyBuckets(rows: SiteVisitEventRow[]): HourlyBucket[] {
  const human = humanPageViews(rows);
  const buckets = new Map<string, { visitors: Set<string>; pageViews: number }>();
  for (const row of human) {
    if (!row.created_at) continue;
    const hourKey = row.created_at.slice(0, 13); // YYYY-MM-DDTHH
    if (!buckets.has(hourKey)) buckets.set(hourKey, { visitors: new Set(), pageViews: 0 });
    const bucket = buckets.get(hourKey)!;
    bucket.visitors.add(row.visitor_id);
    bucket.pageViews += 1;
  }
  return Array.from(buckets.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([hourKey, bucket]) => ({
      hour: `${hourKey}:00:00.000Z`,
      uniqueVisitors: bucket.visitors.size,
      pageViews: bucket.pageViews,
    }));
}

export interface TopCount {
  value: string;
  count: number;
}

export function topPaths(rows: SiteVisitEventRow[], limit = 10): TopCount[] {
  const human = humanPageViews(rows);
  const counts = new Map<string, number>();
  for (const row of human) {
    counts.set(row.path, (counts.get(row.path) || 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

function hostnameOrDirect(referrer: string | null): string {
  if (!referrer) return 'direct';
  try {
    return new URL(referrer).hostname.replace(/^www\./, '') || 'direct';
  } catch {
    return 'direct';
  }
}

export function topReferrers(rows: SiteVisitEventRow[], limit = 10): TopCount[] {
  const human = humanPageViews(rows);
  const counts = new Map<string, number>();
  for (const row of human) {
    const value = hostnameOrDirect(row.referrer);
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

/** Label precedence: campaign_id/qr_code_id attribution, then utm_campaign/utm_source, else excluded (organic). */
function campaignLabel(row: SiteVisitEventRow): string | null {
  if (row.campaign_id && row.qr_code_id) return `${row.campaign_id} / ${row.qr_code_id}`;
  if (row.qr_code_id) return `QR: ${row.qr_code_id}`;
  if (row.campaign_id) return row.campaign_id;
  if (row.utm_campaign) return row.utm_source ? `${row.utm_source} / ${row.utm_campaign}` : row.utm_campaign;
  if (row.utm_source) return row.utm_source;
  return null;
}

export function topCampaigns(rows: SiteVisitEventRow[], limit = 10): TopCount[] {
  const human = humanPageViews(rows);
  const counts = new Map<string, number>();
  for (const row of human) {
    const label = campaignLabel(row);
    if (!label) continue;
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

import crypto from 'crypto';
import { supabaseAdmin, isSupabaseAdminConfigured } from './supabase';
import {
  CampaignAnalytics,
  CampaignBundle,
  CampaignDistributor,
  CampaignEntityStatus,
  CampaignFlyerVariant,
  CampaignQrCode,
  CampaignVisit,
  QrCampaign,
} from './types';

export const CAMPAIGN_ATTRIBUTION_COOKIE = 'cq_campaign_attribution';
export const CAMPAIGN_VISITOR_COOKIE = 'cq_campaign_visitor';

const DEFAULT_DESTINATION = '/quests';
const VISIT_DEDUPE_WINDOW_MS = 10_000;

const campaignStore: CampaignBundle = {
  campaigns: [],
  flyerVariants: [],
  distributors: [],
  qrCodes: [],
  visits: [],
};

const recentVisitKeys = new Map<string, number>();

interface CampaignRow {
  id: string;
  name: string;
  slug: string;
  destination_url: string;
  description?: string | null;
  notes?: string | null;
  status: CampaignEntityStatus;
  created_at: string;
  updated_at: string;
}

interface FlyerRow {
  id: string;
  campaign_id: string;
  name: string;
  description?: string | null;
  notes?: string | null;
  status: CampaignEntityStatus;
  created_at: string;
}

interface DistributorRow {
  id: string;
  campaign_id: string;
  name: string;
  notes?: string | null;
  status: CampaignEntityStatus;
  created_at: string;
}

interface QrRow {
  id: string;
  campaign_id: string;
  flyer_variant_id: string;
  distributor_id: string;
  internal_name: string;
  destination_url: string;
  tracking_slug: string;
  status: CampaignEntityStatus;
  created_at: string;
}

interface VisitRow {
  id: string;
  campaign_id: string;
  flyer_variant_id: string;
  distributor_id: string;
  qr_code_id: string;
  destination_url: string;
  anonymous_visitor_id: string;
  referrer?: string | null;
  user_agent_class?: string | null;
  created_at: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

function makeTrackingSlug(campaignName: string, flyerName: string, distributorName: string): string {
  const base = slugify(`${campaignName}-${flyerName}-${distributorName}`) || 'campaign';
  return `${base}-${crypto.randomBytes(3).toString('hex')}`;
}

export function getCampaignPublicBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined) ||
    'https://www.divinedesigndestinations.com'
  );
}

function toAbsoluteDestination(destinationUrl?: string): string {
  const trimmed = (destinationUrl || DEFAULT_DESTINATION).trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function trackingUrlForSlug(slug: string): string {
  return `${getCampaignPublicBaseUrl().replace(/\/$/, '')}/go/${slug}`;
}

export function classifyUserAgent(userAgent?: string | null): string {
  const ua = (userAgent || '').toLowerCase();
  if (!ua) return 'unknown';
  if (/bot|crawler|spider|preview|slurp/.test(ua)) return 'bot_or_preview';
  if (/mobile|iphone|android/.test(ua)) return 'mobile';
  if (/ipad|tablet/.test(ua)) return 'tablet';
  return 'desktop';
}

function mapCampaign(row: CampaignRow): QrCampaign {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    destinationUrl: row.destination_url,
    description: row.description || undefined,
    notes: row.notes || undefined,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapFlyer(row: FlyerRow): CampaignFlyerVariant {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    name: row.name,
    description: row.description || undefined,
    notes: row.notes || undefined,
    status: row.status,
    createdAt: row.created_at,
  };
}

function mapDistributor(row: DistributorRow): CampaignDistributor {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    name: row.name,
    notes: row.notes || undefined,
    status: row.status,
    createdAt: row.created_at,
  };
}

function mapQr(row: QrRow): CampaignQrCode {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    flyerVariantId: row.flyer_variant_id,
    distributorId: row.distributor_id,
    internalName: row.internal_name,
    destinationUrl: row.destination_url,
    trackingSlug: row.tracking_slug,
    trackingUrl: trackingUrlForSlug(row.tracking_slug),
    status: row.status,
    createdAt: row.created_at,
  };
}

function mapVisit(row: VisitRow): CampaignVisit {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    flyerVariantId: row.flyer_variant_id,
    distributorId: row.distributor_id,
    qrCodeId: row.qr_code_id,
    destinationUrl: row.destination_url,
    anonymousVisitorId: row.anonymous_visitor_id,
    referrer: row.referrer || undefined,
    userAgentClass: row.user_agent_class || undefined,
    createdAt: row.created_at,
  };
}

async function trySupabaseBundle(): Promise<CampaignBundle | undefined> {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return undefined;
  const [campaigns, flyers, distributors, qrs, visits] = await Promise.all([
    supabaseAdmin.from('qr_campaigns').select('*').order('created_at', { ascending: false }),
    supabaseAdmin.from('campaign_flyer_variants').select('*').order('created_at', { ascending: true }),
    supabaseAdmin.from('campaign_distributors').select('*').order('created_at', { ascending: true }),
    supabaseAdmin.from('campaign_qr_codes').select('*').order('created_at', { ascending: true }),
    supabaseAdmin.from('campaign_visits').select('*').order('created_at', { ascending: false }),
  ]);

  if (campaigns.error || flyers.error || distributors.error || qrs.error || visits.error) return undefined;
  return {
    campaigns: ((campaigns.data || []) as CampaignRow[]).map(mapCampaign),
    flyerVariants: ((flyers.data || []) as FlyerRow[]).map(mapFlyer),
    distributors: ((distributors.data || []) as DistributorRow[]).map(mapDistributor),
    qrCodes: ((qrs.data || []) as QrRow[]).map(mapQr),
    visits: ((visits.data || []) as VisitRow[]).map(mapVisit),
  };
}

export async function getCampaignBundle(): Promise<CampaignBundle> {
  return (await trySupabaseBundle()) || campaignStore;
}

export function resetCampaignStore(): void {
  campaignStore.campaigns = [];
  campaignStore.flyerVariants = [];
  campaignStore.distributors = [];
  campaignStore.qrCodes = [];
  campaignStore.visits = [];
  recentVisitKeys.clear();
}

export async function createQrCampaign(input: {
  name: string;
  destinationUrl?: string;
  description?: string;
  notes?: string;
  status?: CampaignEntityStatus;
}): Promise<QrCampaign> {
  const name = input.name.trim();
  if (!name) throw new Error('Campaign name is required.');
  const createdAt = nowIso();
  const campaign: QrCampaign = {
    id: makeId('camp'),
    name,
    slug: slugify(name) || makeId('campaign'),
    destinationUrl: toAbsoluteDestination(input.destinationUrl),
    description: input.description?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    status: input.status || 'active',
    createdAt,
    updatedAt: createdAt,
  };

  if (isSupabaseAdminConfigured && supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('qr_campaigns')
      .insert({
        id: campaign.id,
        name: campaign.name,
        slug: campaign.slug,
        destination_url: campaign.destinationUrl,
        description: campaign.description,
        notes: campaign.notes,
        status: campaign.status,
        created_at: campaign.createdAt,
        updated_at: campaign.updatedAt,
      })
      .select('*')
      .single();
    if (!error && data) return mapCampaign(data);
  }

  campaignStore.campaigns.unshift(campaign);
  return campaign;
}

export async function createCampaignFlyerVariant(input: {
  campaignId: string;
  name: string;
  description?: string;
  notes?: string;
  status?: CampaignEntityStatus;
}): Promise<CampaignFlyerVariant> {
  const name = input.name.trim();
  if (!name) throw new Error('Flyer variant name is required.');
  const flyer: CampaignFlyerVariant = {
    id: makeId('flyer'),
    campaignId: input.campaignId,
    name,
    description: input.description?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    status: input.status || 'active',
    createdAt: nowIso(),
  };

  if (isSupabaseAdminConfigured && supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('campaign_flyer_variants')
      .insert({
        id: flyer.id,
        campaign_id: flyer.campaignId,
        name: flyer.name,
        description: flyer.description,
        notes: flyer.notes,
        status: flyer.status,
        created_at: flyer.createdAt,
      })
      .select('*')
      .single();
    if (!error && data) return mapFlyer(data);
  }

  campaignStore.flyerVariants.push(flyer);
  return flyer;
}

export async function createCampaignDistributor(input: {
  campaignId: string;
  name: string;
  notes?: string;
  status?: CampaignEntityStatus;
}): Promise<CampaignDistributor> {
  const name = input.name.trim();
  if (!name) throw new Error('Distributor name is required.');
  const distributor: CampaignDistributor = {
    id: makeId('dist'),
    campaignId: input.campaignId,
    name,
    notes: input.notes?.trim() || undefined,
    status: input.status || 'active',
    createdAt: nowIso(),
  };

  if (isSupabaseAdminConfigured && supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('campaign_distributors')
      .insert({
        id: distributor.id,
        campaign_id: distributor.campaignId,
        name: distributor.name,
        notes: distributor.notes,
        status: distributor.status,
        created_at: distributor.createdAt,
      })
      .select('*')
      .single();
    if (!error && data) return mapDistributor(data);
  }

  campaignStore.distributors.push(distributor);
  return distributor;
}

export async function generateCampaignQrCodes(input: {
  campaignId: string;
  flyerVariantIds: string[];
  distributorIds: string[];
  destinationUrlByFlyerVariantId?: Record<string, string>;
}): Promise<CampaignQrCode[]> {
  const bundle = await getCampaignBundle();
  const campaign = bundle.campaigns.find((item) => item.id === input.campaignId);
  if (!campaign) throw new Error('Campaign not found.');

  const flyers = bundle.flyerVariants.filter(
    (item) => input.flyerVariantIds.includes(item.id) && item.campaignId === campaign.id && item.status === 'active'
  );
  const distributors = bundle.distributors.filter(
    (item) => input.distributorIds.includes(item.id) && item.campaignId === campaign.id && item.status === 'active'
  );

  const created: CampaignQrCode[] = [];
  for (const flyer of flyers) {
    for (const distributor of distributors) {
      const destinationUrl = toAbsoluteDestination(input.destinationUrlByFlyerVariantId?.[flyer.id] || campaign.destinationUrl);
      const existing = bundle.qrCodes.find(
        (item) =>
          item.campaignId === campaign.id &&
          item.flyerVariantId === flyer.id &&
          item.distributorId === distributor.id
      );
      if (existing) {
        if (existing.destinationUrl !== destinationUrl) {
          existing.destinationUrl = destinationUrl;
          if (isSupabaseAdminConfigured && supabaseAdmin) {
            await supabaseAdmin
              .from('campaign_qr_codes')
              .update({ destination_url: destinationUrl })
              .eq('id', existing.id);
          }
        }
        created.push(existing);
        continue;
      }

      const trackingSlug = makeTrackingSlug(campaign.name, flyer.name, distributor.name);
      const qr: CampaignQrCode = {
        id: makeId('cqr'),
        campaignId: campaign.id,
        flyerVariantId: flyer.id,
        distributorId: distributor.id,
        internalName: `${campaign.name} / ${flyer.name} / ${distributor.name}`,
        destinationUrl,
        trackingSlug,
        trackingUrl: trackingUrlForSlug(trackingSlug),
        status: 'active',
        createdAt: nowIso(),
      };

      if (isSupabaseAdminConfigured && supabaseAdmin) {
        const { data, error } = await supabaseAdmin
          .from('campaign_qr_codes')
          .insert({
            id: qr.id,
            campaign_id: qr.campaignId,
            flyer_variant_id: qr.flyerVariantId,
            distributor_id: qr.distributorId,
            internal_name: qr.internalName,
            destination_url: qr.destinationUrl,
            tracking_slug: qr.trackingSlug,
            status: qr.status,
            created_at: qr.createdAt,
          })
          .select('*')
          .single();
        if (!error && data) {
          created.push(mapQr(data));
          continue;
        }
      }

      campaignStore.qrCodes.push(qr);
      created.push(qr);
    }
  }

  return created;
}

export async function resolveCampaignQrCode(slug: string): Promise<CampaignQrCode | undefined> {
  const cleanSlug = slug.trim().toLowerCase();
  if (!/^[a-z0-9-]{6,120}$/.test(cleanSlug)) return undefined;
  const bundle = await getCampaignBundle();
  const qr = bundle.qrCodes.find((item) => item.trackingSlug === cleanSlug && item.status === 'active');
  const campaign = qr ? bundle.campaigns.find((item) => item.id === qr.campaignId && item.status === 'active') : undefined;
  return campaign ? qr : undefined;
}

export async function setCampaignQrCodeStatus(qrCodeId: string, status: CampaignEntityStatus): Promise<CampaignQrCode | undefined> {
  if (isSupabaseAdminConfigured && supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('campaign_qr_codes')
      .update({ status })
      .eq('id', qrCodeId)
      .select('*')
      .single();
    if (!error && data) return mapQr(data);
  }

  const qr = campaignStore.qrCodes.find((item) => item.id === qrCodeId);
  if (!qr) return undefined;
  qr.status = status;
  return qr;
}

export async function recordCampaignVisit(input: {
  trackingSlug: string;
  anonymousVisitorId: string;
  referrer?: string | null;
  userAgent?: string | null;
  at?: Date;
}): Promise<{ qrCode?: CampaignQrCode; visit?: CampaignVisit; rateLimited: boolean }> {
  const qrCode = await resolveCampaignQrCode(input.trackingSlug);
  if (!qrCode) return { rateLimited: false };

  const at = input.at || new Date();
  const dedupeKey = `${qrCode.id}:${input.anonymousVisitorId}`;
  const lastVisit = recentVisitKeys.get(dedupeKey);
  if (lastVisit && at.getTime() - lastVisit < VISIT_DEDUPE_WINDOW_MS) {
    return { qrCode, rateLimited: true };
  }
  recentVisitKeys.set(dedupeKey, at.getTime());

  const visit: CampaignVisit = {
    id: makeId('visit'),
    campaignId: qrCode.campaignId,
    flyerVariantId: qrCode.flyerVariantId,
    distributorId: qrCode.distributorId,
    qrCodeId: qrCode.id,
    destinationUrl: qrCode.destinationUrl,
    anonymousVisitorId: input.anonymousVisitorId,
    referrer: input.referrer || undefined,
    userAgentClass: classifyUserAgent(input.userAgent),
    createdAt: at.toISOString(),
  };

  if (isSupabaseAdminConfigured && supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('campaign_visits')
      .insert({
        id: visit.id,
        campaign_id: visit.campaignId,
        flyer_variant_id: visit.flyerVariantId,
        distributor_id: visit.distributorId,
        qr_code_id: visit.qrCodeId,
        destination_url: visit.destinationUrl,
        anonymous_visitor_id: visit.anonymousVisitorId,
        referrer: visit.referrer,
        user_agent_class: visit.userAgentClass,
        created_at: visit.createdAt,
      })
      .select('*')
      .single();
    if (!error && data) return { qrCode, visit: mapVisit(data), rateLimited: false };
  }

  campaignStore.visits.push(visit);
  return { qrCode, visit, rateLimited: false };
}

function countUnique(visits: CampaignVisit[]): number {
  return new Set(visits.map((visit) => visit.anonymousVisitorId)).size;
}

function groupVisitsByDestination(visits: CampaignVisit[]) {
  const destinations = Array.from(new Set(visits.map((visit) => visit.destinationUrl))).sort();
  return destinations.map((destination) => {
    const destinationVisits = visits.filter((visit) => visit.destinationUrl === destination);
    return {
      id: destination,
      label: destination,
      visits: destinationVisits.length,
      uniqueVisitors: countUnique(destinationVisits),
    };
  });
}

export async function getCampaignAnalytics(campaignId: string): Promise<CampaignAnalytics> {
  const bundle = await getCampaignBundle();
  const campaignVisits = bundle.visits.filter((visit) => visit.campaignId === campaignId);
  const campaignQrs = bundle.qrCodes.filter((qr) => qr.campaignId === campaignId);
  const flyers = bundle.flyerVariants.filter((flyer) => flyer.campaignId === campaignId);
  const distributors = bundle.distributors.filter((distributor) => distributor.campaignId === campaignId);

  return {
    campaignId,
    totalVisits: campaignVisits.length,
    uniqueVisitors: countUnique(campaignVisits),
    activeQrCodes: campaignQrs.filter((qr) => qr.status === 'active').length,
    flyerPerformance: flyers.map((flyer) => {
      const visits = campaignVisits.filter((visit) => visit.flyerVariantId === flyer.id);
      return { id: flyer.id, label: flyer.name, visits: visits.length, uniqueVisitors: countUnique(visits) };
    }),
    distributorPerformance: distributors.map((distributor) => {
      const visits = campaignVisits.filter((visit) => visit.distributorId === distributor.id);
      return { id: distributor.id, label: distributor.name, visits: visits.length, uniqueVisitors: countUnique(visits) };
    }),
    destinationPerformance: groupVisitsByDestination(campaignVisits),
    combinationPerformance: campaignQrs.map((qr) => {
      const flyer = flyers.find((item) => item.id === qr.flyerVariantId);
      const distributor = distributors.find((item) => item.id === qr.distributorId);
      const visits = campaignVisits.filter((visit) => visit.qrCodeId === qr.id);
      return {
        qrCodeId: qr.id,
        flyerVariantId: qr.flyerVariantId,
        distributorId: qr.distributorId,
        label: `${flyer?.name || 'Unknown Flyer'} / ${distributor?.name || 'Unknown Distributor'}`,
        trackingSlug: qr.trackingSlug,
        visits: visits.length,
        uniqueVisitors: countUnique(visits),
      };
    }),
  };
}

export function createAnonymousVisitorId(): string {
  return `anon-${crypto.randomBytes(12).toString('hex')}`;
}

export function createAttributionCookieValue(qrCode: CampaignQrCode): string {
  return Buffer.from(
    JSON.stringify({
      campaignId: qrCode.campaignId,
      flyerVariantId: qrCode.flyerVariantId,
      distributorId: qrCode.distributorId,
      qrCodeId: qrCode.id,
      trackingSlug: qrCode.trackingSlug,
      attributedAt: nowIso(),
    })
  ).toString('base64url');
}

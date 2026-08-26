import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

(globalThis as any).React = React;
import { GET as trackingGet } from '../app/go/[slug]/route';
import FamilyLanding from '../components/landing/FamilyLanding';
import ChallengeLanding from '../components/landing/ChallengeLanding';
import SecretLanding from '../components/landing/SecretLanding';
import {
  ACQUISITION_ENTRY_HREF,
  ACQUISITION_LANDING_DESTINATION_PRESETS,
  acquisitionLandingPages,
} from '../lib/acquisition-landing-content';
import {
  CAMPAIGN_ATTRIBUTION_COOKIE,
  CAMPAIGN_VISITOR_COOKIE,
  CANONICAL_DISTRIBUTORS,
  CANONICAL_FLYERS,
  CANONICAL_QR_CODES,
  CANONICAL_SHORT_SLUGS,
  CANONICAL_STREET_TEAM_CAMPAIGN,
  createCampaignDistributor,
  createCampaignFlyerVariant,
  createQrCampaign,
  ensureCanonicalStreetTeamInStore,
  ensureCanonicalStreetTeamInSupabase,
  generateCampaignQrCodes,
  getCampaignAnalytics,
  getCampaignBundle,
  recordCampaignVisit,
  resetCampaignStore,
  resolveCampaignQrCode,
} from '../lib/qr-campaigns';

function repoFile(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

async function createAcquisitionSplitCampaign(destinationUrl: string, flyerName = 'Secret') {
  const campaign = await createQrCampaign({
    name: 'Canton Quests Street Team 2026',
    destinationUrl,
    notes: 'Internal attribution test campaign',
  });
  const flyer = await createCampaignFlyerVariant({ campaignId: campaign.id, name: flyerName });
  const distributor = await createCampaignDistributor({ campaignId: campaign.id, name: 'Distributor A' });
  const [qr] = await generateCampaignQrCodes({
    campaignId: campaign.id,
    flyerVariantIds: [flyer.id],
    distributorIds: [distributor.id],
  });
  return { campaign, flyer, distributor, qr };
}

describe('Canton Quests QR Campaign Landing Pages & Attribution Verification', () => {
  beforeEach(() => {
    resetCampaignStore();
    vi.restoreAllMocks();
  });

  it('1. /start/family renders properly with primary headline and START THE FAMILY QUEST CTA', () => {
    expect(existsSync(join(process.cwd(), 'app/start/family/page.tsx'))).toBe(true);
    expect(existsSync(join(process.cwd(), 'components/landing/FamilyLanding.tsx'))).toBe(true);
    expect(acquisitionLandingPages.family.headline).toBe('TURN CANTON INTO YOUR PLAYGROUND');
    expect(acquisitionLandingPages.family.cta).toBe('START THE FAMILY QUEST');

    const html = renderToStaticMarkup(React.createElement(FamilyLanding));
    expect(html).toContain('TURN CANTON INTO YOUR PLAYGROUND');
    expect(html).toContain('START THE FAMILY QUEST');
    expect(html).toContain('ALL-AGES CITY ADVENTURE');
    expect(html).toContain('ROLES FOR PARENTS, KIDS &amp; FRIENDS');
    expect(html).toContain('cq-fair-family');
    expect(html).toContain('href="/events/canton-weekend-1/quests"');
  });

  it('2. /start/challenge renders properly with primary headline and ACCEPT THE CHALLENGE CTA', () => {
    expect(existsSync(join(process.cwd(), 'app/start/challenge/page.tsx'))).toBe(true);
    expect(existsSync(join(process.cwd(), 'components/landing/ChallengeLanding.tsx'))).toBe(true);
    expect(acquisitionLandingPages.challenge.headline).toBe('THINK YOU CAN BEAT CANTON?');
    expect(acquisitionLandingPages.challenge.cta).toBe('ACCEPT THE CHALLENGE');

    const html = renderToStaticMarkup(React.createElement(ChallengeLanding));
    expect(html).toContain('THINK YOU CAN BEAT CANTON?');
    expect(html).toContain('ACCEPT THE CHALLENGE');
    expect(html).toContain('THE TACTICAL SCORING MATRIX');
    expect(html).toContain('COMPETITIVE INTEGRITY GUARANTEE');
    expect(html).toContain('cq-fair-challenge');
    expect(html).toContain('href="/events/canton-weekend-1/quests"');
    expect(html).not.toContain('15 mph');
    expect(html).not.toContain('Moving faster than 15 mph programmatically locks');
  });

  it('3. /start/secret renders properly with unlisted entry point concept and ENTER THE QUEST CTA', () => {
    expect(existsSync(join(process.cwd(), 'app/start/secret/page.tsx'))).toBe(true);
    expect(existsSync(join(process.cwd(), 'components/landing/SecretLanding.tsx'))).toBe(true);
    expect(acquisitionLandingPages.secret.headline).toBe('YOU FOUND AN UNLISTED ENTRY POINT.');
    expect(acquisitionLandingPages.secret.cta).toBe('ENTER THE QUEST');

    const html = renderToStaticMarkup(React.createElement(SecretLanding));
    expect(html).toContain('YOU FOUND AN UNLISTED ENTRY POINT.');
    expect(html).toContain('Most players enter Canton Quests through the front door.');
    expect(html).toContain('ENTER THE QUEST');
    expect(html).toContain('THE UNLISTED CANTON DOSSIERS');
    expect(html).toContain('cq-fair-secret');
    expect(html).toContain('href="/events/canton-weekend-1/quests"');
  });

  it('4. all landing page CTAs point to legitimate playable routes (/events/canton-weekend-1/quests) with zero dead ends', () => {
    expect(ACQUISITION_ENTRY_HREF).toBe('/events/canton-weekend-1/quests');
    expect(existsSync(join(process.cwd(), 'app/events/[slug]/quests/page.tsx'))).toBe(true);

    const familyHtml = renderToStaticMarkup(React.createElement(FamilyLanding));
    const challengeHtml = renderToStaticMarkup(React.createElement(ChallengeLanding));
    const secretHtml = renderToStaticMarkup(React.createElement(SecretLanding));

    expect(familyHtml).toContain(`href="${ACQUISITION_ENTRY_HREF}"`);
    expect(challengeHtml).toContain(`href="${ACQUISITION_ENTRY_HREF}"`);
    expect(secretHtml).toContain(`href="${ACQUISITION_ENTRY_HREF}"`);
  });

  it('5. Family, Challenge, and Secret pages have distinct layouts, themes, and design personalities', () => {
    const familyHtml = renderToStaticMarkup(React.createElement(FamilyLanding));
    const challengeHtml = renderToStaticMarkup(React.createElement(ChallengeLanding));
    const secretHtml = renderToStaticMarkup(React.createElement(SecretLanding));

    // Distinct themes and classes
    expect(familyHtml).toContain('cq-fair-family');
    expect(challengeHtml).toContain('cq-fair-challenge');
    expect(secretHtml).toContain('cq-fair-secret');

    // Distinct components and features
    expect(familyHtml).toContain('ROLES FOR PARENTS, KIDS &amp; FRIENDS');
    expect(challengeHtml).toContain('THE TACTICAL SCORING MATRIX');
    expect(secretHtml).toContain('INITIAL COORDINATE DECRYPTION');

    // Mobile start bars present with distinct labels
    expect(familyHtml).toContain('START THE FAMILY QUEST');
    expect(challengeHtml).toContain('ACCEPT THE CHALLENGE');
    expect(secretHtml).toContain('ENTER THE QUEST');
  });

  it('6. /go/f1, /go/f2, /go/f3 resolve correctly to /start/family and set attribution cookies', async () => {
    for (const slug of ['f1', 'f2', 'f3']) {
      const qr = await resolveCampaignQrCode(slug);
      expect(qr).toBeDefined();
      expect(qr?.destinationUrl).toBe('/start/family');
      expect(qr?.status).toBe('active');

      const response = await trackingGet(new Request(`https://example.test/go/${slug}`), {
        params: { slug },
      });
      expect(response.headers.get('location')).toBe('https://example.test/start/family');
      expect(response.headers.get('set-cookie')).toContain(CAMPAIGN_ATTRIBUTION_COOKIE);
      expect(response.headers.get('set-cookie')).toContain(CAMPAIGN_VISITOR_COOKIE);

      // Verify attribution cookie payload contains correct slug
      const cookieHeader = response.headers.get('set-cookie') || '';
      const match = cookieHeader.match(new RegExp(`${CAMPAIGN_ATTRIBUTION_COOKIE}=([^;]+)`));
      expect(match).toBeTruthy();
      if (match) {
        const decoded = JSON.parse(Buffer.from(match[1], 'base64url').toString('utf8'));
        expect(decoded.trackingSlug).toBe(slug);
        expect(decoded.flyerVariantId).toBe('flyer-family');
      }
    }
  });

  it('7. /go/c1, /go/c2, /go/c3 resolve correctly to /start/challenge and set attribution cookies', async () => {
    for (const slug of ['c1', 'c2', 'c3']) {
      const qr = await resolveCampaignQrCode(slug);
      expect(qr).toBeDefined();
      expect(qr?.destinationUrl).toBe('/start/challenge');
      expect(qr?.status).toBe('active');

      const response = await trackingGet(new Request(`https://example.test/go/${slug}`), {
        params: { slug },
      });
      expect(response.headers.get('location')).toBe('https://example.test/start/challenge');
      expect(response.headers.get('set-cookie')).toContain(CAMPAIGN_ATTRIBUTION_COOKIE);
      expect(response.headers.get('set-cookie')).toContain(CAMPAIGN_VISITOR_COOKIE);

      const cookieHeader = response.headers.get('set-cookie') || '';
      const match = cookieHeader.match(new RegExp(`${CAMPAIGN_ATTRIBUTION_COOKIE}=([^;]+)`));
      expect(match).toBeTruthy();
      if (match) {
        const decoded = JSON.parse(Buffer.from(match[1], 'base64url').toString('utf8'));
        expect(decoded.trackingSlug).toBe(slug);
        expect(decoded.flyerVariantId).toBe('flyer-challenge');
      }
    }
  });

  it('8. /go/s1, /go/s2, /go/s3 resolve correctly to /start/secret and set attribution cookies', async () => {
    for (const slug of ['s1', 's2', 's3']) {
      const qr = await resolveCampaignQrCode(slug);
      expect(qr).toBeDefined();
      expect(qr?.destinationUrl).toBe('/start/secret');
      expect(qr?.status).toBe('active');

      const response = await trackingGet(new Request(`https://example.test/go/${slug}`), {
        params: { slug },
      });
      expect(response.headers.get('location')).toBe('https://example.test/start/secret');
      expect(response.headers.get('set-cookie')).toContain(CAMPAIGN_ATTRIBUTION_COOKIE);
      expect(response.headers.get('set-cookie')).toContain(CAMPAIGN_VISITOR_COOKIE);

      const cookieHeader = response.headers.get('set-cookie') || '';
      const match = cookieHeader.match(new RegExp(`${CAMPAIGN_ATTRIBUTION_COOKIE}=([^;]+)`));
      expect(match).toBeTruthy();
      if (match) {
        const decoded = JSON.parse(Buffer.from(match[1], 'base64url').toString('utf8'));
        expect(decoded.trackingSlug).toBe(slug);
        expect(decoded.flyerVariantId).toBe('flyer-secret');
      }
    }
  });

  it('9. rendered landing page HTML does NOT visibly display employee or internal distributor names', () => {
    const familyHtml = renderToStaticMarkup(React.createElement(FamilyLanding));
    const challengeHtml = renderToStaticMarkup(React.createElement(ChallengeLanding));
    const secretHtml = renderToStaticMarkup(React.createElement(SecretLanding));

    for (const html of [familyHtml, challengeHtml, secretHtml]) {
      expect(html).not.toContain('Dustin');
      expect(html).not.toContain('Employee 1');
      expect(html).not.toContain('Employee 2');
      expect(html).not.toContain('camp-street-team-2026');
      expect(html).not.toContain('dist-dustin');
      expect(html).not.toContain('dist-emp-1');
      expect(html).not.toContain('cqr-canonical-');
    }
  });

  it('10. secret page references real game dossiers without exposing secret target codes or GM notes', () => {
    const secret = JSON.stringify(acquisitionLandingPages.secret);
    expect(secret).toContain("THE FOUNDER'S THREE LOCKS");
    expect(secret).toContain("FRANKENSTEIN'S QUIET SIGNAL");
    expect(secret).not.toContain('targetCode');
    expect(secret).not.toContain('gmNotes');
    expect(secret).not.toContain('proofRequirement');
    expect(secret).not.toContain('quest-proof-secrets');
  });

  it('11. QR campaign destination presets include the three landing routes', async () => {
    expect(ACQUISITION_LANDING_DESTINATION_PRESETS.map((preset) => preset.path)).toEqual([
      '/start/family',
      '/start/challenge',
      '/start/secret',
    ]);

    for (const preset of ACQUISITION_LANDING_DESTINATION_PRESETS) {
      const { qr } = await createAcquisitionSplitCampaign(preset.path, preset.label);
      expect(qr.destinationUrl).toBe(preset.path);
    }
  });

  it('12. QR tracking analytics record attribution independently for distinct slugs with rate limiting', async () => {
    const { campaign } = await createAcquisitionSplitCampaign('/start/family', 'Family');

    await recordCampaignVisit({ trackingSlug: 'f1', anonymousVisitorId: 'vis-1' });
    await recordCampaignVisit({ trackingSlug: 'f2', anonymousVisitorId: 'vis-2' });
    await recordCampaignVisit({ trackingSlug: 'c1', anonymousVisitorId: 'vis-3' });
    await recordCampaignVisit({ trackingSlug: 's1', anonymousVisitorId: 'vis-4' });

    // Deduplication check
    const deduped = await recordCampaignVisit({ trackingSlug: 'f1', anonymousVisitorId: 'vis-1' });
    expect(deduped.rateLimited).toBe(true);

    const f1Qr = await resolveCampaignQrCode('f1');
    const c1Qr = await resolveCampaignQrCode('c1');
    const s1Qr = await resolveCampaignQrCode('s1');

    expect(f1Qr?.destinationUrl).toBe('/start/family');
    expect(c1Qr?.destinationUrl).toBe('/start/challenge');
    expect(s1Qr?.destinationUrl).toBe('/start/secret');
  });

  it('13. canonical entities are completely specified with proper foreign keys', () => {
    expect(CANONICAL_STREET_TEAM_CAMPAIGN.id).toBe('camp-street-team-2026');
    expect(CANONICAL_FLYERS).toHaveLength(3);
    expect(CANONICAL_DISTRIBUTORS).toHaveLength(3);
    expect(CANONICAL_QR_CODES).toHaveLength(9);

    for (const qr of CANONICAL_QR_CODES) {
      expect(qr.campaignId).toBe(CANONICAL_STREET_TEAM_CAMPAIGN.id);
      expect(CANONICAL_FLYERS.some((f) => f.id === qr.flyerVariantId)).toBe(true);
      expect(CANONICAL_DISTRIBUTORS.some((d) => d.id === qr.distributorId)).toBe(true);
    }
  });

  it('14. ensureCanonicalStreetTeamInStore guarantees canonical records exist in store', async () => {
    resetCampaignStore();
    ensureCanonicalStreetTeamInStore();
    const bundle = await getCampaignBundle();

    expect(bundle.campaigns.some((c) => c.id === 'camp-street-team-2026')).toBe(true);
    expect(bundle.flyerVariants.filter((f) => f.campaignId === 'camp-street-team-2026')).toHaveLength(3);
    expect(bundle.distributors.filter((d) => d.campaignId === 'camp-street-team-2026')).toHaveLength(3);
    expect(bundle.qrCodes.filter((q) => q.campaignId === 'camp-street-team-2026')).toHaveLength(9);
  });

  it('15. recordCampaignVisit retries and auto-seeds canonical records when Supabase returns foreign key constraint error', async () => {
    let callCount = 0;
    const upsertTables: string[] = [];

    const mockSupabaseAdmin = {
      from: (table: string) => ({
        select: (_cols?: string) => ({
          order: async () => ({ data: [], error: null }),
        }),
        insert: (_payload: any) => ({
          select: () => ({
            single: async () => {
              if (table === 'campaign_visits') {
                callCount++;
                if (callCount === 1) {
                  return { data: null, error: { message: 'foreign key constraint "campaign_visits_qr_code_id_fkey" violated' } };
                }
                return {
                  data: {
                    id: 'visit-seeded-1',
                    campaign_id: 'camp-street-team-2026',
                    flyer_variant_id: 'flyer-family',
                    distributor_id: 'dist-dustin',
                    qr_code_id: 'cqr-canonical-f1',
                    destination_url: '/start/family',
                    anonymous_visitor_id: 'vis-supabase-1',
                    created_at: new Date().toISOString(),
                  },
                  error: null,
                };
              }
              return { data: null, error: null };
            },
          }),
        }),
        upsert: async (payload: any) => {
          upsertTables.push(table);
          return { data: payload, error: null };
        },
      }),
    };

    vi.resetModules();
    vi.doMock('../lib/supabase', () => ({
      isSupabaseConfigured: true,
      isSupabaseAdminConfigured: true,
      supabase: {},
      supabaseAdmin: mockSupabaseAdmin,
    }));

    const { recordCampaignVisit: recordVisitWithMock } = await import('../lib/qr-campaigns');
    const result = await recordVisitWithMock({ trackingSlug: 'f1', anonymousVisitorId: 'vis-supabase-1' });

    expect(callCount).toBe(2);
    expect(upsertTables).toContain('qr_campaigns');
    expect(upsertTables).toContain('campaign_flyer_variants');
    expect(upsertTables).toContain('campaign_distributors');
    expect(upsertTables).toContain('campaign_qr_codes');
    expect(result.visit).toBeDefined();
    expect(result.visit?.id).toBe('visit-seeded-1');
  });

  it('16. recordCampaignVisit reports error and does NOT silently mask failure into memory when Supabase permanently fails', async () => {
    const mockSupabaseAdmin = {
      from: (table: string) => ({
        select: (_cols?: string) => ({
          order: async () => ({ data: [], error: null }),
        }),
        insert: (_payload: any) => ({
          select: () => ({
            single: async () => ({
              data: null,
              error: { message: 'Fatal database connection failure' },
            }),
          }),
        }),
        upsert: async () => ({ data: null, error: { message: 'Fatal DB error' } }),
      }),
    };

    vi.resetModules();
    vi.doMock('../lib/supabase', () => ({
      isSupabaseConfigured: true,
      isSupabaseAdminConfigured: true,
      supabase: {},
      supabaseAdmin: mockSupabaseAdmin,
    }));

    const { recordCampaignVisit: recordVisitWithMock } = await import('../lib/qr-campaigns');
    const result = await recordVisitWithMock({ trackingSlug: 'f1', anonymousVisitorId: 'vis-supabase-fail' });

    expect(result.error).toBe('Fatal database connection failure');
    expect(result.visit).toBeUndefined();
  });
});

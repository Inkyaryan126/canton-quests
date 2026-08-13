import { describe, it, expect, beforeEach } from 'vitest';
import { GET as trackingGet } from '../app/go/[slug]/route';
import { generateQRCodeToken, resolveQRToken } from '../lib/game-engine';
import { verifyAdminSecret, authorizeGameMasterRequest } from '../lib/admin-auth';
import { SEED_EVENT } from '../lib/seed-data';
import {
  CAMPAIGN_ATTRIBUTION_COOKIE,
  createCampaignDistributor,
  createCampaignFlyerVariant,
  createQrCampaign,
  generateCampaignQrCodes,
  getCampaignAnalytics,
  getCampaignBundle,
  recordCampaignVisit,
  resetCampaignStore,
  resolveCampaignQrCode,
  setCampaignQrCodeStatus,
} from '../lib/qr-campaigns';

async function createFairCampaign() {
  const campaign = await createQrCampaign({
    name: 'STARK COUNTY FAIR 2026',
    destinationUrl: '/quests',
    notes: 'Local test campaign',
  });
  const flyers = await Promise.all(
    ['Flyer A', 'Flyer B', 'Flyer C'].map((name) => createCampaignFlyerVariant({ campaignId: campaign.id, name }))
  );
  const distributors = await Promise.all(
    ['Dustin', 'Person 2', 'Person 3'].map((name) => createCampaignDistributor({ campaignId: campaign.id, name }))
  );
  return { campaign, flyers, distributors };
}

describe('QR campaign attribution', () => {
  beforeEach(() => {
    resetCampaignStore();
  });

  it('1. campaign can contain multiple flyer variants', async () => {
    const { campaign, flyers } = await createFairCampaign();
    const bundle = await getCampaignBundle();

    expect(flyers).toHaveLength(3);
    expect(bundle.flyerVariants.filter((item) => item.campaignId === campaign.id).map((item) => item.name)).toEqual([
      'Flyer A',
      'Flyer B',
      'Flyer C',
    ]);
  });

  it('2. campaign can contain multiple distributors', async () => {
    const { campaign, distributors } = await createFairCampaign();
    const bundle = await getCampaignBundle();

    expect(distributors).toHaveLength(3);
    expect(bundle.distributors.filter((item) => item.campaignId === campaign.id).map((item) => item.name)).toEqual([
      'Dustin',
      'Person 2',
      'Person 3',
    ]);
  });

  it('3. unique Flyer x Distributor combinations generate distinct tracking codes', async () => {
    const { campaign, flyers, distributors } = await createFairCampaign();
    const qrs = await generateCampaignQrCodes({
      campaignId: campaign.id,
      flyerVariantIds: [flyers[0].id, flyers[1].id],
      distributorIds: [distributors[0].id, distributors[1].id],
    });

    expect(new Set(qrs.map((qr) => qr.trackingSlug)).size).toBe(4);
    expect(qrs.find((qr) => qr.flyerVariantId === flyers[0].id && qr.distributorId === distributors[0].id)?.trackingSlug)
      .not.toBe(qrs.find((qr) => qr.flyerVariantId === flyers[0].id && qr.distributorId === distributors[1].id)?.trackingSlug);
  });

  it('4. three flyer variants x three distributors can produce nine unique codes', async () => {
    const { campaign, flyers, distributors } = await createFairCampaign();
    const qrs = await generateCampaignQrCodes({
      campaignId: campaign.id,
      flyerVariantIds: flyers.map((flyer) => flyer.id),
      distributorIds: distributors.map((distributor) => distributor.id),
    });

    expect(qrs).toHaveLength(9);
    expect(new Set(qrs.map((qr) => qr.trackingSlug)).size).toBe(9);
  });

  it('5. tracking visit retains correct flyer attribution', async () => {
    const { campaign, flyers, distributors } = await createFairCampaign();
    const [qr] = await generateCampaignQrCodes({
      campaignId: campaign.id,
      flyerVariantIds: [flyers[1].id],
      distributorIds: [distributors[0].id],
    });

    const result = await recordCampaignVisit({ trackingSlug: qr.trackingSlug, anonymousVisitorId: 'visitor-a' });

    expect(result.visit?.flyerVariantId).toBe(flyers[1].id);
  });

  it('6. tracking visit retains correct distributor attribution', async () => {
    const { campaign, flyers, distributors } = await createFairCampaign();
    const [qr] = await generateCampaignQrCodes({
      campaignId: campaign.id,
      flyerVariantIds: [flyers[0].id],
      distributorIds: [distributors[2].id],
    });

    const result = await recordCampaignVisit({ trackingSlug: qr.trackingSlug, anonymousVisitorId: 'visitor-a' });

    expect(result.visit?.distributorId).toBe(distributors[2].id);
  });

  it('7. analytics aggregate flyer performance correctly', async () => {
    const { campaign, flyers, distributors } = await createFairCampaign();
    const qrs = await generateCampaignQrCodes({
      campaignId: campaign.id,
      flyerVariantIds: [flyers[0].id, flyers[1].id],
      distributorIds: [distributors[0].id],
    });
    await recordCampaignVisit({ trackingSlug: qrs[0].trackingSlug, anonymousVisitorId: 'visitor-a' });
    await recordCampaignVisit({ trackingSlug: qrs[0].trackingSlug, anonymousVisitorId: 'visitor-b' });
    await recordCampaignVisit({ trackingSlug: qrs[1].trackingSlug, anonymousVisitorId: 'visitor-c' });

    const analytics = await getCampaignAnalytics(campaign.id);

    expect(analytics.flyerPerformance.find((row) => row.id === flyers[0].id)?.visits).toBe(2);
    expect(analytics.flyerPerformance.find((row) => row.id === flyers[1].id)?.visits).toBe(1);
  });

  it('8. analytics aggregate distributor performance correctly', async () => {
    const { campaign, flyers, distributors } = await createFairCampaign();
    const qrs = await generateCampaignQrCodes({
      campaignId: campaign.id,
      flyerVariantIds: [flyers[0].id],
      distributorIds: [distributors[0].id, distributors[1].id],
    });
    await recordCampaignVisit({ trackingSlug: qrs[0].trackingSlug, anonymousVisitorId: 'visitor-a' });
    await recordCampaignVisit({ trackingSlug: qrs[1].trackingSlug, anonymousVisitorId: 'visitor-b' });
    await recordCampaignVisit({ trackingSlug: qrs[1].trackingSlug, anonymousVisitorId: 'visitor-c' });

    const analytics = await getCampaignAnalytics(campaign.id);

    expect(analytics.distributorPerformance.find((row) => row.id === distributors[0].id)?.visits).toBe(1);
    expect(analytics.distributorPerformance.find((row) => row.id === distributors[1].id)?.visits).toBe(2);
  });

  it('9. combination analytics remain distinct', async () => {
    const { campaign, flyers, distributors } = await createFairCampaign();
    const qrs = await generateCampaignQrCodes({
      campaignId: campaign.id,
      flyerVariantIds: [flyers[0].id, flyers[1].id],
      distributorIds: [distributors[0].id],
    });
    await recordCampaignVisit({ trackingSlug: qrs[0].trackingSlug, anonymousVisitorId: 'visitor-a' });
    await recordCampaignVisit({ trackingSlug: qrs[1].trackingSlug, anonymousVisitorId: 'visitor-b' });

    const analytics = await getCampaignAnalytics(campaign.id);

    expect(analytics.combinationPerformance).toHaveLength(2);
    expect(analytics.combinationPerformance.every((row) => row.visits === 1)).toBe(true);
  });

  it('10. inactive and invalid tracking codes fail safely', async () => {
    const { campaign, flyers, distributors } = await createFairCampaign();
    const [qr] = await generateCampaignQrCodes({
      campaignId: campaign.id,
      flyerVariantIds: [flyers[0].id],
      distributorIds: [distributors[0].id],
    });
    await setCampaignQrCodeStatus(qr.id, 'inactive');

    expect(await resolveCampaignQrCode(qr.trackingSlug)).toBeUndefined();
    expect(await resolveCampaignQrCode('../admin')).toBeUndefined();
  });

  it('11. public visitor cannot access admin analytics without Game Master authorization', () => {
    expect(authorizeGameMasterRequest({}).isAdmin).toBe(false);
    expect(authorizeGameMasterRequest({ 'x-admin-key': 'wrong' }).isAdmin).toBe(false);
  });

  it('12. public tracking route redirects without exposing admin-only campaign information', async () => {
    const { campaign, flyers, distributors } = await createFairCampaign();
    const [qr] = await generateCampaignQrCodes({
      campaignId: campaign.id,
      flyerVariantIds: [flyers[0].id],
      distributorIds: [distributors[0].id],
    });

    const response = await trackingGet(new Request(`https://example.test/go/${qr.trackingSlug}`), {
      params: { slug: qr.trackingSlug },
    });

    expect(response.headers.get('location')).toBe('https://example.test/quests');
    expect(response.headers.get('set-cookie')).toContain(CAMPAIGN_ATTRIBUTION_COOKIE);
    expect(response.headers.get('location')).not.toContain(campaign.notes || 'Local test campaign');
  });

  it('13. existing admin authentication still works', () => {
    expect(verifyAdminSecret('canton-gm-2026')).toBe(true);
    expect(authorizeGameMasterRequest({ 'x-admin-key': 'canton-gm-2026' }).isAdmin).toBe(true);
  });

  it('14. advertising QR codes remain separate from quest-proof QR verification', async () => {
    const questQr = generateQRCodeToken(SEED_EVENT.id, 'quest', 'qst-centennial-discovery', 'Centennial Quest QR');
    const { campaign, flyers, distributors } = await createFairCampaign();
    const [campaignQr] = await generateCampaignQrCodes({
      campaignId: campaign.id,
      flyerVariantIds: [flyers[0].id],
      distributorIds: [distributors[0].id],
    });

    expect(resolveQRToken(questQr.token)?.targetType).toBe('quest');
    expect(resolveQRToken(campaignQr.trackingSlug)).toBeUndefined();
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { POST as adminQrPost } from '../app/api/admin/qr-campaigns/route';
import { GET as trackingGet } from '../app/go/[slug]/route';
import { generateQRCodeToken, resolveQRToken } from '../lib/game-engine';
import { verifyAdminSecret, authorizeGameMasterRequest } from '../lib/admin-auth';
import { SEED_EVENT } from '../lib/seed-data';
import {
  CAMPAIGN_ATTRIBUTION_COOKIE,
  createCampaignDistributor,
  createCampaignFlyerVariant,
  createQrCampaign,
  deleteOrDeactivateDistributor,
  deleteOrDeactivateFlyer,
  deleteOrDeactivateQrCode,
  deleteUnusedCampaign,
  generateCampaignQrCodes,
  getCampaignAnalytics,
  getCampaignBundle,
  recordCampaignVisit,
  resetCampaignStore,
  resolveCampaignQrCode,
  setCampaignQrCodeStatus,
} from '../lib/qr-campaigns';
import { runQrCampaignCli } from '../scripts/qr-campaign-cli';

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
    delete process.env.NEXT_PUBLIC_SITE_URL;
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

  it('15. setup command creates one campaign, three flyers, three distributors, and nine QR combinations', async () => {
    const lines: string[] = [];
    const code = await runQrCampaignCli([
      'setup',
      '--campaign',
      'Canton Quests Street Team 2026',
      '--flyers',
      'Family,Challenge,Secret',
      '--distributors',
      'Dustin,Employee 1,Employee 2',
      '--abc-start-destinations',
    ], { stdout: (line) => lines.push(line), stderr: (line) => lines.push(line) });

    const bundle = await getCampaignBundle();
    const campaign = bundle.campaigns.find((item) => item.name === 'Canton Quests Street Team 2026');

    expect(code).toBe(0);
    expect(campaign).toBeDefined();
    expect(bundle.flyerVariants.filter((item) => item.campaignId === campaign?.id)).toHaveLength(3);
    expect(bundle.distributors.filter((item) => item.campaignId === campaign?.id)).toHaveLength(3);
    expect(bundle.qrCodes.filter((item) => item.campaignId === campaign?.id)).toHaveLength(9);
    expect(lines.filter((line) => line.includes('trackingUrl='))).toHaveLength(9);
  });

  it('16. A/B/C setup mapping stores the intended start destinations', async () => {
    await runQrCampaignCli([
      'setup',
      '--campaign',
      'ABC Street Team',
      '--flyers',
      'Family,Challenge,Secret',
      '--distributors',
      'Dustin,Employee 1,Employee 2',
      '--abc-start-destinations',
    ], { stdout: () => undefined, stderr: () => undefined });

    const bundle = await getCampaignBundle();
    const campaign = bundle.campaigns.find((item) => item.name === 'ABC Street Team');
    const campaignQrs = bundle.qrCodes.filter((item) => item.campaignId === campaign?.id);
    const flyers = bundle.flyerVariants.filter((item) => item.campaignId === campaign?.id);

    expect(campaignQrs.filter((qr) => qr.flyerVariantId === flyers.find((flyer) => flyer.name === 'Family')?.id).every((qr) => qr.destinationUrl === '/start/family')).toBe(true);
    expect(campaignQrs.filter((qr) => qr.flyerVariantId === flyers.find((flyer) => flyer.name === 'Challenge')?.id).every((qr) => qr.destinationUrl === '/start/challenge')).toBe(true);
    expect(campaignQrs.filter((qr) => qr.flyerVariantId === flyers.find((flyer) => flyer.name === 'Secret')?.id).every((qr) => qr.destinationUrl === '/start/secret')).toBe(true);
  });

  it('17. CLI output uses NEXT_PUBLIC_SITE_URL for tracking URLs', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://example-canton.test';
    const lines: string[] = [];
    await runQrCampaignCli([
      'setup',
      '--campaign',
      'URL Base Test',
      '--flyers',
      'Family,Challenge,Secret',
      '--distributors',
      'Dustin,Employee 1,Employee 2',
      '--abc-start-destinations',
    ], { stdout: (line) => lines.push(line), stderr: () => undefined });

    expect(lines.filter((line) => line.includes('trackingUrl=https://example-canton.test/go/'))).toHaveLength(9);
  });

  it('18. listing commands return expected campaign records', async () => {
    await createFairCampaign();
    const lines: string[] = [];
    const io = { stdout: (line: string) => lines.push(line), stderr: (line: string) => lines.push(line) };

    await runQrCampaignCli(['campaigns'], io);
    await runQrCampaignCli(['flyers', '--campaign', 'STARK COUNTY FAIR 2026'], io);
    await runQrCampaignCli(['distributors', '--campaign', 'STARK COUNTY FAIR 2026'], io);

    expect(lines.some((line) => line.includes('STARK COUNTY FAIR 2026'))).toBe(true);
    expect(lines.some((line) => line.includes('Flyer A'))).toBe(true);
    expect(lines.some((line) => line.includes('Dustin'))).toBe(true);
  });

  it('19. unused campaign can be deleted only with explicit confirmation', async () => {
    const campaign = await createQrCampaign({ name: 'Mistake Campaign' });

    const dryRun = await deleteUnusedCampaign(campaign.id, false);
    expect(dryRun.kind).toBe('dry_run');

    const deleted = await deleteUnusedCampaign(campaign.id, true);
    expect(deleted.kind).toBe('deleted');
    expect((await getCampaignBundle()).campaigns.find((item) => item.id === campaign.id)).toBeUndefined();
  });

  it('20. used campaign cannot lose analytics through destructive delete', async () => {
    const { campaign, flyers, distributors } = await createFairCampaign();
    const [qr] = await generateCampaignQrCodes({
      campaignId: campaign.id,
      flyerVariantIds: [flyers[0].id],
      distributorIds: [distributors[0].id],
    });
    await recordCampaignVisit({ trackingSlug: qr.trackingSlug, anonymousVisitorId: 'visitor-a' });

    const result = await deleteUnusedCampaign(campaign.id, true);

    expect(result.kind).toBe('blocked');
    expect((await getCampaignAnalytics(campaign.id)).totalVisits).toBe(1);
  });

  it('21. used flyer and distributor are deactivated instead of silently destroyed', async () => {
    const { campaign, flyers, distributors } = await createFairCampaign();
    await generateCampaignQrCodes({
      campaignId: campaign.id,
      flyerVariantIds: [flyers[0].id],
      distributorIds: [distributors[0].id],
    });

    const flyerResult = await deleteOrDeactivateFlyer(flyers[0].id, true);
    const distributorResult = await deleteOrDeactivateDistributor(distributors[0].id, true);
    const bundle = await getCampaignBundle();

    expect(flyerResult.kind).toBe('deactivated');
    expect(distributorResult.kind).toBe('deactivated');
    expect(bundle.flyerVariants.find((item) => item.id === flyers[0].id)?.status).toBe('inactive');
    expect(bundle.distributors.find((item) => item.id === distributors[0].id)?.status).toBe('inactive');
  });

  it('22. QR with visit history cannot be destructively removed', async () => {
    const { campaign, flyers, distributors } = await createFairCampaign();
    const [qr] = await generateCampaignQrCodes({
      campaignId: campaign.id,
      flyerVariantIds: [flyers[0].id],
      distributorIds: [distributors[0].id],
    });
    await recordCampaignVisit({ trackingSlug: qr.trackingSlug, anonymousVisitorId: 'visitor-a' });

    const result = await deleteOrDeactivateQrCode(qr.id, true);
    const bundle = await getCampaignBundle();

    expect(result.kind).toBe('deactivated');
    expect(bundle.qrCodes.find((item) => item.id === qr.id)?.status).toBe('inactive');
    expect(bundle.visits.filter((visit) => visit.qrCodeId === qr.id)).toHaveLength(1);
  });

  it('23. admin delete actions require Game Master authentication', async () => {
    const response = await adminQrPost(new Request('https://example.test/api/admin/qr-campaigns', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'delete_campaign', campaignId: 'camp-missing', confirmed: true }),
    }));

    expect(response.status).toBe(401);
  });

  it('24. CLI hard-delete requires explicit --yes', async () => {
    const campaign = await createQrCampaign({ name: 'CLI Delete Guard' });
    const lines: string[] = [];
    await runQrCampaignCli(['delete-campaign', '--campaign', campaign.id], {
      stdout: (line) => lines.push(line),
      stderr: (line) => lines.push(line),
    });

    expect(lines.join('\n')).toContain('explicit confirmation');
    expect((await getCampaignBundle()).campaigns.find((item) => item.id === campaign.id)).toBeDefined();
  });

  it('25. existing QR redirect attribution still works after safe delete helpers exist', async () => {
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
  });
});

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it, beforeEach } from 'vitest';
import { GET as trackingGet } from '../app/go/[slug]/route';
import {
  FAIR_ENTRY_HREF,
  FAIR_LANDING_DESTINATION_PRESETS,
  fairLandingPages,
} from '../lib/fair-landing-content';
import {
  CAMPAIGN_ATTRIBUTION_COOKIE,
  CAMPAIGN_VISITOR_COOKIE,
  createCampaignDistributor,
  createCampaignFlyerVariant,
  createQrCampaign,
  generateCampaignQrCodes,
  getCampaignAnalytics,
  recordCampaignVisit,
  resetCampaignStore,
} from '../lib/qr-campaigns';

function repoFile(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

async function createFairSplitCampaign(destinationUrl: string, flyerName = 'Secret') {
  const campaign = await createQrCampaign({
    name: 'STARK COUNTY FAIR 2026',
    destinationUrl,
    notes: 'Dustin internal test campaign',
  });
  const flyer = await createCampaignFlyerVariant({ campaignId: campaign.id, name: flyerName });
  const distributor = await createCampaignDistributor({ campaignId: campaign.id, name: 'Dustin' });
  const [qr] = await generateCampaignQrCodes({
    campaignId: campaign.id,
    flyerVariantIds: [flyer.id],
    distributorIds: [distributor.id],
  });
  return { campaign, flyer, distributor, qr };
}

describe('evergreen acquisition landing pages', () => {
  beforeEach(() => {
    resetCampaignStore();
  });

  it('1. /start/family renders with intended headline and CTA', () => {
    expect(existsSync(join(process.cwd(), 'app/start/family/page.tsx'))).toBe(true);
    expect(fairLandingPages.family.headline).toBe('YOUR KIDS THINK THEY KNOW CANTON. PROVE IT.');
    expect(fairLandingPages.family.cta).toBe('UNLOCK MY FIRST MISSION');
  });

  it('2. /start/challenge renders with intended headline and CTA', () => {
    expect(existsSync(join(process.cwd(), 'app/start/challenge/page.tsx'))).toBe(true);
    expect(fairLandingPages.challenge.headline).toBe('MOST PEOPLE WILL QUIT.');
    expect(fairLandingPages.challenge.cta).toBe('ENTER THE GAME');
  });

  it('3. /start/secret renders with intended headline and CTA', () => {
    expect(existsSync(join(process.cwd(), 'app/start/secret/page.tsx'))).toBe(true);
    expect(fairLandingPages.secret.headline).toBe('YOU FOUND THE DOOR.');
    expect(fairLandingPages.secret.cta).toBe('SHOW ME THE FIRST QUEST');
  });

  it('4. each fair CTA points into an existing Canton Quests player flow', () => {
    expect(FAIR_ENTRY_HREF).toBe('/quests');
    expect(existsSync(join(process.cwd(), 'app/quests/page.tsx'))).toBe(true);
    expect(repoFile('components/FairLandingPage.tsx')).toContain(`href={FAIR_ENTRY_HREF}`);
  });

  it("5. secret page teases Frankenstein's Quiet Signal without exposing proof secrets or GM notes", () => {
    const secret = JSON.stringify(fairLandingPages.secret);
    expect(secret).toContain("FRANKENSTEIN'S QUIET SIGNAL");
    expect(secret).toContain('Something unusual waits at West Lawn.');
    expect(secret).not.toContain('targetCode');
    expect(secret).not.toContain('gmNotes');
    expect(secret).not.toContain('proofRequirement');
    expect(secret).not.toContain('quest-proof-secrets');
  });

  it('6. fair landing navigation preserves QR attribution cookies through redirect', async () => {
    const { campaign, flyer, distributor, qr } = await createFairSplitCampaign('/start/secret');

    const response = await trackingGet(new Request(`https://example.test/go/${qr.trackingSlug}`), {
      params: { slug: qr.trackingSlug },
    });
    const setCookie = response.headers.get('set-cookie') || '';

    expect(response.headers.get('location')).toBe('https://example.test/start/secret');
    expect(setCookie).toContain(CAMPAIGN_ATTRIBUTION_COOKIE);
    expect(setCookie).toContain(CAMPAIGN_VISITOR_COOKIE);
    expect(response.headers.get('location')).not.toContain(distributor.name);
    expect(response.headers.get('location')).not.toContain(campaign.name);
    expect(response.headers.get('location')).not.toContain(flyer.name);
  });

  it('7. QR campaign destinations accept the three fair landing routes', async () => {
    for (const preset of FAIR_LANDING_DESTINATION_PRESETS) {
      const { qr } = await createFairSplitCampaign(preset.path, preset.label);
      expect(qr.destinationUrl).toBe(preset.path);
    }
  });

  it('8. one fair campaign can generate Flyer A/B/C QR records with distinct landing destinations', async () => {
    const campaign = await createQrCampaign({
      name: 'STARK COUNTY FAIR 2026',
      destinationUrl: '/quests',
    });
    const flyers = await Promise.all(
      ['Flyer A', 'Flyer B', 'Flyer C'].map((name) => createCampaignFlyerVariant({ campaignId: campaign.id, name }))
    );
    const distributor = await createCampaignDistributor({ campaignId: campaign.id, name: 'Dustin' });

    const qrs = await generateCampaignQrCodes({
      campaignId: campaign.id,
      flyerVariantIds: flyers.map((flyer) => flyer.id),
      distributorIds: [distributor.id],
      destinationUrlByFlyerVariantId: {
        [flyers[0].id]: '/start/family',
        [flyers[1].id]: '/start/challenge',
        [flyers[2].id]: '/start/secret',
      },
    });

    expect(qrs.find((qr) => qr.flyerVariantId === flyers[0].id)?.destinationUrl).toBe('/start/family');
    expect(qrs.find((qr) => qr.flyerVariantId === flyers[1].id)?.destinationUrl).toBe('/start/challenge');
    expect(qrs.find((qr) => qr.flyerVariantId === flyers[2].id)?.destinationUrl).toBe('/start/secret');
  });

  it('9. destination presets are available without preventing custom URLs', async () => {
    const adminPage = repoFile('app/admin/qr-campaigns/page.tsx');
    expect(FAIR_LANDING_DESTINATION_PRESETS.map((preset) => preset.path)).toEqual([
      '/start/family',
      '/start/challenge',
      '/start/secret',
    ]);
    expect(adminPage).toContain('FAIR_LANDING_DESTINATION_PRESETS');
    expect(adminPage).toContain('setDestinationUrl(preset.path)');
    expect(adminPage).toContain('onChange={(event) => setDestinationUrl(event.target.value)}');
    expect(adminPage).toContain('useState(false)');

    const custom = await createQrCampaign({ name: 'CUSTOM FAIR TEST', destinationUrl: '/quests?source=fair-custom' });
    expect(custom.destinationUrl).toBe('/quests?source=fair-custom');
  });

  it('10. existing QR tracking analytics remain compatible and expose destination grouping', async () => {
    const family = await createFairSplitCampaign('/start/family', 'Flyer A');
    const secret = await createFairSplitCampaign('/start/secret', 'Flyer C');

    await recordCampaignVisit({ trackingSlug: family.qr.trackingSlug, anonymousVisitorId: 'visitor-a' });
    await recordCampaignVisit({ trackingSlug: family.qr.trackingSlug, anonymousVisitorId: 'visitor-b' });
    await recordCampaignVisit({ trackingSlug: secret.qr.trackingSlug, anonymousVisitorId: 'visitor-c' });

    const familyAnalytics = await getCampaignAnalytics(family.campaign.id);
    const secretAnalytics = await getCampaignAnalytics(secret.campaign.id);

    expect(familyAnalytics.flyerPerformance[0].visits).toBe(2);
    expect(familyAnalytics.distributorPerformance[0].visits).toBe(2);
    expect(familyAnalytics.combinationPerformance[0].visits).toBe(2);
    expect(familyAnalytics.destinationPerformance).toContainEqual({
      id: '/start/family',
      label: '/start/family',
      visits: 2,
      uniqueVisitors: 2,
    });
    expect(secretAnalytics.destinationPerformance).toContainEqual({
      id: '/start/secret',
      label: '/start/secret',
      visits: 1,
      uniqueVisitors: 1,
    });
  });
});

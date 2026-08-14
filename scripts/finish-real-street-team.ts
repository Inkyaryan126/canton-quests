import {
  createCampaignFlyerVariant,
  findCampaignByNameOrId,
  generateCampaignQrCodes,
  getAbcDestinationForFlyerName,
  getCampaignBundle,
} from '../lib/qr-campaigns';

const campaignName = 'Canton Quests Street Team 2026';

const campaign = await findCampaignByNameOrId(campaignName);

if (!campaign) {
  console.error(`Campaign not found: ${campaignName}`);
  process.exit(1);
}

let bundle = await getCampaignBundle();

const wantedFlyers = ['Family', 'Challenge', 'Secret'];

for (const name of wantedFlyers) {
  const existing = bundle.flyerVariants.find(
    (f) =>
      f.campaignId === campaign.id &&
      f.name.toLowerCase() === name.toLowerCase()
  );

  if (!existing) {
    console.log(`Creating missing flyer: ${name}`);
    await createCampaignFlyerVariant({
      campaignId: campaign.id,
      name,
    });

    bundle = await getCampaignBundle();
  } else {
    console.log(`Reusing flyer: ${name}`);
  }
}

bundle = await getCampaignBundle();

const flyers = bundle.flyerVariants.filter(
  (f) =>
    f.campaignId === campaign.id &&
    wantedFlyers.some((name) => name.toLowerCase() === f.name.toLowerCase()) &&
    f.status === 'active'
);

const distributors = bundle.distributors.filter(
  (d) => d.campaignId === campaign.id && d.status === 'active'
);

if (flyers.length !== 3) {
  console.error(`Expected 3 active flyers, found ${flyers.length}`);
  process.exit(1);
}

if (distributors.length !== 3) {
  console.error(`Expected 3 active distributors, found ${distributors.length}`);
  process.exit(1);
}

const destinationUrlByFlyerVariantId: Record<string, string> = {};

for (const flyer of flyers) {
  const destination = getAbcDestinationForFlyerName(flyer.name);

  if (!destination) {
    console.error(`No A/B/C destination for flyer: ${flyer.name}`);
    process.exit(1);
  }

  destinationUrlByFlyerVariantId[flyer.id] = destination;
}

const qrs = await generateCampaignQrCodes({
  campaignId: campaign.id,
  flyerVariantIds: flyers.map((f) => f.id),
  distributorIds: distributors.map((d) => d.id),
  destinationUrlByFlyerVariantId,
});

console.log('');
console.log(`Generated/reused ${qrs.length} real Street Team QR records.`);
console.log('');

for (const qr of qrs) {
  const flyer = flyers.find((f) => f.id === qr.flyerVariantId);
  const distributor = distributors.find((d) => d.id === qr.distributorId);

  console.log(
    `${flyer?.name} | ${distributor?.name} | ${qr.destinationUrl} | ${qr.trackingUrl}`
  );
}

if (qrs.length !== 9) {
  console.error(`ERROR: Expected exactly 9 QR records, got ${qrs.length}`);
  process.exit(1);
}

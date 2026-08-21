import { supabaseAdmin } from '../lib/supabase';

if (!supabaseAdmin) {
  console.error('Supabase admin is not configured.');
  process.exit(1);
}

const campaignName = 'Canton Quests Street Team 2026';

const { data: campaigns, error: campaignError } = await supabaseAdmin
  .from('qr_campaigns')
  .select('*')
  .eq('name', campaignName)
  .limit(1);

if (campaignError || !campaigns?.length) {
  console.error('Campaign not found.', campaignError);
  process.exit(1);
}

const campaign = campaigns[0];

const { data: flyers, error: flyerError } = await supabaseAdmin
  .from('campaign_flyer_variants')
  .select('*')
  .eq('campaign_id', campaign.id);

const { data: distributors, error: distributorError } = await supabaseAdmin
  .from('campaign_distributors')
  .select('*')
  .eq('campaign_id', campaign.id);

const { data: qrs, error: qrError } = await supabaseAdmin
  .from('campaign_qr_codes')
  .select('*')
  .eq('campaign_id', campaign.id);

if (flyerError || distributorError || qrError || !flyers || !distributors || !qrs) {
  console.error('Failed loading campaign records.', {
    flyerError,
    distributorError,
    qrError,
  });
  process.exit(1);
}

/* Fix employee spelling */
for (const distributor of distributors) {
  let corrected = distributor.name;

  if (distributor.name === 'D3 Employe 1') corrected = 'Employee 1';
  if (distributor.name === 'D3 Employe 2') corrected = 'Employee 2';

  if (corrected !== distributor.name) {
    const { error } = await supabaseAdmin
      .from('campaign_distributors')
      .update({ name: corrected })
      .eq('id', distributor.id);

    if (error) {
      console.error(`Failed renaming ${distributor.name}`, error);
      process.exit(1);
    }

    distributor.name = corrected;
    console.log(`Renamed: ${corrected}`);
  }
}

const flyerPrefix: Record<string, string> = {
  Family: 'f',
  Challenge: 'c',
  Secret: 's',
};

const distributorOrder = ['Dustin', 'Employee 1', 'Employee 2'];

for (const qr of qrs) {
  const flyer = flyers.find((f) => f.id === qr.flyer_variant_id);
  const distributor = distributors.find((d) => d.id === qr.distributor_id);

  if (!flyer || !distributor) {
    console.error(`Missing relationship for QR ${qr.id}`);
    process.exit(1);
  }

  const prefix = flyerPrefix[flyer.name];
  const number = distributorOrder.indexOf(distributor.name) + 1;

  if (!prefix || number < 1) {
    console.error(`Cannot assign short slug for ${flyer.name} / ${distributor.name}`);
    process.exit(1);
  }

  const shortSlug = `${prefix}${number}`;

  const { error } = await supabaseAdmin
    .from('campaign_qr_codes')
    .update({
      tracking_slug: shortSlug,
      internal_name: `${campaignName} / ${flyer.name} / ${distributor.name}`,
    })
    .eq('id', qr.id);

  if (error) {
    console.error(`Failed updating ${flyer.name} / ${distributor.name}`, error);
    process.exit(1);
  }

  console.log(
    `${flyer.name} / ${distributor.name} -> https://www.cantonquests.com/go/${shortSlug}`
  );
}

console.log('');
console.log('SUCCESS: all 9 public QR URLs shortened.');

import { isSupabaseAdminConfigured, supabaseAdmin } from '../lib/supabase';

console.log('isSupabaseAdminConfigured =', isSupabaseAdminConfigured);

if (!supabaseAdmin) {
  console.error('ERROR: supabaseAdmin is null');
  process.exit(1);
}

const tables = [
  'qr_campaigns',
  'campaign_flyer_variants',
  'campaign_distributors',
  'campaign_qr_codes',
  'campaign_visits',
];

let failed = false;

for (const table of tables) {
  const { data, error, count } = await supabaseAdmin
    .from(table)
    .select('*', { count: 'exact', head: true });

  if (error) {
    failed = true;
    console.error(`FAIL ${table}`);
    console.error({
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
  } else {
    console.log(`PASS ${table} count=${count ?? 'unknown'}`);
  }
}

process.exit(failed ? 1 : 0);

import { supabaseAdmin, isSupabaseAdminConfigured } from '../lib/supabase';

console.log('isSupabaseAdminConfigured =', isSupabaseAdminConfigured);

if (!supabaseAdmin) {
  console.error('ERROR: supabaseAdmin is null');
  process.exit(1);
}

const stamp = Date.now();
const id = `diag_${stamp}`;
const name = `QR WRITE DIAGNOSTIC ${stamp}`;
const slug = `qr-write-diagnostic-${stamp}`;

console.log('Attempting direct INSERT into qr_campaigns...');

const { data, error } = await supabaseAdmin
  .from('qr_campaigns')
  .insert({
    id,
    name,
    slug,
    destination_url: '/quests',
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })
  .select('*')
  .single();

if (error) {
  console.error('INSERT FAILED');
  console.error('message:', error.message);
  console.error('code:', error.code);
  console.error('details:', error.details);
  console.error('hint:', error.hint);
  process.exit(1);
}

console.log('INSERT PASSED:', data?.id);

console.log('Attempting cleanup DELETE...');

const { error: deleteError } = await supabaseAdmin
  .from('qr_campaigns')
  .delete()
  .eq('id', id);

if (deleteError) {
  console.error('DELETE FAILED');
  console.error('message:', deleteError.message);
  console.error('code:', deleteError.code);
  console.error('details:', deleteError.details);
  console.error('hint:', deleteError.hint);
  process.exit(1);
}

console.log('DELETE PASSED');
console.log('DIRECT DATABASE WRITE PATH WORKS');

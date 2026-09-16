import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../supabase';

export async function resolveGridScrimmageCityId(
  citySlug: string,
  client: SupabaseClient | null = supabaseAdmin,
): Promise<string> {
  if (!client) {
    throw new Error(
      'Grid scrimmage city resolution requires Supabase service-role configuration',
    );
  }

  const normalizedSlug = citySlug.trim();
  if (!normalizedSlug) {
    throw new Error('Grid scrimmage requires a city slug');
  }

  const { data, error } = await client
    .from('grid_cities')
    .select('id')
    .eq('slug', normalizedSlug)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to resolve Grid scrimmage city: ${error.message}`,
    );
  }

  if (!data) {
    throw new Error('Grid scrimmage city is not imported');
  }

  return (data as { id: string }).id;
}

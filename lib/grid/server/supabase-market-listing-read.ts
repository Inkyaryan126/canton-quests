import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../supabase';
import type { GridCityPackage } from '../core/types';
import type {
  GridGetMarketListingInput,
  GridListOpenMarketListingsInput,
  GridMarketListingReadPort,
  GridMarketListingSummary,
} from './market-listing-read-port';

interface ListingRow {
  listing_id: string;
  season_id: string;
  city_id: string;
  property_id: string;
  seller_player_id: string;
  price_credits: number;
  created_at: string;
  expires_at: string;
}

interface PropertyRow {
  id: string;
  slug: string;
  display_name: string;
  public_name_safe: boolean;
}

function safeCredits(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Grid market listing ${label} exceeds safe integer range`);
  }
  return value;
}

function toSummary(
  row: ListingRow,
  property: PropertyRow,
  viewerPlayerId: string,
): GridMarketListingSummary {
  return {
    listingId: row.listing_id,
    seasonId: row.season_id,
    cityId: row.city_id,
    propertyId: row.property_id,
    propertySlug: property.slug,
    propertyName: property.public_name_safe
      ? property.display_name
      : 'Grid Property',
    status: 'open',
    priceCredits: safeCredits(row.price_credits, 'priceCredits'),
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    viewerIsSeller: row.seller_player_id === viewerPlayerId,
  };
}

async function loadProperties(
  client: SupabaseClient,
  propertyIds: string[],
): Promise<Map<string, PropertyRow>> {
  if (propertyIds.length === 0) return new Map();

  const { data, error } = await client
    .from('grid_properties')
    .select('id,slug,display_name,public_name_safe')
    .in('id', propertyIds);

  if (error) {
    throw new Error(`Failed to load Grid market properties: ${error.message}`);
  }

  return new Map(
    ((data ?? []) as PropertyRow[]).map((row) => [row.id, row]),
  );
}

export async function resolveSupabaseGridMarketSeasonId(
  pkg: GridCityPackage,
  client: SupabaseClient | null = supabaseAdmin,
): Promise<string | null> {
  if (!client) {
    throw new Error('Grid market discovery requires Supabase configuration');
  }

  const cityResult = await client
    .from('grid_cities')
    .select('id')
    .eq('slug', pkg.city.slug)
    .maybeSingle();
  if (cityResult.error) {
    throw new Error(
      `Failed to resolve Grid market city: ${cityResult.error.message}`,
    );
  }
  if (!cityResult.data) return null;

  const seasonResult = await client
    .from('grid_seasons')
    .select('id')
    .eq('city_id', (cityResult.data as { id: string }).id)
    .eq('slug', pkg.seasonTemplate.slug)
    .maybeSingle();
  if (seasonResult.error) {
    throw new Error(
      `Failed to resolve Grid market season: ${seasonResult.error.message}`,
    );
  }

  return (seasonResult.data as { id: string } | null)?.id ?? null;
}

export function createSupabaseGridMarketListingReadPort(
  client: SupabaseClient | null = supabaseAdmin,
): GridMarketListingReadPort {
  if (!client) {
    throw new Error('Grid market discovery requires Supabase configuration');
  }

  return {
    async listOpenListings(
      input: GridListOpenMarketListingsInput,
    ): Promise<GridMarketListingSummary[]> {
      const { data, error } = await client
        .from('grid_market_fixed_price_listings')
        .select(
          'listing_id,season_id,city_id,property_id,seller_player_id,price_credits,created_at,expires_at',
        )
        .eq('season_id', input.seasonId)
        .eq('status', 'open')
        .lte('created_at', input.now)
        .gt('expires_at', input.now)
        .order('expires_at', { ascending: true });

      if (error) {
        throw new Error(`Failed to list Grid market listings: ${error.message}`);
      }

      const rows = (data ?? []) as ListingRow[];
      if (rows.length === 0) return [];

      const properties = await loadProperties(
        client,
        [...new Set(rows.map((row) => row.property_id))],
      );

      return rows.map((row) => {
        const property = properties.get(row.property_id);
        if (!property) {
          throw new Error('Grid market listing references an unknown property');
        }
        return toSummary(row, property, input.viewerPlayerId);
      });
    },

    async getListing(
      input: GridGetMarketListingInput,
    ): Promise<GridMarketListingSummary | null> {
      const { data, error } = await client
        .from('grid_market_fixed_price_listings')
        .select(
          'listing_id,season_id,city_id,property_id,seller_player_id,price_credits,created_at,expires_at',
        )
        .eq('season_id', input.seasonId)
        .eq('listing_id', input.listingId)
        .eq('status', 'open')
        .lte('created_at', input.now)
        .gt('expires_at', input.now)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to load Grid market listing: ${error.message}`);
      }
      if (!data) return null;

      const row = data as ListingRow;
      const properties = await loadProperties(client, [row.property_id]);
      const property = properties.get(row.property_id);
      if (!property) {
        throw new Error('Grid market listing references an unknown property');
      }

      return toSummary(row, property, input.viewerPlayerId);
    },
  };
}

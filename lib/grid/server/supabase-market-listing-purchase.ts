import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../supabase';
import type {
  GridLoadMarketListingPurchaseContextInput,
  GridMarketListingPurchaseContext,
  GridMarketListingPurchaseReadPort,
} from './market-listing-purchase-port';

interface ListingRow {
  listing_id: string;
  city_id: string;
  seller_player_id: string;
  property_id: string;
  price_credits: number;
  created_at: string;
  expires_at: string;
  status: 'open' | 'sold' | 'cancelled';
}

interface PropertyRow {
  id: string;
  city_id: string;
  base_value: number;
  config: Record<string, unknown> | null;
}

interface PropertyStateRow {
  owner_player_id: string | null;
  acquired_at: string | null;
}

interface PlayerStateRow {
  city_id: string;
  credits: number;
}

function configFlag(
  config: Record<string, unknown> | null,
  key: string,
  fallback: boolean,
): boolean {
  const raw = config?.[key];
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'string') return raw.toLowerCase() === 'true';
  return fallback;
}

export function createSupabaseGridMarketListingPurchaseReadPort(
  client: SupabaseClient | null = supabaseAdmin,
): GridMarketListingPurchaseReadPort {
  if (!client) {
    throw new Error('Grid market listing purchase requires Supabase configuration');
  }

  return {
    async loadPurchaseContext(
      input: GridLoadMarketListingPurchaseContextInput,
    ): Promise<GridMarketListingPurchaseContext> {
      const { data: listingData, error: listingError } = await client
        .from('grid_market_fixed_price_listings')
        .select(
          'listing_id,city_id,seller_player_id,property_id,price_credits,created_at,expires_at,status',
        )
        .eq('season_id', input.seasonId)
        .eq('listing_id', input.listingId)
        .maybeSingle();

      if (listingError) {
        throw new Error(
          `Failed to load Grid market listing: ${listingError.message}`,
        );
      }
      const listingRow = listingData as ListingRow | null;
      if (!listingRow) {
        return { listing: null, property: null, buyer: null };
      }

      const [propertyResult, propertyStateResult, buyerStateResult] =
        await Promise.all([
          client
            .from('grid_properties')
            .select('id,city_id,base_value,config')
            .eq('id', listingRow.property_id)
            .maybeSingle(),
          client
            .from('grid_season_property_state')
            .select('owner_player_id,acquired_at')
            .eq('season_id', input.seasonId)
            .eq('property_id', listingRow.property_id)
            .maybeSingle(),
          client
            .from('grid_player_season_state')
            .select('city_id,credits')
            .eq('season_id', input.seasonId)
            .eq('player_id', input.buyerPlayerId)
            .maybeSingle(),
        ]);

      if (propertyResult.error) {
        throw new Error(
          `Failed to load Grid market listing property: ${propertyResult.error.message}`,
        );
      }
      if (propertyStateResult.error) {
        throw new Error(
          `Failed to load Grid market listing property state: ${propertyStateResult.error.message}`,
        );
      }
      if (buyerStateResult.error) {
        throw new Error(
          `Failed to load Grid market listing buyer state: ${buyerStateResult.error.message}`,
        );
      }

      const listing = {
        listingId: listingRow.listing_id,
        cityId: listingRow.city_id,
        sellerPlayerId: listingRow.seller_player_id,
        propertyId: listingRow.property_id,
        priceCredits: listingRow.price_credits,
        createdAt: listingRow.created_at,
        expiresAt: listingRow.expires_at,
        status: listingRow.status,
      };

      const propertyRow = propertyResult.data as PropertyRow | null;
      const property = propertyRow
        ? {
            propertyId: propertyRow.id,
            cityId: propertyRow.city_id,
            ownerPlayerId:
              (propertyStateResult.data as PropertyStateRow | null)
                ?.owner_player_id ?? null,
            tradable: configFlag(propertyRow.config, 'tradable', true),
            majorLandmark: configFlag(propertyRow.config, 'majorLandmark', false),
            acquiredAt:
              (propertyStateResult.data as PropertyStateRow | null)
                ?.acquired_at ?? null,
            baseValueCredits: propertyRow.base_value,
          }
        : null;

      const buyerRow = buyerStateResult.data as PlayerStateRow | null;
      const buyer = buyerRow
        ? {
            playerId: input.buyerPlayerId,
            cityId: buyerRow.city_id,
            creditBalance: buyerRow.credits,
          }
        : null;

      return { listing, property, buyer };
    },
  };
}

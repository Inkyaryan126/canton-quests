import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../supabase';
import type { GridCityPackage } from '../core/types';
import type {
  GridAuctionListing,
  GridAuctionReadPort,
  GridGetActiveAuctionInput,
  GridListActiveAuctionsInput,
} from './auction-read-port';

interface AuctionRow {
  id: string;
  season_id: string;
  city_id: string;
  property_id: string;
  status: 'scheduled' | 'open';
  reserve_credits: number;
  minimum_bid_increment_credits: number;
  starts_at: string;
  ends_at: string;
  leading_bidder_player_id: string | null;
  leading_bid_credits: number | null;
}

interface PropertyRow {
  id: string;
  slug: string;
  display_name: string;
  public_name_safe: boolean;
}

function safeCredits(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Grid auction ${label} exceeds safe integer range`);
  }
  return value;
}

function minimumNextBid(row: AuctionRow): number {
  const reserve = safeCredits(row.reserve_credits, 'reserveCredits');
  if (row.leading_bid_credits === null) return reserve;

  const leading = safeCredits(row.leading_bid_credits, 'leadingBidCredits');
  const increment = safeCredits(
    row.minimum_bid_increment_credits,
    'minimumBidIncrementCredits',
  );
  const next = leading + increment;
  if (!Number.isSafeInteger(next)) {
    throw new Error('Grid auction minimum next bid exceeds safe integer range');
  }
  return next;
}

export async function resolveSupabaseGridAuctionSeasonId(
  pkg: GridCityPackage,
  client: SupabaseClient | null = supabaseAdmin,
): Promise<string | null> {
  if (!client) {
    throw new Error('Grid auction discovery requires Supabase configuration');
  }

  const cityResult = await client
    .from('grid_cities')
    .select('id')
    .eq('slug', pkg.city.slug)
    .maybeSingle();

  if (cityResult.error) {
    throw new Error(
      `Failed to resolve Grid auction city: ${cityResult.error.message}`,
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
      `Failed to resolve Grid auction season: ${seasonResult.error.message}`,
    );
  }

  return (seasonResult.data as { id: string } | null)?.id ?? null;
}

function toAuctionListing(
  row: AuctionRow,
  property: PropertyRow,
  viewerPlayerId: string,
  nowMs: number,
): GridAuctionListing {
  const reserveCredits = safeCredits(row.reserve_credits, 'reserveCredits');
  const minimumBidIncrementCredits = safeCredits(
    row.minimum_bid_increment_credits,
    'minimumBidIncrementCredits',
  );
  const leadingBidCredits =
    row.leading_bid_credits === null
      ? undefined
      : safeCredits(row.leading_bid_credits, 'leadingBidCredits');

  return {
    auctionId: row.id,
    seasonId: row.season_id,
    cityId: row.city_id,
    propertyId: row.property_id,
    propertySlug: property.slug,
    propertyName: property.public_name_safe
      ? property.display_name
      : 'Grid Property',
    status:
      row.status === 'scheduled' && Date.parse(row.starts_at) <= nowMs
        ? 'open'
        : row.status,
    reserveCredits,
    minimumBidIncrementCredits,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    leadingBidCredits,
    minimumNextBidCredits: minimumNextBid(row),
    viewerIsLeadingBidder: row.leading_bidder_player_id === viewerPlayerId,
  };
}

async function loadAuctionProperty(
  client: SupabaseClient,
  propertyId: string,
): Promise<PropertyRow> {
  const { data, error } = await client
    .from('grid_properties')
    .select('id,slug,display_name,public_name_safe')
    .eq('id', propertyId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load Grid auction property: ${error.message}`);
  }
  if (!data) {
    throw new Error('Grid auction references an unknown property');
  }
  return data as PropertyRow;
}

export function createSupabaseGridAuctionReadPort(
  client: SupabaseClient | null = supabaseAdmin,
): GridAuctionReadPort {
  if (!client) {
    throw new Error('Grid auction discovery requires Supabase configuration');
  }

  return {
    async listActiveAuctions(
      input: GridListActiveAuctionsInput,
    ): Promise<GridAuctionListing[]> {
      const { data: auctionData, error: auctionError } = await client
        .from('grid_property_auctions')
        .select(
          'id,season_id,city_id,property_id,status,reserve_credits,minimum_bid_increment_credits,starts_at,ends_at,leading_bidder_player_id,leading_bid_credits',
        )
        .eq('season_id', input.seasonId)
        .in('status', ['scheduled', 'open'])
        .gt('ends_at', input.now)
        .order('ends_at', { ascending: true });

      if (auctionError) {
        throw new Error(
          `Failed to list Grid auctions: ${auctionError.message}`,
        );
      }

      const rows = (auctionData ?? []) as AuctionRow[];
      if (rows.length === 0) return [];

      const propertyIds = [...new Set(rows.map((row) => row.property_id))];
      const { data: propertyData, error: propertyError } = await client
        .from('grid_properties')
        .select('id,slug,display_name,public_name_safe')
        .in('id', propertyIds);

      if (propertyError) {
        throw new Error(
          `Failed to load Grid auction properties: ${propertyError.message}`,
        );
      }

      const properties = new Map(
        ((propertyData ?? []) as PropertyRow[]).map((row) => [row.id, row]),
      );
      const nowMs = Date.parse(input.now);

      return rows.map((row) => {
        const property = properties.get(row.property_id);
        if (!property) {
          throw new Error('Grid auction references an unknown property');
        }
        return toAuctionListing(row, property, input.viewerPlayerId, nowMs);
      });
    },

    async getActiveAuction(
      input: GridGetActiveAuctionInput,
    ): Promise<GridAuctionListing | null> {
      const { data, error } = await client
        .from('grid_property_auctions')
        .select(
          'id,season_id,city_id,property_id,status,reserve_credits,minimum_bid_increment_credits,starts_at,ends_at,leading_bidder_player_id,leading_bid_credits',
        )
        .eq('season_id', input.seasonId)
        .eq('id', input.auctionId)
        .in('status', ['scheduled', 'open'])
        .gt('ends_at', input.now)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to load Grid auction: ${error.message}`);
      }
      if (!data) return null;

      const row = data as AuctionRow;
      const property = await loadAuctionProperty(client, row.property_id);
      const nowMs = Date.parse(input.now);
      return toAuctionListing(row, property, input.viewerPlayerId, nowMs);
    },
  };
}

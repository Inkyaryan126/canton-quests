import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../supabase';
import type { GridCityPackage } from '../core/types';
import type {
  GridDirectDealMarketContext,
  GridDirectDealMarketPort,
  GridDirectDealPropertySnapshot,
  GridDirectDealStoredProposal,
} from './direct-deal-market-port';

interface ProposalRow {
  proposal_id: string;
  season_id: string;
  city_id: string;
  proposer_player_id: string;
  counterparty_player_id: string;
  proposer_credits: number;
  counterparty_credits: number;
  proposer_property_ids: string[];
  counterparty_property_ids: string[];
  transaction_tax_bps: number;
  property_trade_cooldown_minutes: number;
  max_assets_per_side: number;
  created_at: string;
  expires_at: string;
  status: 'open' | 'accepted' | 'cancelled';
}

function proposal(row: ProposalRow): GridDirectDealStoredProposal {
  return {
    proposalId: row.proposal_id,
    seasonId: row.season_id,
    cityId: row.city_id,
    proposerPlayerId: row.proposer_player_id,
    counterpartyPlayerId: row.counterparty_player_id,
    proposerCredits: Number(row.proposer_credits),
    counterpartyCredits: Number(row.counterparty_credits),
    proposerPropertyIds: row.proposer_property_ids ?? [],
    counterpartyPropertyIds: row.counterparty_property_ids ?? [],
    transactionTaxBps: Number(row.transaction_tax_bps),
    propertyTradeCooldownMinutes: Number(row.property_trade_cooldown_minutes),
    maxAssetsPerSide: Number(row.max_assets_per_side),
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    status: row.status,
  };
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
export function createSupabaseGridDirectDealMarketPort(
  pkg: GridCityPackage,
  client: SupabaseClient | null = supabaseAdmin,
): GridDirectDealMarketPort {
  if (!client) {
    throw new Error('Grid Direct Deal market requires Supabase configuration');
  }
  const db = client;

  let cachedContext: GridDirectDealMarketContext | null | undefined;

  async function getContext(): Promise<GridDirectDealMarketContext | null> {
    if (cachedContext !== undefined) return cachedContext;

    const cityResult = await db
      .from('grid_cities')
      .select('id')
      .eq('slug', pkg.city.slug)
      .maybeSingle();
    if (cityResult.error) {
      throw new Error(
        `Failed to resolve Grid Direct Deal city: ${cityResult.error.message}`,
      );
    }
    if (!cityResult.data) {
      cachedContext = null;
      return null;
    }

    const cityId = (cityResult.data as { id: string }).id;
    const seasonResult = await db
      .from('grid_seasons')
      .select('id,status')
      .eq('city_id', cityId)
      .eq('slug', pkg.seasonTemplate.slug)
      .maybeSingle();
    if (seasonResult.error) {
      throw new Error(
        `Failed to resolve Grid Direct Deal season: ${seasonResult.error.message}`,
      );
    }
    if (!seasonResult.data) {
      cachedContext = null;
      return null;
    }

    const row = seasonResult.data as { id: string; status: string };
    cachedContext = {
      cityId,
      seasonId: row.id,
      seasonStatus: row.status,
    };
    return cachedContext;
  }

  return {
    getContext,

    async resolvePlayerByCallsign(callsign) {
      const { data, error } = await db.rpc('grid_resolve_chat_callsign', {
        p_callsign: callsign,
      });
      if (error) {
        throw new Error(
          `Failed to resolve Grid Direct Deal callsign: ${error.message}`,
        );
      }
      if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
      const row = data as { playerId?: unknown; callsign?: unknown };
      return typeof row.playerId === 'string' &&
        typeof row.callsign === 'string'
        ? { playerId: row.playerId, callsign: row.callsign }
        : null;
    },
    async resolvePropertyIds(propertySlugs) {
      const context = await getContext();
      const slugs = [...new Set(propertySlugs.map((slug) => slug.trim()))]
        .filter(Boolean);
      if (!context || slugs.length === 0) return [];

      const result = await db
        .from('grid_properties')
        .select('id,slug')
        .eq('city_id', context.cityId)
        .in('slug', slugs);
      if (result.error) {
        throw new Error(
          `Failed to resolve Grid Direct Deal properties: ${result.error.message}`,
        );
      }
      return ((result.data ?? []) as Array<{ id: string; slug: string }>).map(
        (row) => ({ propertyId: row.id, propertySlug: row.slug }),
      );
    },

    async listOpenProposals(viewerPlayerId, now) {
      const context = await getContext();
      if (!context) return [];

      const result = await db
        .from('grid_direct_deal_proposals')
        .select(
          'proposal_id,season_id,city_id,proposer_player_id,counterparty_player_id,proposer_credits,counterparty_credits,proposer_property_ids,counterparty_property_ids,transaction_tax_bps,property_trade_cooldown_minutes,max_assets_per_side,created_at,expires_at,status',
        )
        .eq('season_id', context.seasonId)
        .eq('status', 'open')
        .gt('expires_at', now)
        .or(
          `proposer_player_id.eq.${viewerPlayerId},counterparty_player_id.eq.${viewerPlayerId}`,
        )
        .order('created_at', { ascending: false });
      if (result.error) {
        throw new Error(
          `Failed to read Grid Direct Deal proposals: ${result.error.message}`,
        );
      }
      return ((result.data ?? []) as ProposalRow[]).map(proposal);
    },

    async readProposal(proposalId) {
      const context = await getContext();
      if (!context) return null;
      const result = await db
        .from('grid_direct_deal_proposals')
        .select(
          'proposal_id,season_id,city_id,proposer_player_id,counterparty_player_id,proposer_credits,counterparty_credits,proposer_property_ids,counterparty_property_ids,transaction_tax_bps,property_trade_cooldown_minutes,max_assets_per_side,created_at,expires_at,status',
        )
        .eq('season_id', context.seasonId)
        .eq('proposal_id', proposalId)
        .maybeSingle();
      if (result.error) {
        throw new Error(
          `Failed to load Grid Direct Deal proposal: ${result.error.message}`,
        );
      }
      return result.data ? proposal(result.data as ProposalRow) : null;
    },
    async readPlayerLabels(playerIds) {
      const ids = [...new Set(playerIds)].filter(Boolean);
      if (ids.length === 0) return [];
      const result = await db
        .from('players')
        .select('id,display_name')
        .in('id', ids);
      if (result.error) {
        throw new Error(
          `Failed to read Grid Direct Deal player labels: ${result.error.message}`,
        );
      }
      return ((result.data ?? []) as Array<{
        id: string;
        display_name: string | null;
      }>).map((row) => ({
        playerId: row.id,
        callsign: row.display_name?.trim() || 'GRID PLAYER',
      }));
    },

    async readPlayerStates(playerIds) {
      const context = await getContext();
      const ids = [...new Set(playerIds)].filter(Boolean);
      if (!context || ids.length === 0) return [];
      const result = await db
        .from('grid_player_season_state')
        .select('player_id,credits')
        .eq('season_id', context.seasonId)
        .in('player_id', ids);
      if (result.error) {
        throw new Error(
          `Failed to read Grid Direct Deal player states: ${result.error.message}`,
        );
      }
      return ((result.data ?? []) as Array<{
        player_id: string;
        credits: number;
      }>).map((row) => ({
        playerId: row.player_id,
        credits: Number(row.credits),
      }));
    },

    async readProperties(propertyIds) {
      const context = await getContext();
      const ids = [...new Set(propertyIds)].filter(Boolean);
      if (!context || ids.length === 0) return [];

      const [propertyResult, stateResult] = await Promise.all([
        db
          .from('grid_properties')
          .select('id,slug,base_value,config')
          .eq('city_id', context.cityId)
          .in('id', ids),
        db
          .from('grid_season_property_state')
          .select('property_id,owner_player_id,acquired_at')
          .eq('season_id', context.seasonId)
          .in('property_id', ids),
      ]);
      if (propertyResult.error) {
        throw new Error(
          `Failed to read Grid Direct Deal properties: ${propertyResult.error.message}`,
        );
      }
      if (stateResult.error) {
        throw new Error(
          `Failed to read Grid Direct Deal property states: ${stateResult.error.message}`,
        );
      }

      const stateById = new Map(
        ((stateResult.data ?? []) as Array<{
          property_id: string;
          owner_player_id: string | null;
          acquired_at: string | null;
        }>).map((row) => [row.property_id, row] as const),
      );

      return ((propertyResult.data ?? []) as Array<{
        id: string;
        slug: string;
        base_value: number;
        config: Record<string, unknown> | null;
      }>).map((row): GridDirectDealPropertySnapshot => {
        const state = stateById.get(row.id);
        return {
          propertyId: row.id,
          propertySlug: row.slug,
          baseValueCredits: Number(row.base_value),
          tradable: configFlag(row.config, 'tradable', true),
          majorLandmark: configFlag(row.config, 'majorLandmark', false),
          ownerPlayerId: state?.owner_player_id ?? null,
          acquiredAt: state?.acquired_at ?? null,
        };
      });
    },
  };
}

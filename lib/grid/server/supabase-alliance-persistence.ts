import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../supabase';
import type { GridAllianceMembership } from '../core/alliance-types';
import type {
  GridAllianceInfluenceContributionPersistenceResult,
  GridAlliancePersistencePort,
  GridAllianceUpkeepPersistenceResult,
  GridAllianceState,
  GridCreateAlliancePersistenceResult,
} from './alliance-persistence-port';

interface AllianceRow {
  id: string;
  season_id: string;
  slug: string;
  name: string;
  leader_player_id: string;
  status: GridAllianceState['status'];
  influence_pool: number;
  revision: number;
  created_at: string;
  updated_at: string;
  disbanded_at: string | null;
}

interface MembershipRow {
  player_id: string;
  season_id: string;
  alliance_id: string;
  joined_at: string;
  left_at: string | null;
  cooldown_until: string | null;
}

function allianceFromRow(row: AllianceRow): GridAllianceState {
  return {
    allianceId: row.id,
    seasonId: row.season_id,
    slug: row.slug,
    name: row.name,
    leaderPlayerId: row.leader_player_id,
    status: row.status,
    influencePool: Number(row.influence_pool),
    revision: Number(row.revision),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    disbandedAt: row.disbanded_at,
  };
}

function membershipFromRow(row: MembershipRow): GridAllianceMembership {
  return {
    playerId: row.player_id,
    seasonId: row.season_id,
    allianceId: row.alliance_id,
    joinedAt: row.joined_at,
    leftAt: row.left_at,
    cooldownUntil: row.cooldown_until,
  };
}

function requireObject<T>(data: unknown, label: string): T {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`${label} returned an invalid result`);
  }
  return data as T;
}

export function createSupabaseGridAlliancePersistencePort(
  client: SupabaseClient | null = supabaseAdmin,
): GridAlliancePersistencePort {
  if (!client) {
    throw new Error(
      'Grid Alliance persistence requires Supabase service-role configuration',
    );
  }

  return {
    async getAllianceById(allianceId) {
      const { data, error } = await client
        .from('grid_alliances')
        .select(
          'id,season_id,slug,name,leader_player_id,status,influence_pool,revision,created_at,updated_at,disbanded_at',
        )
        .eq('id', allianceId)
        .maybeSingle();
      if (error) {
        throw new Error(`Failed to read Grid Alliance: ${error.message}`);
      }
      return data ? allianceFromRow(data as AllianceRow) : null;
    },

    async listActiveAlliances(seasonId) {
      const { data, error } = await client
        .from('grid_alliances')
        .select(
          'id,season_id,slug,name,leader_player_id,status,influence_pool,revision,created_at,updated_at,disbanded_at',
        )
        .eq('season_id', seasonId)
        .eq('status', 'active')
        .order('name', { ascending: true })
        .order('id', { ascending: true });
      if (error) {
        throw new Error(`Failed to list Grid Alliances: ${error.message}`);
      }
      return ((data ?? []) as AllianceRow[]).map(allianceFromRow);
    },

    async getMembershipHistory(seasonId, playerId) {
      const { data, error } = await client
        .from('grid_alliance_memberships')
        .select(
          'player_id,season_id,alliance_id,joined_at,left_at,cooldown_until',
        )
        .eq('season_id', seasonId)
        .eq('player_id', playerId)
        .order('joined_at', { ascending: true });
      if (error) {
        throw new Error(
          `Failed to read Grid Alliance membership history: ${error.message}`,
        );
      }
      return ((data ?? []) as MembershipRow[]).map(membershipFromRow);
    },

    async countActiveMembers(allianceId) {
      const { count, error } = await client
        .from('grid_alliance_memberships')
        .select('id', { count: 'exact', head: true })
        .eq('alliance_id', allianceId)
        .is('left_at', null);
      if (error) {
        throw new Error(
          `Failed to count Grid Alliance members: ${error.message}`,
        );
      }
      return count ?? 0;
    },

    async createAllianceWithLeader(command) {
      const { data, error } = await client.rpc('grid_create_alliance', {
        p_alliance_id: command.allianceId,
        p_season_id: command.seasonId,
        p_leader_player_id: command.leaderPlayerId,
        p_slug: command.slug,
        p_name: command.name,
        p_now: command.joinedAt,
      });
      if (error) {
        throw new Error(`Failed to create Grid Alliance: ${error.message}`);
      }
      return requireObject<GridCreateAlliancePersistenceResult>(
        data,
        'Grid Alliance creation',
      );
    },

    async joinAlliance(command) {
      const { data, error } = await client.rpc('grid_join_alliance', {
        p_alliance_id: command.allianceId,
        p_season_id: command.seasonId,
        p_player_id: command.playerId,
        p_joined_at: command.joinedAt,
        p_max_members: command.maxMembers,
      });
      if (error) {
        throw new Error(`Failed to join Grid Alliance: ${error.message}`);
      }
      return requireObject<GridAllianceMembership>(data, 'Grid Alliance join');
    },

    async leaveAlliance(command) {
      const { data, error } = await client.rpc('grid_leave_alliance', {
        p_alliance_id: command.allianceId,
        p_season_id: command.seasonId,
        p_player_id: command.playerId,
        p_left_at: command.leftAt,
        p_cooldown_until: command.cooldownUntil,
      });
      if (error) {
        throw new Error(`Failed to leave Grid Alliance: ${error.message}`);
      }
      return requireObject<GridAllianceMembership>(data, 'Grid Alliance leave');
    },

    async getPlayerInfluence(seasonId, playerId) {
      const { data, error } = await client
        .from('grid_player_season_state')
        .select('influence')
        .eq('season_id', seasonId)
        .eq('player_id', playerId)
        .maybeSingle();
      if (error) {
        throw new Error(`Failed to read Grid Alliance player Influence: ${error.message}`);
      }
      return data ? Number((data as { influence: number }).influence) : null;
    },

    async getInfluenceContributionReplay(
      seasonId,
      allianceId,
      playerId,
      idempotencyKey,
    ) {
      const { data, error } = await client
        .from('grid_game_events')
        .select('id,payload')
        .eq('season_id', seasonId)
        .eq('actor_player_id', playerId)
        .eq('entity_id', allianceId)
        .eq('event_type', 'alliance_influence_contribution')
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();
      if (error) {
        throw new Error(`Failed to replay Grid Alliance contribution: ${error.message}`);
      }
      if (!data) return null;
      const event = data as { id: string; payload: unknown };
      const payload = requireObject<Omit<GridAllianceInfluenceContributionPersistenceResult, 'eventId' | 'replayed'>>(
        event.payload,
        'Grid Alliance contribution replay',
      );
      return { ...payload, eventId: event.id, replayed: true };
    },

    async applyInfluenceContribution(command) {
      const { data, error } = await client.rpc(
        'grid_apply_alliance_influence_contribution',
        {
          p_alliance_id: command.allianceId,
          p_season_id: command.seasonId,
          p_player_id: command.playerId,
          p_expected_alliance_revision: command.expectedAllianceRevision,
          p_expected_player_influence: command.expectedPlayerInfluence,
          p_accepted_influence: command.acceptedInfluence,
          p_player_influence_after: command.playerInfluenceAfter,
          p_pool_influence_after: command.poolInfluenceAfter,
          p_pool_cap: command.poolCap,
          p_constraints: command.constraints,
          p_idempotency_key: command.idempotencyKey,
          p_now: command.now,
        },
      );
      if (error) {
        throw new Error(`Failed to contribute Grid Alliance Influence: ${error.message}`);
      }
      if (data === null) return null;
      return requireObject<GridAllianceInfluenceContributionPersistenceResult>(
        data,
        'Grid Alliance Influence contribution',
      );
    },

    async getActiveMemberPlayerIds(allianceId) {
      const { data, error } = await client
        .from('grid_alliance_memberships')
        .select('player_id')
        .eq('alliance_id', allianceId)
        .is('left_at', null)
        .order('player_id', { ascending: true });
      if (error) {
        throw new Error(`Failed to read Grid Alliance active members: ${error.message}`);
      }
      return ((data ?? []) as Array<{ player_id: string }>).map(
        (row) => row.player_id,
      );
    },

    async getAllianceNetworkInputs(seasonId, memberPlayerIds) {
      if (memberPlayerIds.length === 0) {
        return { territoryOwnership: [], adjacencyEdges: [] };
      }

      const { data: seasonData, error: seasonError } = await client
        .from('grid_seasons')
        .select('city_id')
        .eq('id', seasonId)
        .maybeSingle();
      if (seasonError) {
        throw new Error(`Failed to read Grid Alliance season city: ${seasonError.message}`);
      }
      if (!seasonData) {
        throw new Error('Grid Alliance season was not found');
      }
      const cityId = (seasonData as { city_id: string }).city_id;

      const { data: ownershipData, error: ownershipError } = await client
        .from('grid_season_territory_state')
        .select('territory_id,owner_player_id')
        .eq('season_id', seasonId)
        .in('owner_player_id', memberPlayerIds);
      if (ownershipError) {
        throw new Error(`Failed to read Grid Alliance territory ownership: ${ownershipError.message}`);
      }
      const ownershipRows = (ownershipData ?? []) as Array<{
        territory_id: string;
        owner_player_id: string;
      }>;
      if (ownershipRows.length === 0) {
        return { territoryOwnership: [], adjacencyEdges: [] };
      }

      const territoryIds = [...new Set(ownershipRows.map((row) => row.territory_id))];
      const { data: territoryData, error: territoryError } = await client
        .from('grid_territories')
        .select('id,slug')
        .eq('city_id', cityId)
        .in('id', territoryIds);
      if (territoryError) {
        throw new Error(`Failed to read Grid Alliance territory slugs: ${territoryError.message}`);
      }
      const slugById = new Map(
        ((territoryData ?? []) as Array<{ id: string; slug: string }>).map((row) => [
          row.id,
          row.slug,
        ]),
      );
      const territoryOwnership = ownershipRows
        .map((row) => ({
          territorySlug: slugById.get(row.territory_id) ?? '',
          ownerPlayerId: row.owner_player_id,
        }))
        .filter((row) => row.territorySlug.length > 0)
        .sort((left, right) => left.territorySlug.localeCompare(right.territorySlug));

      const { data: edgeData, error: edgeError } = await client
        .from('grid_territory_edges')
        .select('territory_a_id,territory_b_id')
        .eq('city_id', cityId);
      if (edgeError) {
        throw new Error(`Failed to read Grid Alliance territory adjacency: ${edgeError.message}`);
      }
      const controlledIds = new Set(ownershipRows.map((row) => row.territory_id));
      const adjacencyEdges = ((edgeData ?? []) as Array<{
        territory_a_id: string;
        territory_b_id: string;
      }>)
        .filter(
          (row) =>
            controlledIds.has(row.territory_a_id) &&
            controlledIds.has(row.territory_b_id),
        )
        .map((row) => ({
          fromTerritorySlug: slugById.get(row.territory_a_id) ?? '',
          toTerritorySlug: slugById.get(row.territory_b_id) ?? '',
        }))
        .filter(
          (row) =>
            row.fromTerritorySlug.length > 0 && row.toTerritorySlug.length > 0,
        )
        .sort((left, right) =>
          `${left.fromTerritorySlug}:${left.toTerritorySlug}`.localeCompare(
            `${right.fromTerritorySlug}:${right.toTerritorySlug}`,
          ),
        );

      return { territoryOwnership, adjacencyEdges };
    },

    async getUpkeepSettlementReplay(seasonId, allianceId, idempotencyKey) {
      const { data, error } = await client
        .from('grid_game_events')
        .select('id,payload')
        .eq('season_id', seasonId)
        .eq('entity_id', allianceId)
        .eq('event_type', 'alliance_upkeep_settlement')
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();
      if (error) {
        throw new Error(`Failed to replay Grid Alliance upkeep: ${error.message}`);
      }
      if (!data) return null;
      const event = data as { id: string; payload: unknown };
      const payload = requireObject<
        Omit<GridAllianceUpkeepPersistenceResult, 'eventId' | 'replayed'>
      >(event.payload, 'Grid Alliance upkeep replay');
      return { ...payload, eventId: event.id, replayed: true };
    },

    async applyUpkeepSettlement(command) {
      const { data, error } = await client.rpc('grid_settle_alliance_upkeep', {
        p_alliance_id: command.allianceId,
        p_season_id: command.seasonId,
        p_expected_alliance_revision: command.expectedAllianceRevision,
        p_expected_pool_influence: command.expectedPoolInfluence,
        p_ticks: command.ticks,
        p_active_member_count: command.activeMemberCount,
        p_disconnected_component_count: command.disconnectedComponentCount,
        p_per_tick_influence: command.perTickInfluence,
        p_total_influence: command.totalInfluence,
        p_paid_influence: command.paidInfluence,
        p_pool_influence_after: command.poolInfluenceAfter,
        p_shortfall_influence: command.shortfallInfluence,
        p_fully_paid: command.fullyPaid,
        p_breakdown: command.breakdown,
        p_idempotency_key: command.idempotencyKey,
        p_now: command.now,
      });
      if (error) {
        throw new Error(`Failed to settle Grid Alliance upkeep: ${error.message}`);
      }
      if (data === null) return null;
      return requireObject<GridAllianceUpkeepPersistenceResult>(
        data,
        'Grid Alliance upkeep settlement',
      );
    },
  };
}

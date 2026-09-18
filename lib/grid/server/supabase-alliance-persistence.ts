import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../supabase';
import type { GridAllianceMembership } from '../core/alliance-types';
import type {
  GridAlliancePersistencePort,
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
  };
}

import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../supabase';
import type {
  GridScrimmageRules,
  GridScrimmageState,
} from '../core/scrimmage-types';
import type {
  GridScrimmagePort,
  GridScrimmageUpdateResult,
} from './scrimmage-port';

interface GridScrimmageRow {
  id: string;
  city_id: string;
  host_player_id: string;
  invite_code: string;
  status: GridScrimmageState['status'];
  progression_scope: 'session-only';
  participants: GridScrimmageState['participants'];
  rules: GridScrimmageRules;
  revision: number;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
}

function mapRow(row: GridScrimmageRow): GridScrimmageState {
  return {
    sessionId: row.id,
    cityId: row.city_id,
    hostPlayerId: row.host_player_id,
    inviteCode: row.invite_code,
    status: row.status,
    progressionScope: row.progression_scope,
    participants: row.participants.map((participant) => ({
      ...participant,
    })),
    rules: { ...row.rules },
    revision: row.revision,
    createdAt: row.created_at,
    startedAt: row.started_at,
    endedAt: row.ended_at,
  };
}

function toRow(state: GridScrimmageState) {
  return {
    id: state.sessionId,
    city_id: state.cityId,
    host_player_id: state.hostPlayerId,
    invite_code: state.inviteCode,
    status: state.status,
    progression_scope: state.progressionScope,
    participants: state.participants,
    rules: state.rules,
    revision: state.revision,
    created_at: state.createdAt,
    started_at: state.startedAt,
    ended_at: state.endedAt,
  };
}

export function createSupabaseGridScrimmagePort(
  client: SupabaseClient | null = supabaseAdmin,
): GridScrimmagePort {
  if (!client) {
    throw new Error(
      'Grid scrimmage persistence requires Supabase service-role configuration',
    );
  }

  return {
    async create(state) {
      const { data, error } = await client
        .from('grid_scrimmage_sessions')
        .insert(toRow(state))
        .select()
        .single();

      if (error?.code === '23505') {
        return { created: false, state: null };
      }

      if (error || !data) {
        throw new Error(
          `Failed to create Grid scrimmage session: ${error?.message ?? 'unknown error'}`,
        );
      }

      return {
        created: true,
        state: mapRow(data as unknown as GridScrimmageRow),
      };
    },

    async getById(sessionId) {
      const { data, error } = await client
        .from('grid_scrimmage_sessions')
        .select('*')
        .eq('id', sessionId)
        .maybeSingle();

      if (error) {
        throw new Error(
          `Failed to read Grid scrimmage session: ${error.message}`,
        );
      }

      return data
        ? mapRow(data as unknown as GridScrimmageRow)
        : null;
    },

    async getByInviteCode(inviteCode) {
      const { data, error } = await client
        .from('grid_scrimmage_sessions')
        .select('*')
        .eq('invite_code', inviteCode)
        .in('status', ['lobby', 'active'])
        .maybeSingle();

      if (error) {
        throw new Error(
          `Failed to read Grid scrimmage invite: ${error.message}`,
        );
      }

      return data
        ? mapRow(data as unknown as GridScrimmageRow)
        : null;
    },

    async compareAndSwap(
      sessionId,
      expectedRevision,
      nextState,
    ): Promise<GridScrimmageUpdateResult> {
      const row = toRow(nextState);
      const { data, error } = await client
        .from('grid_scrimmage_sessions')
        .update({
          status: row.status,
          participants: row.participants,
          rules: row.rules,
          revision: row.revision,
          started_at: row.started_at,
          ended_at: row.ended_at,
        })
        .eq('id', sessionId)
        .eq('revision', expectedRevision)
        .select()
        .maybeSingle();

      if (error) {
        throw new Error(
          `Failed to update Grid scrimmage session: ${error.message}`,
        );
      }

      if (!data) {
        return { updated: false, state: null };
      }

      return {
        updated: true,
        state: mapRow(data as unknown as GridScrimmageRow),
      };
    },
  };
}

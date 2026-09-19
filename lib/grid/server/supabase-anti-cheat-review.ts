import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../supabase';
import type { GridAntiCheatAssessment, GridAntiCheatSignal } from '../core/anti-cheat-types';
import type {
  GridAntiCheatReviewCommand,
  GridAntiCheatReviewPort,
  GridAntiCheatReviewQueueItem,
  GridAntiCheatReviewStateCommand,
  GridAntiCheatReviewResult,
} from './anti-cheat-review-port';

function requireObject<T>(data: unknown, label: string): T {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(`${label} returned an invalid result`);
  return data as T;
}

export function createSupabaseGridAntiCheatReviewPort(
  client: SupabaseClient | null = supabaseAdmin,
): GridAntiCheatReviewPort {
  if (!client) throw new Error('Grid anti-cheat review requires Supabase service-role configuration');

  return {
    async recordAssessment(command) {
      const { data, error } = await client.rpc('grid_record_anti_cheat_assessment', {
        p_city_id: command.cityId,
        p_season_id: command.seasonId,
        p_player_id: command.playerId,
        p_action_id: command.actionId,
        p_assessment_key: command.assessmentKey,
        p_risk_score_bps: command.assessment.riskScoreBps,
        p_disposition: command.assessment.disposition,
        p_signal_ids: command.assessment.signalIds,
        p_hard_reject_signal_ids: command.assessment.hardRejectSignalIds,
        p_signals: command.signals,
        p_created_at: command.createdAt,
      });
      if (error) throw new Error(`Failed to record Grid anti-cheat assessment: ${error.message}`);
      return requireObject<GridAntiCheatReviewResult>(data, 'Grid anti-cheat assessment');
    },

    async listReviewQueue(limit = 100) {
      const { data, error } = await client.rpc('grid_list_anti_cheat_review_queue', { p_limit: limit });
      if (error) throw new Error(`Failed to read Grid anti-cheat review queue: ${error.message}`);
      if (!Array.isArray(data)) throw new Error('Grid anti-cheat review queue returned an invalid result');
      return data as GridAntiCheatReviewQueueItem[];
    },

    async recordReview(command) {
      const { data, error } = await client.rpc('grid_record_anti_cheat_review', {
        p_assessment_id: command.assessmentId,
        p_status: command.status,
        p_resolution: command.resolution ?? null,
      });
      if (error) throw new Error(`Failed to record Grid anti-cheat review state: ${error.message}`);
      return requireObject<GridAntiCheatReviewQueueItem>(data, 'Grid anti-cheat review state');
    },
  };
}

export type { GridAntiCheatAssessment, GridAntiCheatSignal };

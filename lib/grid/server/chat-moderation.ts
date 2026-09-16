import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../supabase';
import type { GridChatChannelType } from '../core/chat-types';

export type GridChatModerationAction = 'hide' | 'remove' | 'restore' | 'dismiss';

export interface GridChatModerationReport {
  reportId: string;
  reason: string;
  details: string | null;
  status: string;
  reportedAt: string;
  reporter: { playerId: string; callsign: string };
  message: {
    messageId: string;
    body: string;
    status: string;
    createdAt: string;
    sender: { playerId: string; callsign: string };
  };
  channel: {
    channelId: string;
    channelType: GridChatChannelType;
    displayName: string;
  };
}

type ReportRow = {
  id: string;
  message_id: string;
  reporter_player_id: string;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
};
type MessageRow = {
  id: string;
  channel_id: string;
  sender_player_id: string;
  body: string;
  status: string;
  created_at: string;
};
type ChannelRow = {
  id: string;
  channel_type: GridChatChannelType;
  display_name: string | null;
};
type PlayerRow = { id: string; display_name: string };

export function createSupabaseGridChatModeration(
  client: SupabaseClient | null = supabaseAdmin,
) {
  if (!client) throw new Error('Grid chat moderation requires Supabase service-role configuration');

  return {
    async listReports(status = 'pending', limit = 100): Promise<GridChatModerationReport[]> {
      const allowed = new Set(['pending', 'reviewing', 'resolved', 'dismissed', 'all']);
      if (!allowed.has(status)) throw new Error('Unknown Grid chat report status');
      const safeLimit = Math.max(1, Math.min(250, Math.floor(limit)));
      let query = client
        .from('grid_chat_reports')
        .select('id,message_id,reporter_player_id,reason,details,status,created_at')
        .order('created_at', { ascending: true })
        .limit(safeLimit);
      if (status !== 'all') query = query.eq('status', status);
      const reportResult = await query;
      if (reportResult.error) throw new Error(`Failed to read Grid chat reports: ${reportResult.error.message}`);
      const reports = (reportResult.data ?? []) as ReportRow[];
      if (reports.length === 0) return [];

      const messageIds = [...new Set(reports.map((row) => row.message_id))];
      const messageResult = await client
        .from('grid_chat_messages')
        .select('id,channel_id,sender_player_id,body,status,created_at')
        .in('id', messageIds);
      if (messageResult.error) throw new Error(`Failed to read reported Grid chat messages: ${messageResult.error.message}`);
      const messages = (messageResult.data ?? []) as MessageRow[];
      const messageById = new Map(messages.map((row) => [row.id, row] as const));

      const channelIds = [...new Set(messages.map((row) => row.channel_id))];
      const channelResult = await client
        .from('grid_chat_channels')
        .select('id,channel_type,display_name')
        .in('id', channelIds);
      if (channelResult.error) throw new Error(`Failed to read reported Grid chat channels: ${channelResult.error.message}`);
      const channelById = new Map(
        ((channelResult.data ?? []) as ChannelRow[]).map((row) => [row.id, row] as const),
      );

      const playerIds = [...new Set([
        ...reports.map((row) => row.reporter_player_id),
        ...messages.map((row) => row.sender_player_id),
      ])];
      const playerResult = await client
        .from('players')
        .select('id,display_name')
        .in('id', playerIds);
      if (playerResult.error) throw new Error(`Failed to read Grid chat moderation players: ${playerResult.error.message}`);
      const playerById = new Map(
        ((playerResult.data ?? []) as PlayerRow[]).map((row) => [row.id, row] as const),
      );

      return reports.flatMap((report) => {
        const message = messageById.get(report.message_id);
        if (!message) return [];
        const sender = playerById.get(message.sender_player_id);
        const reporter = playerById.get(report.reporter_player_id);
        const channel = channelById.get(message.channel_id);
        if (!sender || !reporter || !channel) return [];
        return [{
          reportId: report.id,
          reason: report.reason,
          details: report.details,
          status: report.status,
          reportedAt: report.created_at,
          reporter: { playerId: reporter.id, callsign: reporter.display_name },
          message: {
            messageId: message.id,
            body: message.body,
            status: message.status,
            createdAt: message.created_at,
            sender: { playerId: sender.id, callsign: sender.display_name },
          },
          channel: {
            channelId: channel.id,
            channelType: channel.channel_type,
            displayName: channel.display_name ?? channel.channel_type.toUpperCase(),
          },
        }];
      });
    },

    async moderate(reportId: string, action: GridChatModerationAction, reviewerLabel: string, now: string) {
      const { data, error } = await client.rpc('grid_moderate_chat_report', {
        p_report_id: reportId,
        p_action: action,
        p_reviewer_label: reviewerLabel,
        p_now: now,
      });
      if (error) throw new Error(`Failed to moderate Grid chat report: ${error.message}`);
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error('Grid chat moderation returned an invalid result');
      }
      return data as { reportId: string; messageId: string; action: GridChatModerationAction; messageStatus: string };
    },
  };
}

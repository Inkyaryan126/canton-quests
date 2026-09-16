import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../supabase';
import type {
  GridChatChannelSummary,
  GridChatMessagePage,
  GridChatMessageView,
  GridChatPublicPlayer,
  GridChatReportResult,
  GridChatSendResult,
} from '../core/chat-types';
import type { GridCityPackage } from '../core/types';
import type { GridChatPort } from './chat-port';

type MembershipRow = {
  channel_id: string;
  role: string;
  last_read_at: string | null;
  muted_until: string | null;
  notifications_enabled: boolean;
};

type ChannelRow = {
  id: string;
  channel_type: GridChatChannelSummary['channelType'];
  display_name: string | null;
  last_message_at: string | null;
};

type MessageRow = {
  id: string;
  channel_id: string;
  sender_player_id: string;
  body: string;
  reply_to_message_id: string | null;
  created_at: string;
  edited_at: string | null;
};

type PlayerRow = {
  id: string;
  display_name: string;
  avatar_url: string | null;
};

function rpcObject<T>(data: unknown, label: string): T {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`${label} returned an invalid result`);
  }
  return data as T;
}

function mapPlayer(row: PlayerRow): GridChatPublicPlayer {
  return {
    playerId: row.id,
    callsign: row.display_name,
    avatarUrl: row.avatar_url,
  };
}

async function loadProfiles(
  client: SupabaseClient,
  ids: string[],
): Promise<Map<string, GridChatPublicPlayer>> {
  const uniqueIds = [...new Set(ids)].filter(Boolean);
  if (uniqueIds.length === 0) return new Map();
  const { data, error } = await client
    .from('players')
    .select('id,display_name,avatar_url')
    .in('id', uniqueIds);
  if (error) throw new Error(`Failed to read Grid chat player profiles: ${error.message}`);
  return new Map(
    ((data ?? []) as PlayerRow[]).map((row) => [row.id, mapPlayer(row)] as const),
  );
}

export async function resolveSupabaseGridChatSeasonId(
  pkg: GridCityPackage,
  client: SupabaseClient | null = supabaseAdmin,
): Promise<string | null> {
  if (!client) throw new Error('Grid chat requires Supabase service-role configuration');

  const cityResult = await client
    .from('grid_cities')
    .select('id')
    .eq('slug', pkg.city.slug)
    .maybeSingle();
  if (cityResult.error) throw new Error(`Failed to resolve Grid chat city: ${cityResult.error.message}`);
  if (!cityResult.data) return null;

  const city = cityResult.data as { id: string };
  const seasonResult = await client
    .from('grid_seasons')
    .select('id')
    .eq('city_id', city.id)
    .eq('slug', pkg.seasonTemplate.slug)
    .maybeSingle();
  if (seasonResult.error) throw new Error(`Failed to resolve Grid chat season: ${seasonResult.error.message}`);
  return (seasonResult.data as { id: string } | null)?.id ?? null;
}

export function createSupabaseGridChatPort(
  client: SupabaseClient | null = supabaseAdmin,
): GridChatPort {
  if (!client) throw new Error('Grid chat requires Supabase service-role configuration');

  return {
    async ensureCityChannel(seasonId, playerId, now) {
      const { data, error } = await client.rpc('grid_ensure_city_chat_channel', {
        p_season_id: seasonId,
        p_player_id: playerId,
        p_now: now,
      });
      if (error) throw new Error(`Failed to open Grid city chat: ${error.message}`);
      const result = rpcObject<{ channelId: string }>(data, 'Grid city chat');
      return { channelId: result.channelId };
    },

    async resolvePlayerByCallsign(callsign) {
      const { data, error } = await client.rpc('grid_resolve_chat_callsign', {
        p_callsign: callsign,
      });
      if (error) throw new Error(`Failed to resolve Grid chat callsign: ${error.message}`);
      if (data === null) return null;
      return rpcObject<GridChatPublicPlayer>(data, 'Grid chat callsign');
    },

    async createDirectChannel(seasonId, playerId, targetPlayerId, now) {
      const { data, error } = await client.rpc('grid_create_direct_chat_channel', {
        p_season_id: seasonId,
        p_player_id: playerId,
        p_target_player_id: targetPlayerId,
        p_now: now,
      });
      if (error) throw new Error(`Failed to create Grid direct chat: ${error.message}`);
      const result = rpcObject<{ channelId: string }>(data, 'Grid direct chat');
      return { channelId: result.channelId };
    },

    async listChannels(seasonId, playerId) {
      const membershipResult = await client
        .from('grid_chat_members')
        .select('channel_id,role,last_read_at,muted_until,notifications_enabled')
        .eq('player_id', playerId)
        .is('left_at', null);
      if (membershipResult.error) {
        throw new Error(`Failed to read Grid chat memberships: ${membershipResult.error.message}`);
      }
      const memberships = (membershipResult.data ?? []) as MembershipRow[];
      if (memberships.length === 0) return [];

      const membershipByChannel = new Map(
        memberships.map((row) => [row.channel_id, row] as const),
      );
      const channelIds = memberships.map((row) => row.channel_id);
      const channelResult = await client
        .from('grid_chat_channels')
        .select('id,channel_type,display_name,last_message_at')
        .eq('season_id', seasonId)
        .eq('is_archived', false)
        .in('id', channelIds);
      if (channelResult.error) {
        throw new Error(`Failed to read Grid chat channels: ${channelResult.error.message}`);
      }
      const channels = (channelResult.data ?? []) as ChannelRow[];

      const directIds = channels.filter((row) => row.channel_type === 'direct').map((row) => row.id);
      const directPeerByChannel = new Map<string, GridChatPublicPlayer>();
      if (directIds.length > 0) {
        const peerMembershipResult = await client
          .from('grid_chat_members')
          .select('channel_id,player_id')
          .in('channel_id', directIds)
          .is('left_at', null);
        if (peerMembershipResult.error) {
          throw new Error(`Failed to read Grid direct chat members: ${peerMembershipResult.error.message}`);
        }
        const peers = ((peerMembershipResult.data ?? []) as Array<{ channel_id: string; player_id: string }>)
          .filter((row) => row.player_id !== playerId);
        const profileById = await loadProfiles(client, peers.map((row) => row.player_id));
        for (const peer of peers) {
          const profile = profileById.get(peer.player_id);
          if (profile) directPeerByChannel.set(peer.channel_id, profile);
        }
      }

      const summaries = await Promise.all(
        channels.map(async (channel): Promise<GridChatChannelSummary> => {
          const membership = membershipByChannel.get(channel.id)!;
          let unreadQuery = client
            .from('grid_chat_messages')
            .select('id', { count: 'exact', head: true })
            .eq('channel_id', channel.id)
            .eq('status', 'visible')
            .neq('sender_player_id', playerId);
          if (membership.last_read_at) {
            unreadQuery = unreadQuery.gt('created_at', membership.last_read_at);
          }
          const unreadResult = await unreadQuery;
          if (unreadResult.error) {
            throw new Error(`Failed to count Grid chat unread messages: ${unreadResult.error.message}`);
          }

          const peer = directPeerByChannel.get(channel.id) ?? null;
          const fallback = channel.channel_type === 'city'
            ? 'CITY // OPEN CHANNEL'
            : channel.channel_type.toUpperCase();
          return {
            channelId: channel.id,
            channelType: channel.channel_type,
            displayName: peer?.callsign ?? channel.display_name ?? fallback,
            lastMessageAt: channel.last_message_at,
            unreadCount: unreadResult.count ?? 0,
            mutedUntil: membership.muted_until,
            notificationsEnabled: membership.notifications_enabled,
            memberRole: membership.role as 'member' | 'moderator' | 'owner',
            directPeer: peer,
          };
        }),
      );

      return summaries.sort((a, b) => {
        const aTime = a.lastMessageAt ?? '';
        const bTime = b.lastMessageAt ?? '';
        return bTime.localeCompare(aTime) || a.displayName.localeCompare(b.displayName);
      });
    },

    async listDistricts(seasonId, playerId) {
      const seasonResult = await client.from('grid_seasons').select('city_id').eq('id', seasonId).maybeSingle();
      if (seasonResult.error) throw new Error(`Failed to read Grid chat season: ${seasonResult.error.message}`);
      if (!seasonResult.data) return [];
      const cityId = (seasonResult.data as { city_id: string }).city_id;

      const districtResult = await client.from('grid_districts').select('id,name').eq('city_id', cityId).order('name', { ascending: true });
      if (districtResult.error) throw new Error(`Failed to read Grid chat districts: ${districtResult.error.message}`);
      const districts = (districtResult.data ?? []) as Array<{ id: string; name: string }>;

      const channelResult = await client
        .from('grid_chat_channels')
        .select('id,scope_key')
        .eq('season_id', seasonId)
        .eq('channel_type', 'district')
        .eq('is_archived', false);
      if (channelResult.error) throw new Error(`Failed to read Grid district chat channels: ${channelResult.error.message}`);
      const channels = (channelResult.data ?? []) as Array<{ id: string; scope_key: string }>;
      const channelByDistrict = new Map(channels.map((row) => [row.scope_key.replace(/^district:/, ''), row.id] as const));

      const channelIds = channels.map((row) => row.id);
      let joined = new Set<string>();
      if (channelIds.length > 0) {
        const membershipResult = await client
          .from('grid_chat_members')
          .select('channel_id')
          .eq('player_id', playerId)
          .is('left_at', null)
          .in('channel_id', channelIds);
        if (membershipResult.error) throw new Error(`Failed to read Grid district chat membership: ${membershipResult.error.message}`);
        joined = new Set(((membershipResult.data ?? []) as Array<{ channel_id: string }>).map((row) => row.channel_id));
      }

      return districts.map((district) => {
        const channelId = channelByDistrict.get(district.id) ?? null;
        return { districtId: district.id, name: district.name, channelId, joined: Boolean(channelId && joined.has(channelId)) };
      });
    },

    async joinDistrict(seasonId, playerId, districtId, now) {
      const { data, error } = await client.rpc('grid_join_district_chat_channel', {
        p_season_id: seasonId, p_player_id: playerId, p_district_id: districtId, p_now: now,
      });
      if (error) throw new Error(`Failed to join Grid district chat: ${error.message}`);
      const result = rpcObject<{ channelId: string }>(data, 'Grid district chat');
      return { channelId: result.channelId };
    },

    async createParty(seasonId, ownerPlayerId, displayName, now) {
      const { data, error } = await client.rpc('grid_create_party_chat_channel', {
        p_season_id: seasonId, p_owner_player_id: ownerPlayerId, p_display_name: displayName, p_now: now,
      });
      if (error) throw new Error(`Failed to create Grid party chat: ${error.message}`);
      const result = rpcObject<{ channelId: string }>(data, 'Grid party chat');
      return { channelId: result.channelId };
    },

    async addPartyMember(channelId, actorPlayerId, targetPlayerId, now) {
      const { error } = await client.rpc('grid_add_party_chat_member', {
        p_channel_id: channelId, p_actor_player_id: actorPlayerId, p_target_player_id: targetPlayerId, p_now: now,
      });
      if (error) throw new Error(`Failed to invite Grid party member: ${error.message}`);
    },

    async leaveParty(channelId, playerId, now) {
      const { error } = await client.rpc('grid_leave_party_chat', {
        p_channel_id: channelId, p_player_id: playerId, p_now: now,
      });
      if (error) throw new Error(`Failed to leave Grid party chat: ${error.message}`);
    },

    async listPartyMembers(channelId, playerId) {
      const actorResult = await client
        .from('grid_chat_members')
        .select('role')
        .eq('channel_id', channelId)
        .eq('player_id', playerId)
        .is('left_at', null)
        .maybeSingle();
      if (actorResult.error) throw new Error(`Failed to verify Grid party membership: ${actorResult.error.message}`);
      if (!actorResult.data) throw new Error('Grid chat membership required');

      const channelResult = await client
        .from('grid_chat_channels')
        .select('channel_type')
        .eq('id', channelId)
        .eq('is_archived', false)
        .maybeSingle();
      if (channelResult.error) throw new Error(`Failed to verify Grid party channel: ${channelResult.error.message}`);
      if (!channelResult.data || (channelResult.data as { channel_type: string }).channel_type !== 'party') {
        throw new Error('Grid chat channel is not a party');
      }

      const memberResult = await client
        .from('grid_chat_members')
        .select('player_id,role,joined_at')
        .eq('channel_id', channelId)
        .is('left_at', null)
        .order('joined_at', { ascending: true });
      if (memberResult.error) throw new Error(`Failed to read Grid party members: ${memberResult.error.message}`);
      const rows = (memberResult.data ?? []) as Array<{ player_id: string; role: 'member' | 'moderator' | 'owner'; joined_at: string }>;
      const profiles = await loadProfiles(client, rows.map((row) => row.player_id));
      return rows.flatMap((row) => {
        const profile = profiles.get(row.player_id);
        return profile ? [{ ...profile, role: row.role, joinedAt: row.joined_at }] : [];
      });
    },

    async setPartyMemberRole(channelId, actorPlayerId, targetPlayerId, role, now) {
      const { error } = await client.rpc('grid_set_party_chat_member_role', {
        p_channel_id: channelId, p_actor_player_id: actorPlayerId, p_target_player_id: targetPlayerId, p_role: role, p_now: now,
      });
      if (error) throw new Error(`Failed to update Grid party role: ${error.message}`);
    },

    async removePartyMember(channelId, actorPlayerId, targetPlayerId, now) {
      const { error } = await client.rpc('grid_remove_party_chat_member', {
        p_channel_id: channelId, p_actor_player_id: actorPlayerId, p_target_player_id: targetPlayerId, p_now: now,
      });
      if (error) throw new Error(`Failed to remove Grid party member: ${error.message}`);
    },

    async transferPartyOwner(channelId, ownerPlayerId, targetPlayerId, now) {
      const { error } = await client.rpc('grid_transfer_party_chat_owner', {
        p_channel_id: channelId, p_owner_player_id: ownerPlayerId, p_target_player_id: targetPlayerId, p_now: now,
      });
      if (error) throw new Error(`Failed to transfer Grid party ownership: ${error.message}`);
    },

    async listMessages({ channelId, playerId, limit, before }): Promise<GridChatMessagePage> {
      const memberResult = await client
        .from('grid_chat_members')
        .select('channel_id')
        .eq('channel_id', channelId)
        .eq('player_id', playerId)
        .is('left_at', null)
        .maybeSingle();
      if (memberResult.error) {
        throw new Error(`Failed to verify Grid chat membership: ${memberResult.error.message}`);
      }
      if (!memberResult.data) throw new Error('Grid chat membership required');

      const blockResult = await client
        .from('grid_chat_blocks')
        .select('blocked_player_id')
        .eq('blocker_player_id', playerId);
      if (blockResult.error) {
        throw new Error(`Failed to read Grid chat blocks: ${blockResult.error.message}`);
      }
      const blocked = new Set(
        ((blockResult.data ?? []) as Array<{ blocked_player_id: string }>).map((row) => row.blocked_player_id),
      );

      const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
      const fetchLimit = Math.min(200, safeLimit + blocked.size + 25);
      let query = client
        .from('grid_chat_messages')
        .select('id,channel_id,sender_player_id,body,reply_to_message_id,created_at,edited_at')
        .eq('channel_id', channelId)
        .eq('status', 'visible')
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(fetchLimit);
      if (before) query = query.lt('created_at', before);
      const messageResult = await query;
      if (messageResult.error) {
        throw new Error(`Failed to read Grid chat messages: ${messageResult.error.message}`);
      }
      const rawRows = (messageResult.data ?? []) as MessageRow[];
      const visibleRows = rawRows.filter((row) => !blocked.has(row.sender_player_id)).slice(0, safeLimit);
      const profileById = await loadProfiles(client, visibleRows.map((row) => row.sender_player_id));

      const messages = visibleRows
        .map((row): GridChatMessageView | null => {
          const sender = profileById.get(row.sender_player_id);
          if (!sender) return null;
          return {
            messageId: row.id,
            channelId: row.channel_id,
            sender,
            body: row.body,
            replyToMessageId: row.reply_to_message_id,
            createdAt: row.created_at,
            editedAt: row.edited_at,
            isMine: row.sender_player_id === playerId,
          };
        })
        .filter((row): row is GridChatMessageView => Boolean(row))
        .reverse();

      return {
        messages,
        nextBefore: rawRows.length >= fetchLimit
          ? rawRows[rawRows.length - 1]?.created_at ?? null
          : null,
      };
    },

    async sendMessage(input): Promise<GridChatSendResult> {
      const { data, error } = await client.rpc('grid_send_chat_message', {
        p_channel_id: input.channelId,
        p_sender_player_id: input.senderPlayerId,
        p_body: input.body,
        p_client_nonce: input.clientNonce,
        p_reply_to_message_id: input.replyToMessageId,
        p_now: input.now,
      });
      if (error) throw new Error(`Failed to send Grid chat message: ${error.message}`);
      return rpcObject<GridChatSendResult>(data, 'Grid chat send');
    },

    async markRead(channelId, playerId, readAt) {
      const { error } = await client.rpc('grid_mark_chat_read', {
        p_channel_id: channelId,
        p_player_id: playerId,
        p_read_at: readAt,
      });
      if (error) throw new Error(`Failed to mark Grid chat read: ${error.message}`);
    },

    async setBlock(playerId, blockedPlayerId, blocked, now) {
      const { error } = await client.rpc('grid_set_chat_block', {
        p_player_id: playerId,
        p_blocked_player_id: blockedPlayerId,
        p_blocked: blocked,
        p_now: now,
      });
      if (error) throw new Error(`Failed to update Grid chat block: ${error.message}`);
    },

    async reportMessage(command): Promise<GridChatReportResult> {
      const { data, error } = await client.rpc('grid_report_chat_message', {
        p_message_id: command.messageId,
        p_reporter_player_id: command.reporterPlayerId,
        p_reason: command.reason,
        p_details: command.details,
        p_now: command.now,
      });
      if (error) throw new Error(`Failed to report Grid chat message: ${error.message}`);
      return rpcObject<GridChatReportResult>(data, 'Grid chat report');
    },
  };
}

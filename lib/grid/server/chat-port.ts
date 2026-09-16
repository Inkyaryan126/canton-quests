import type {
  GridChatChannelSummary,
  GridChatMessagePage,
  GridChatReportCommand,
  GridChatReportResult,
  GridChatSendResult,
  GridChatPublicPlayer,
  GridChatDistrictOption,
  GridChatPartyMember,
} from '../core/chat-types';

export interface GridChatPort {
  ensureCityChannel(seasonId: string, playerId: string, now: string): Promise<{ channelId: string }>;
  resolvePlayerByCallsign(callsign: string): Promise<GridChatPublicPlayer | null>;
  createDirectChannel(
    seasonId: string,
    playerId: string,
    targetPlayerId: string,
    now: string,
  ): Promise<{ channelId: string }>;
  listChannels(seasonId: string, playerId: string): Promise<GridChatChannelSummary[]>;
  listDistricts(seasonId: string, playerId: string): Promise<GridChatDistrictOption[]>;
  joinDistrict(seasonId: string, playerId: string, districtId: string, now: string): Promise<{ channelId: string }>;
  createParty(seasonId: string, ownerPlayerId: string, displayName: string, now: string): Promise<{ channelId: string }>;
  addPartyMember(channelId: string, actorPlayerId: string, targetPlayerId: string, now: string): Promise<void>;
  leaveParty(channelId: string, playerId: string, now: string): Promise<void>;
  listPartyMembers(channelId: string, playerId: string): Promise<GridChatPartyMember[]>;
  setPartyMemberRole(channelId: string, actorPlayerId: string, targetPlayerId: string, role: 'member' | 'moderator', now: string): Promise<void>;
  removePartyMember(channelId: string, actorPlayerId: string, targetPlayerId: string, now: string): Promise<void>;
  transferPartyOwner(channelId: string, ownerPlayerId: string, targetPlayerId: string, now: string): Promise<void>;
  listMessages(input: {
    channelId: string;
    playerId: string;
    limit: number;
    before: string | null;
  }): Promise<GridChatMessagePage>;
  sendMessage(input: {
    channelId: string;
    senderPlayerId: string;
    body: string;
    clientNonce: string;
    replyToMessageId: string | null;
    now: string;
  }): Promise<GridChatSendResult>;
  markRead(channelId: string, playerId: string, readAt: string): Promise<void>;
  setBlock(playerId: string, blockedPlayerId: string, blocked: boolean, now: string): Promise<void>;
  reportMessage(command: GridChatReportCommand): Promise<GridChatReportResult>;
}

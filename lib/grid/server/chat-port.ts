import type {
  GridChatChannelSummary,
  GridChatMessagePage,
  GridChatReportCommand,
  GridChatReportResult,
  GridChatSendResult,
  GridChatPublicPlayer,
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

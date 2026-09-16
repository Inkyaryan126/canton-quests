import type { GridChatReportReason } from './chat';

export type GridChatChannelType = 'city' | 'district' | 'party' | 'direct' | 'system';

export interface GridChatPublicPlayer {
  playerId: string;
  callsign: string;
  avatarUrl: string | null;
}

export interface GridChatChannelSummary {
  channelId: string;
  channelType: GridChatChannelType;
  displayName: string;
  lastMessageAt: string | null;
  unreadCount: number;
  mutedUntil: string | null;
  notificationsEnabled: boolean;
  memberRole: 'member' | 'moderator' | 'owner';
  directPeer: GridChatPublicPlayer | null;
}

export interface GridChatMessageView {
  messageId: string;
  channelId: string;
  sender: GridChatPublicPlayer;
  body: string;
  replyToMessageId: string | null;
  createdAt: string;
  editedAt: string | null;
  isMine: boolean;
}

export interface GridChatMessagePage {
  messages: GridChatMessageView[];
  nextBefore: string | null;
}

export interface GridChatSendResult {
  messageId: string;
  createdAt: string;
  duplicate: boolean;
}

export interface GridChatReportResult {
  reportId: string;
  status: 'pending';
}

export interface GridChatReportCommand {
  messageId: string;
  reporterPlayerId: string;
  reason: GridChatReportReason;
  details: string | null;
  now: string;
}

export interface GridChatDistrictOption {
  districtId: string;
  name: string;
  joined: boolean;
  channelId: string | null;
}

export interface GridChatPartyMember extends GridChatPublicPlayer {
  role: 'member' | 'moderator' | 'owner';
  joinedAt: string;
}

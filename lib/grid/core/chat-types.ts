import type { GridChatReportReason } from './chat';

export type GridChatChannelType = 'city' | 'district' | 'party' | 'direct' | 'system' | 'room';

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

export interface GridChatMessageSender {
  playerId: string | null;
  callsign: string;
  avatarUrl: string | null;
  isSystem: boolean;
}

export interface GridChatMessageView {
  messageId: string;
  channelId: string;
  sequenceNo: number;
  sender: GridChatMessageSender;
  body: string;
  replyToMessageId: string | null;
  createdAt: string;
  editedAt: string | null;
  isMine: boolean;
}

export interface GridChatMessagePage {
  messages: GridChatMessageView[];
  nextBefore: string | null;
  cursorSequence: number | null;
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

export interface GridChatPartyInvite {
  inviteId: string;
  channelId: string;
  displayName: string;
  inviter: GridChatPublicPlayer;
  createdAt: string;
  expiresAt: string;
}

export interface GridChatRoomSummary {
  channelId: string;
  displayName: string;
  topic: string;
  memberCount: number;
  memberLimit: number;
  joined: boolean;
  lastMessageAt: string | null;
  owner: GridChatPublicPlayer | null;
}

import {
  normalizeGridChatBody,
  validateGridChatClientNonce,
  validateGridChatReport,
} from '../core/chat';
import type { GridChatPort } from './chat-port';

export async function openGridChat(
  port: GridChatPort,
  seasonId: string,
  playerId: string,
  now: string,
) {
  await port.ensureCityChannel(seasonId, playerId, now);
  return port.listChannels(seasonId, playerId);
}

export async function startGridDirectChat(
  port: GridChatPort,
  input: {
    seasonId: string;
    playerId: string;
    callsign: string;
    now: string;
  },
) {
  const callsign = input.callsign.trim();
  if (callsign.length < 2 || callsign.length > 80) {
    throw new Error('Enter a valid callsign');
  }
  const target = await port.resolvePlayerByCallsign(callsign);
  if (!target) throw new Error('Player callsign not found');
  if (target.playerId === input.playerId) throw new Error('You cannot direct-message yourself');

  const channel = await port.createDirectChannel(
    input.seasonId,
    input.playerId,
    target.playerId,
    input.now,
  );
  return { ...channel, target };
}

export async function sendGridChatMessage(
  port: GridChatPort,
  input: {
    channelId: string;
    senderPlayerId: string;
    body: string;
    clientNonce: string;
    replyToMessageId?: string | null;
    now: string;
  },
) {
  return port.sendMessage({
    channelId: input.channelId,
    senderPlayerId: input.senderPlayerId,
    body: normalizeGridChatBody(input.body),
    clientNonce: validateGridChatClientNonce(input.clientNonce),
    replyToMessageId: input.replyToMessageId ?? null,
    now: input.now,
  });
}

export async function reportGridChatMessage(
  port: GridChatPort,
  input: {
    messageId: string;
    reporterPlayerId: string;
    reason: string;
    details?: string | null;
    now: string;
  },
) {
  const report = validateGridChatReport(input.reason, input.details);
  return port.reportMessage({
    messageId: input.messageId,
    reporterPlayerId: input.reporterPlayerId,
    reason: report.reason,
    details: report.details,
    now: input.now,
  });
}

export async function createGridPartyChat(
  port: GridChatPort,
  input: { seasonId: string; ownerPlayerId: string; displayName: string; now: string },
) {
  const name = input.displayName.trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > 60) throw new Error('Party name must be 2–60 characters');
  return port.createParty(input.seasonId, input.ownerPlayerId, name, input.now);
}

export async function inviteGridPartyMember(
  port: GridChatPort,
  input: { channelId: string; actorPlayerId: string; callsign: string; now: string },
) {
  const callsign = input.callsign.trim();
  if (callsign.length < 2 || callsign.length > 80) throw new Error('Enter a valid callsign');
  const target = await port.resolvePlayerByCallsign(callsign);
  if (!target) throw new Error('Player callsign not found');
  if (target.playerId === input.actorPlayerId) throw new Error('You are already in this party');
  const invite = await port.invitePartyMember(
    input.channelId,
    input.actorPlayerId,
    target.playerId,
    input.now,
  );
  return { target, invite };
}

export async function listGridPartyInvites(
  port: GridChatPort,
  playerId: string,
  now: string,
) {
  return port.listPartyInvites(playerId, now);
}

export async function acceptGridPartyInvite(
  port: GridChatPort,
  inviteId: string,
  playerId: string,
  now: string,
) {
  if (!inviteId.trim()) throw new Error('Party invite id required');
  return port.acceptPartyInvite(inviteId, playerId, now);
}

export async function declineGridPartyInvite(
  port: GridChatPort,
  inviteId: string,
  playerId: string,
  now: string,
) {
  if (!inviteId.trim()) throw new Error('Party invite id required');
  return port.declinePartyInvite(inviteId, playerId, now);
}

export async function createGridChatRoom(
  port: GridChatPort,
  input: {
    seasonId: string;
    ownerPlayerId: string;
    displayName: string;
    topic?: string | null;
    memberLimit?: number;
    now: string;
  },
) {
  const displayName = input.displayName.trim().replace(/\s+/g, ' ');
  const topic = (input.topic ?? '').trim().replace(/\s+/g, ' ');
  const memberLimit = input.memberLimit ?? 50;
  if (displayName.length < 2 || displayName.length > 80) {
    throw new Error('Room name must be 2–80 characters');
  }
  if (topic.length > 240) throw new Error('Room topic must be 240 characters or fewer');
  if (!Number.isInteger(memberLimit) || memberLimit < 2 || memberLimit > 200) {
    throw new Error('Room capacity must be between 2 and 200 players');
  }
  return port.createRoom(
    input.seasonId,
    input.ownerPlayerId,
    displayName,
    topic,
    memberLimit,
    input.now,
  );
}

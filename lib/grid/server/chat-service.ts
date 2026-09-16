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

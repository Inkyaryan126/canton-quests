import { describe, expect, it, vi } from 'vitest';
import { openGridChat, reportGridChatMessage, sendGridChatMessage, startGridDirectChat } from '../lib/grid/server/chat-service';
import type { GridChatPort } from '../lib/grid/server/chat-port';

function port(overrides: Partial<GridChatPort> = {}): GridChatPort {
  return {
    ensureCityChannel: vi.fn().mockResolvedValue({ channelId: 'city-channel' }),
    resolvePlayerByCallsign: vi.fn().mockResolvedValue({ playerId: 'target', callsign: 'Target', avatarUrl: null }),
    createDirectChannel: vi.fn().mockResolvedValue({ channelId: 'direct-channel' }),
    listChannels: vi.fn().mockResolvedValue([]),
    listDistricts: vi.fn().mockResolvedValue([]),
    joinDistrict: vi.fn().mockResolvedValue({ channelId: 'district-channel' }),
    createParty: vi.fn().mockResolvedValue({ channelId: 'party-channel' }),
    addPartyMember: vi.fn().mockResolvedValue(undefined),
    leaveParty: vi.fn().mockResolvedValue(undefined),
    listPartyMembers: vi.fn().mockResolvedValue([]),
    setPartyMemberRole: vi.fn().mockResolvedValue(undefined),
    removePartyMember: vi.fn().mockResolvedValue(undefined),
    transferPartyOwner: vi.fn().mockResolvedValue(undefined),
    listMessages: vi.fn().mockResolvedValue({ messages: [], nextBefore: null }),
    sendMessage: vi.fn().mockResolvedValue({ messageId: 'm1', createdAt: 'now', duplicate: false }),
    markRead: vi.fn().mockResolvedValue(undefined),
    setBlock: vi.fn().mockResolvedValue(undefined),
    reportMessage: vi.fn().mockResolvedValue({ reportId: 'r1', status: 'pending' }),
    ...overrides,
  };
}

describe('GRID chat service', () => {
  it('ensures city membership before listing channels', async () => {
    const p = port();
    await openGridChat(p, 'season', 'player', '2026-09-16T09:00:00Z');
    expect((p.ensureCityChannel as any).mock.invocationCallOrder[0]).toBeLessThan(
      (p.listChannels as any).mock.invocationCallOrder[0],
    );
    expect(p.listChannels).toHaveBeenCalledWith('season', 'player');
  });

  it('starts a direct chat by resolved callsign instead of trusting a body player id', async () => {
    const p = port();
    const result = await startGridDirectChat(p, {
      seasonId: 'season',
      playerId: 'me',
      callsign: ' Target ',
      now: 'now',
    });
    expect(p.resolvePlayerByCallsign).toHaveBeenCalledWith('Target');
    expect(p.createDirectChannel).toHaveBeenCalledWith('season', 'me', 'target', 'now');
    expect(result.channelId).toBe('direct-channel');
  });

  it('normalizes and validates outgoing messages before calling the port', async () => {
    const p = port();
    await sendGridChatMessage(p, {
      channelId: 'channel',
      senderPlayerId: 'me',
      body: '  hello  ',
      clientNonce: ' chat-1 ',
      now: 'now',
    });
    expect(p.sendMessage).toHaveBeenCalledWith({
      channelId: 'channel',
      senderPlayerId: 'me',
      body: 'hello',
      clientNonce: 'chat-1',
      replyToMessageId: null,
      now: 'now',
    });
  });

  it('validates reports before persistence', async () => {
    const p = port();
    await reportGridChatMessage(p, {
      messageId: 'm1',
      reporterPlayerId: 'me',
      reason: 'spam',
      details: '  repeated links ',
      now: 'now',
    });
    expect(p.reportMessage).toHaveBeenCalledWith({
      messageId: 'm1',
      reporterPlayerId: 'me',
      reason: 'spam',
      details: 'repeated links',
      now: 'now',
    });
  });
});

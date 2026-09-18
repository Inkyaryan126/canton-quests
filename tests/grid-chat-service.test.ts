import { describe, expect, it, vi } from 'vitest';
import {
  acceptGridPartyInvite,
  declineGridPartyInvite,
  inviteGridPartyMember,
  listGridPartyInvites,
  openGridChat,
  reportGridChatMessage,
  sendGridChatMessage,
  startGridDirectChat,
} from '../lib/grid/server/chat-service';
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
    invitePartyMember: vi.fn().mockResolvedValue({
      inviteId: 'invite-1',
      expiresAt: '2026-09-17T10:00:00Z',
    }),
    listPartyInvites: vi.fn().mockResolvedValue([]),
    acceptPartyInvite: vi.fn().mockResolvedValue({ channelId: 'party-channel' }),
    declinePartyInvite: vi.fn().mockResolvedValue(undefined),
    leaveParty: vi.fn().mockResolvedValue(undefined),
    listPartyMembers: vi.fn().mockResolvedValue([]),
    setPartyMemberRole: vi.fn().mockResolvedValue(undefined),
    removePartyMember: vi.fn().mockResolvedValue(undefined),
    transferPartyOwner: vi.fn().mockResolvedValue(undefined),
    listMessages: vi.fn().mockResolvedValue({ messages: [], nextBefore: null, cursorSequence: null }),
    sendMessage: vi.fn().mockResolvedValue({ messageId: 'm1', createdAt: 'now', duplicate: false }),
    markRead: vi.fn().mockResolvedValue(undefined),
    setNotifications: vi.fn().mockResolvedValue(undefined),
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

  it('creates a consent invite instead of directly adding party membership', async () => {
    const p = port();
    const result = await inviteGridPartyMember(p, {
      channelId: 'party-channel',
      actorPlayerId: 'me',
      callsign: ' Target ',
      now: '2026-09-17T09:00:00Z',
    });

    expect(p.resolvePlayerByCallsign).toHaveBeenCalledWith('Target');
    expect(p.invitePartyMember).toHaveBeenCalledWith(
      'party-channel',
      'me',
      'target',
      '2026-09-17T09:00:00Z',
    );
    expect(result).toMatchObject({
      target: { playerId: 'target' },
      invite: { inviteId: 'invite-1' },
    });
  });

  it('routes invitee list, accept, and decline through authenticated player context', async () => {
    const p = port({
      listPartyInvites: vi.fn().mockResolvedValue([
        {
          inviteId: 'invite-1',
          channelId: 'party-channel',
          displayName: 'Night Crew',
          inviter: { playerId: 'owner', callsign: 'Owner', avatarUrl: null },
          createdAt: 'now',
          expiresAt: 'later',
        },
      ]),
    });

    await expect(listGridPartyInvites(p, 'me', 'now')).resolves.toHaveLength(1);
    await expect(
      acceptGridPartyInvite(p, 'invite-1', 'me', 'now'),
    ).resolves.toEqual({ channelId: 'party-channel' });
    await expect(
      declineGridPartyInvite(p, 'invite-1', 'me', 'now'),
    ).resolves.toBeUndefined();

    expect(p.listPartyInvites).toHaveBeenCalledWith('me', 'now');
    expect(p.acceptPartyInvite).toHaveBeenCalledWith('invite-1', 'me', 'now');
    expect(p.declinePartyInvite).toHaveBeenCalledWith('invite-1', 'me', 'now');
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

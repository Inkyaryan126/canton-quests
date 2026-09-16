import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(path.join(process.cwd(), 'app/grid/chat/grid-chat-client.tsx'), 'utf8');

describe('Grid chat page contract', () => {
  it('supports channels, direct chat, sending, blocking, and reporting', () => {
    for (const fragment of [
      '/api/grid/chat/channels',
      '/api/grid/chat/direct',
      '/api/grid/chat/districts',
      '/api/grid/chat/parties',
      '/api/grid/chat/rooms',
      '/api/grid/chat/block',
      '/report',
      'clientNonce',
    ]) {
      expect(source).toContain(fragment);
    }
  });

  it('renders a feature-flag standby experience without pretending chat is live', () => {
    expect(source).toContain('Network Standby');
    expect(source).toContain('The player communications network is being wired into Canton City 001');
  });

  it('exposes district and private party controls without GPS broadcasting', () => {
    expect(source).toContain('District Channels');
    expect(source).toContain('Create Party');
    expect(source).toContain('Chat Rooms');
    expect(source).toContain('Create Room');
    expect(source).toContain('Open Rooms');
    expect(source).toContain('Party Roster');
    expect(source).toContain('Make Owner');
    expect(source).toContain('Promote');
    expect(source).toContain('Your precise location is never broadcast');
    expect(source).not.toContain('navigator.geolocation');
  });

  it('polls for new messages without requiring direct browser access to Supabase tables', () => {
    expect(source).toContain('window.setInterval');
    expect(source).toContain('afterSequence');
    expect(source).toContain('1800');
    expect(source).toContain('8000');
    expect(source).not.toContain("from('grid_chat_messages')");
    expect(source).not.toContain('supabase.channel');
    expect(source).toContain('/notifications');
    expect(source).toContain('document.visibilityState');
  });

  it('shows consent-based party invitations with explicit accept and decline actions', () => {
    expect(source).toContain('/api/grid/chat/party-invites');
    expect(source).toContain('Party Invites');
    expect(source).toContain("respondToPartyInvite(invite, 'accept')");
    expect(source).toContain("respondToPartyInvite(invite, 'decline')");
    expect(source).toContain('Invited by');
    const responseFn = source
      .split('async function respondToPartyInvite', 2)[1]
      .split('async function loadPartyMembers', 1)[0];
    expect(responseFn).not.toContain('body: JSON.stringify');
    expect(responseFn).not.toContain('playerId');
  });
});

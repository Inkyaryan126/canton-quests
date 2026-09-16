import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(path.join(process.cwd(), 'app/grid/chat/grid-chat-client.tsx'), 'utf8');

describe('Grid chat page contract', () => {
  it('supports channels, direct chat, sending, blocking, and reporting', () => {
    for (const fragment of [
      '/api/grid/chat/channels',
      '/api/grid/chat/direct',
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

  it('polls for new messages without requiring direct browser access to Supabase tables', () => {
    expect(source).toContain('window.setInterval');
    expect(source).not.toContain("from('grid_chat_messages')");
    expect(source).not.toContain('supabase.channel');
  });
});

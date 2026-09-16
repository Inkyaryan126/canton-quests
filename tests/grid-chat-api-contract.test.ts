import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function source(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), 'utf8');
}

describe('GRID chat API safety contract', () => {
  it('keeps chat behind a dedicated opt-in flag', () => {
    expect(source('lib/grid/server/chat-feature-flags.ts')).toContain("env.GRID_CHAT_ENABLED === '1'");
  });

  it('binds message sender identity to the authenticated session instead of request body', () => {
    const route = source('app/api/grid/chat/channels/[channelId]/messages/route.ts');
    expect(route).toContain('senderPlayerId: context.playerId');
    expect(route).not.toContain('body.senderPlayerId');
  });

  it('binds block and report actor identity to the authenticated session', () => {
    expect(source('app/api/grid/chat/block/route.ts')).toContain('context.playerId');
    expect(source('app/api/grid/chat/messages/[messageId]/report/route.ts')).toContain('reporterPlayerId: context.playerId');
  });

  it('starts direct chat by callsign rather than trusting a target player id from the body', () => {
    const route = source('app/api/grid/chat/direct/route.ts');
    expect(route).toContain('body.callsign');
    expect(route).not.toContain('body.targetPlayerId');
  });

  it('keeps disabled chat mutations behind requireGridChatContext', () => {
    for (const route of [
      'app/api/grid/chat/direct/route.ts',
      'app/api/grid/chat/channels/[channelId]/messages/route.ts',
      'app/api/grid/chat/channels/[channelId]/read/route.ts',
      'app/api/grid/chat/block/route.ts',
      'app/api/grid/chat/messages/[messageId]/report/route.ts',
    ]) {
      expect(source(route)).toContain('requireGridChatContext');
    }
  });
});

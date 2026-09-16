import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function source(relative: string) { return fs.readFileSync(path.join(process.cwd(), relative), 'utf8'); }

describe('Grid chat incremental sync + notification API', () => {
  it('accepts a safe numeric afterSequence cursor for incremental reads', () => {
    const route = source('app/api/grid/chat/channels/[channelId]/messages/route.ts');
    expect(route).toContain("url.searchParams.get('afterSequence')");
    expect(route).toContain('Number.isSafeInteger');
    expect(route).toContain('afterSequence,');
  });

  it('binds notification preference changes to the authenticated player', () => {
    const route = source('app/api/grid/chat/channels/[channelId]/notifications/route.ts');
    expect(route).toContain('requireGridChatContext');
    expect(route).toContain('context.playerId');
    expect(route).not.toContain('body.playerId');
  });

  it('uses the server-side unread helper so system messages and blocks are handled centrally', () => {
    const adapter = source('lib/grid/server/supabase-chat.ts');
    expect(adapter).toContain("client.rpc('grid_chat_unread_count'");
    expect(adapter).not.toContain(".neq('sender_player_id', playerId)");
  });

  it('selects the monotonic sequence cursor for message pages', () => {
    const adapter = source('lib/grid/server/supabase-chat.ts');
    expect(adapter).toContain('sequence_no');
    expect(adapter).toContain("query.gt('sequence_no', afterSequence)");
    expect(adapter).toContain('cursorSequence');
  });
});

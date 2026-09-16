import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function source(relative: string) { return fs.readFileSync(path.join(process.cwd(), relative), 'utf8'); }

describe('Grid public chat room API', () => {
  it('binds room creation to the authenticated player and active season', () => {
    const route = source('app/api/grid/chat/rooms/route.ts');
    expect(route).toContain('requireGridChatContext');
    expect(route).toContain('ownerPlayerId: context.playerId');
    expect(route).toContain('seasonId: context.seasonId');
    expect(route).not.toContain('body.ownerPlayerId');
  });

  it('binds join and leave actions to the authenticated player', () => {
    for (const route of [
      'app/api/grid/chat/rooms/[channelId]/join/route.ts',
      'app/api/grid/chat/rooms/[channelId]/leave/route.ts',
    ]) {
      const text = source(route);
      expect(text).toContain('context.playerId');
      expect(text).not.toContain('body.playerId');
    }
  });

  it('discovers rooms through the guarded service-role adapter', () => {
    const route = source('app/api/grid/chat/rooms/route.ts');
    expect(route).toContain('.listRooms(context.seasonId, context.playerId)');
  });
});

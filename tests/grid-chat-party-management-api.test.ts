import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function source(relative: string) { return fs.readFileSync(path.join(process.cwd(), relative), 'utf8'); }

describe('Grid chat party management API', () => {
  it('binds role and removal actor identity to the authenticated player', () => {
    const route = source('app/api/grid/chat/parties/[channelId]/members/[playerId]/route.ts');
    expect(route).toContain('context.playerId');
    expect(route).not.toContain('body.actorPlayerId');
  });

  it('binds ownership transfer to the authenticated current owner', () => {
    const route = source('app/api/grid/chat/parties/[channelId]/owner/route.ts');
    expect(route).toContain('context.playerId');
    expect(route).not.toContain('body.ownerPlayerId');
  });

  it('allows party members to read the roster through the guarded members route', () => {
    const route = source('app/api/grid/chat/parties/[channelId]/members/route.ts');
    expect(route).toContain('export async function GET');
    expect(route).toContain('listPartyMembers');
    expect(route).toContain('requireGridChatContext');
  });
});

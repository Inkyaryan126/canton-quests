import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function source(relative: string) { return fs.readFileSync(path.join(process.cwd(), relative), 'utf8'); }

describe('Grid chat district + party API', () => {
  it('binds district joins and party creation to authenticated context', () => {
    expect(source('app/api/grid/chat/districts/route.ts')).toContain('context.playerId');
    expect(source('app/api/grid/chat/parties/route.ts')).toContain('ownerPlayerId: context.playerId');
  });

  it('invites party members by callsign rather than request-supplied player id', () => {
    const route = source('app/api/grid/chat/parties/[channelId]/members/route.ts');
    expect(route).toContain('body.callsign');
    expect(route).not.toContain('body.targetPlayerId');
    expect(route).toContain('actorPlayerId: context.playerId');
  });

  it('allows only the authenticated member to leave their own party membership', () => {
    const route = source('app/api/grid/chat/parties/[channelId]/leave/route.ts');
    expect(route).toContain('context.playerId');
    expect(route).not.toContain('body.playerId');
  });
});

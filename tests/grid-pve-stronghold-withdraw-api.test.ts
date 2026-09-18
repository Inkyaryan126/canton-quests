import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
const source = fs.readFileSync(
  path.join(process.cwd(), 'app/api/grid/stronghold-contests/[contestId]/withdraw/route.ts'),
  'utf8',
);
describe('Grid PvE stronghold withdraw API', () => {
  it('requires contest-write feature and authenticated player', () => {
    expect(source).toContain('isGridContestWriteEnabled()');
    expect(source).toContain('if (!session.player)');
  });
  it('accepts only idempotency input from the request body', () => {
    expect(source).toContain('body.idempotencyKey');
    expect(source).not.toContain('body.attackerPlayerId');
    expect(source).not.toContain('body.attackerRefundedInfluence');
    expect(source).not.toContain('body.status');
  });
  it('binds attacker identity to the authenticated session', () => {
    expect(source).toContain('attackerPlayerId: session.player.id');
  });
  it('sanitizes response away from season/city/player/event ids', () => {
    const responseSlice = source.slice(source.indexOf('return response({\n      success: true'));
    expect(responseSlice).not.toContain('seasonId: contest.seasonId');
    expect(responseSlice).not.toContain('cityId: contest.cityId');
    expect(responseSlice).not.toContain('eventId: contest.eventId');
  });
});

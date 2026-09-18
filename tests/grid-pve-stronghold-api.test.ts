import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function read(relative: string): string {
  return fs.readFileSync(path.join(process.cwd(), relative), 'utf8');
}

const list = read('app/api/grid/strongholds/route.ts');
const start = read('app/api/grid/strongholds/[strongholdId]/contest/route.ts');
const round = read('app/api/grid/stronghold-contests/[contestId]/round/route.ts');

describe('Grid PvE stronghold player API', () => {
  it('keeps stronghold reads private and world-read gated', () => {
    expect(list).toContain('isGridWorldReadEnabled()');
    expect(list).toContain('if (!session.player)');
    expect(list).toContain('listGridNpcStrongholdLiveWorld');
    expect(list).not.toContain('missingFacts: result.missingFacts');
    expect(list).toContain('Grid strongholds are temporarily unavailable.');
  });

  it('accepts player-safe source territory slugs rather than database ids', () => {
    expect(start).toContain('sourceTerritorySlug');
    expect(start).not.toContain('body.sourceTerritoryId');
    expect(start).toContain('launchGridPveStrongholdSession');
    expect(start).toContain('createGridNpcStrongholdTrustedResolver');
  });

  it('never accepts client garrison/faction/target/dice state on contest start', () => {
    expect(start).not.toContain('body.garrison');
    expect(start).not.toContain('body.faction');
    expect(start).not.toContain('body.targetTerritory');
    expect(start).not.toContain('body.attackerRolls');
    expect(start).not.toContain('body.garrisonRolls');
  });

  it('sanitizes contest-start output away from internal ids and event ids', () => {
    const responseSlice = start.slice(start.indexOf('return response({\n      success: true'));
    expect(responseSlice).not.toContain('seasonId: contest.seasonId');
    expect(responseSlice).not.toContain('cityId: contest.cityId');
    expect(responseSlice).not.toContain('attackerPlayerId: contest.attackerPlayerId');
    expect(responseSlice).not.toContain('sourceTerritoryId: contest.sourceTerritoryId');
    expect(responseSlice).not.toContain('targetTerritoryId: contest.targetTerritoryId');
    expect(responseSlice).not.toContain('eventId: contest.eventId');
  });

  it('generates round dice server-side and accepts only an idempotency key from the body', () => {
    expect(round).toContain('cryptoSignalDiceRoller');
    expect(round).toContain('resolveGridPveStrongholdSessionRound');
    expect(round).toContain('body.idempotencyKey');
    expect(round).not.toContain('body.attackerRolls');
    expect(round).not.toContain('body.garrisonRolls');
    expect(round).not.toContain('body.attackerRemainingInfluence');
    expect(round).not.toContain('body.garrisonRemainingInfluence');
  });

  it('uses the same contest write flag and founding-season contest rules as PvP', () => {
    expect(start).toContain('isGridContestWriteEnabled()');
    expect(round).toContain('isGridContestWriteEnabled()');
    expect(start).toContain('cantonFoundingSeasonPackage.seasonTemplate.contest');
    expect(round).toContain('cantonFoundingSeasonPackage.seasonTemplate.contest');
  });

  it('sanitizes round output away from city/season/player/event ids', () => {
    const responseSlice = round.slice(round.indexOf('return response({\n      success: true'));
    expect(responseSlice).not.toContain('seasonId: round.seasonId');
    expect(responseSlice).not.toContain('cityId: round.cityId');
    expect(responseSlice).not.toContain('eventId: round.eventId');
  });
});

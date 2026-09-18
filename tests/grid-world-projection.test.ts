import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cantonFoundingSeasonPackage } from '../lib/grid/cities/canton/founding-season';
import {
  resolvePropertyAcquisitionCost,
  resolveTerritoryClaimCost,
  resolveTerritoryIncomeRate,
  settleGridResources,
} from '../lib/grid/core/resources';
import { buildGridWorldProjection } from '../lib/grid/server/world-projection';

describe('Grid player-visible world projection', () => {
  it('projects the real Canton package as a read-only neutral board before runtime activation', () => {
    const projection = buildGridWorldProjection(cantonFoundingSeasonPackage);

    expect(projection.readOnly).toBe(true);
    expect(projection.source).toBe('compiled-package');
    expect(projection.season.runtimeActive).toBe(false);
    expect(projection.counts.territories).toBe(cantonFoundingSeasonPackage.territories.length);
    expect(projection.counts.properties).toBe(cantonFoundingSeasonPackage.properties.length);
    expect(projection.territories.every((territory) => territory.ownership === 'neutral')).toBe(true);
    expect(projection.validClaimSlugs).toEqual([]);
  });

  it('sanitizes rival identity while showing your territory, occupied territory, wallet, and valid expansion', () => {
    const starter = cantonFoundingSeasonPackage.seasonTemplate.economy!.neutralClaims.starterTerritorySlugs[0];
    const edge = cantonFoundingSeasonPackage.edges.find((candidate) => candidate.a === starter || candidate.b === starter);
    expect(edge).toBeDefined();
    const adjacent = edge!.a === starter ? edge!.b : edge!.a;
    const rival = cantonFoundingSeasonPackage.territories.find(
      (territory) => territory.slug !== starter && territory.slug !== adjacent,
    )!.slug;

    const projection = buildGridWorldProjection(cantonFoundingSeasonPackage, {
      viewerPlayerId: 'viewer-player',
      runtime: {
        seasonId: 'season-1',
        seasonStatus: 'active',
        territories: [
          { territorySlug: starter, ownerPlayerId: 'viewer-player', claimedAt: '2026-09-15T20:00:00Z' },
          { territorySlug: rival, ownerPlayerId: 'rival-secret-id', claimedAt: '2026-09-15T20:01:00Z' },
        ],
        properties: [],
        playerState: {
          credits: 4200,
          influence: 125,
          commandPoints: 7,
          resourcesSettledAt: '2026-09-15T20:02:00Z',
        },
      },
    });

    expect(projection.source).toBe('database');
    expect(projection.player.joined).toBe(true);
    expect(projection.player.wallet?.credits).toBe(4200);
    expect(projection.territories.find((territory) => territory.slug === starter)?.ownership).toBe('you');
    expect(projection.territories.find((territory) => territory.slug === rival)?.ownership).toBe('occupied');
    expect(projection.validClaimSlugs).toContain(adjacent);
    const adjacentProjection = projection.territories.find(
      (territory) => territory.slug === adjacent,
    );
    expect(adjacentProjection?.claimCost).toEqual(
      resolveTerritoryClaimCost(
        cantonFoundingSeasonPackage.seasonTemplate.economy!,
        adjacent,
      ),
    );
    expect(JSON.stringify(projection)).not.toContain('rival-secret-id');
  });

  it('projects property acquisition and development actions only inside territory you control', () => {
    const territorySlug =
      cantonFoundingSeasonPackage.seasonTemplate.economy!.neutralClaims
        .starterTerritorySlugs[0];
    const property = cantonFoundingSeasonPackage.properties.find(
      (candidate) => candidate.territorySlug === territorySlug,
    );
    expect(property).toBeDefined();

    const baseRuntime = {
      seasonId: 'season-1',
      seasonStatus: 'active',
      territories: [
        {
          territorySlug,
          ownerPlayerId: 'viewer-player',
          claimedAt: '2026-09-18T05:00:00Z',
        },
      ],
      playerState: {
        credits: 10000,
        influence: 100,
        commandPoints: 20,
        resourcesSettledAt: '2026-09-18T05:00:00Z',
      },
    };

    const acquisition = buildGridWorldProjection(
      cantonFoundingSeasonPackage,
      {
        viewerPlayerId: 'viewer-player',
        runtime: {
          ...baseRuntime,
          properties: [],
        },
      },
    );
    const available = acquisition.properties.find(
      (candidate) => candidate.slug === property!.slug,
    );
    expect(available).toMatchObject({
      ownership: 'neutral',
      territoryOwnership: 'you',
      acquirable: true,
      affordableToAcquire: true,
      developmentOptions: [],
    });
    expect(available?.acquisitionCost).toEqual(
      resolvePropertyAcquisitionCost(
        cantonFoundingSeasonPackage.seasonTemplate.economy!,
        property!.slug,
      ),
    );

    const development = buildGridWorldProjection(
      cantonFoundingSeasonPackage,
      {
        viewerPlayerId: 'viewer-player',
        runtime: {
          ...baseRuntime,
          properties: [
            {
              propertySlug: property!.slug,
              ownerPlayerId: 'viewer-player',
              acquiredAt: '2026-09-18T05:05:00Z',
              developmentBranch: null,
              developmentLevel: 0,
              conditionBps: 10000,
            },
          ],
        },
      },
    );
    const owned = development.properties.find(
      (candidate) => candidate.slug === property!.slug,
    );
    expect(owned?.acquirable).toBe(false);
    expect(owned?.developmentOptions.map((option) => option.branch)).toEqual([
      'commerce',
      'influence',
      'fortress',
      'intel',
      'prestige',
    ]);
    expect(
      owned?.developmentOptions.every(
        (option) => option.level === 1 && option.affordable,
      ),
    ).toBe(true);
  });

  it('projects live income with the exact core settlement math and next collectible time', () => {
    const economy = cantonFoundingSeasonPackage.seasonTemplate.economy!;
    const territorySlug = economy.neutralClaims.starterTerritorySlugs[0];
    const settledAt = '2026-09-18T05:00:00.000Z';
    const generatedAt = '2026-09-18T06:00:00.000Z';
    const rate = resolveTerritoryIncomeRate(economy, territorySlug);
    const expected = settleGridResources({
      credits: 1000,
      influence: 100,
      creditsPerHour: rate.creditsPerHour,
      influencePerHour: rate.influencePerHour,
      remainders: { credits: 0, influence: 0 },
      lastSettledAtMs: Date.parse(settledAt),
      nowMs: Date.parse(generatedAt),
      offlineAccrualCapMinutes: economy.offlineAccrualCapMinutes,
    });

    const projection = buildGridWorldProjection(
      cantonFoundingSeasonPackage,
      {
        viewerPlayerId: 'viewer-player',
        generatedAt,
        runtime: {
          seasonId: 'season-1',
          seasonStatus: 'active',
          territories: [
            {
              territorySlug,
              ownerPlayerId: 'viewer-player',
              claimedAt: settledAt,
            },
          ],
          properties: [],
          playerState: {
            credits: 1000,
            influence: 100,
            commandPoints: 5,
            resourcesSettledAt: settledAt,
            creditsAccrualRemainder: 0,
            influenceAccrualRemainder: 0,
          },
        },
      },
    );

    expect(projection.player.income).toEqual({
      pendingCredits: expected.creditsEarned,
      pendingInfluence: expected.influenceEarned,
      creditsPerHour: rate.creditsPerHour,
      influencePerHour: rate.influencePerHour,
      collectibleAt: null,
    });

    const justSettled = buildGridWorldProjection(
      cantonFoundingSeasonPackage,
      {
        viewerPlayerId: 'viewer-player',
        generatedAt: settledAt,
        runtime: {
          seasonId: 'season-1',
          seasonStatus: 'active',
          territories: [
            {
              territorySlug,
              ownerPlayerId: 'viewer-player',
              claimedAt: settledAt,
            },
          ],
          properties: [],
          playerState: {
            credits: 1000,
            influence: 100,
            commandPoints: 5,
            resourcesSettledAt: settledAt,
            creditsAccrualRemainder: 0,
            influenceAccrualRemainder: 0,
          },
        },
      },
    );

    expect(justSettled.player.income?.pendingCredits).toBe(0);
    expect(justSettled.player.income?.pendingInfluence).toBe(0);
    expect(justSettled.player.income?.collectibleAt).not.toBeNull();
  });

  it('projects only adjacent occupied contest targets and real Signal Dice commit bands', () => {
    const edge = cantonFoundingSeasonPackage.edges[0];
    expect(edge).toBeDefined();

    const runtime = {
      seasonId: 'season-1',
      seasonStatus: 'active',
      territories: [
        {
          territorySlug: edge.a,
          ownerPlayerId: 'viewer-player',
          claimedAt: '2026-09-18T05:40:00Z',
        },
        {
          territorySlug: edge.b,
          ownerPlayerId: 'rival-secret-id',
          claimedAt: '2026-09-18T05:41:00Z',
        },
      ],
      properties: [],
      playerState: {
        credits: 1000,
        influence: 35,
        commandPoints: 5,
        resourcesSettledAt: '2026-09-18T05:42:00Z',
      },
    };

    const player = buildGridWorldProjection(cantonFoundingSeasonPackage, {
      viewerPlayerId: 'viewer-player',
      runtime,
    });
    const target = player.territories.find(
      (territory) => territory.slug === edge.b,
    );

    expect(target).toMatchObject({
      ownership: 'occupied',
      attackable: true,
      attackSourceSlugs: [edge.a],
      contested: false,
    });
    expect(player.player.attackCommitOptions).toEqual([
      { influence: 10, dice: 1, affordable: true },
      { influence: 30, dice: 2, affordable: true },
      { influence: 60, dice: 3, affordable: false },
    ]);
    expect(JSON.stringify(player)).not.toContain('rival-secret-id');

    const spectator = buildGridWorldProjection(cantonFoundingSeasonPackage, {
      runtime,
    });
    expect(
      spectator.territories.find((territory) => territory.slug === edge.b)
        ?.attackable,
    ).toBe(false);
    expect(spectator.player.attackCommitOptions).toEqual([]);
  });

  it('shows contested territory publicly but reveals reserve detail only to a participant', () => {
    const edge = cantonFoundingSeasonPackage.edges[0];
    expect(edge).toBeDefined();

    const runtime = {
      seasonId: 'season-1',
      seasonStatus: 'active',
      territories: [
        { territorySlug: edge.a, ownerPlayerId: 'viewer-player', claimedAt: '2026-09-16T06:00:00Z' },
        { territorySlug: edge.b, ownerPlayerId: 'defender-secret-id', claimedAt: '2026-09-16T06:01:00Z' },
      ],
      properties: [],
      contests: [{
        contestId: 'contest-1',
        sourceTerritorySlug: edge.a,
        targetTerritorySlug: edge.b,
        attackerPlayerId: 'viewer-player',
        defenderPlayerId: 'defender-secret-id',
        attackerRemainingInfluence: 50,
        defenderRemainingInfluence: 30,
        roundNumber: 2,
        status: 'active' as const,
        startedAt: '2026-09-16T06:02:00Z',
      }],
      playerState: {
        credits: 100,
        influence: 40,
        commandPoints: 5,
        resourcesSettledAt: '2026-09-16T06:02:00Z',
      },
    };

    const participant = buildGridWorldProjection(cantonFoundingSeasonPackage, {
      viewerPlayerId: 'viewer-player',
      runtime,
    });
    const spectator = buildGridWorldProjection(cantonFoundingSeasonPackage, {
      runtime,
    });

    expect(participant.territories.find((territory) => territory.slug === edge.b)?.contested).toBe(true);
    expect(participant.player.activeContests).toEqual([{
      contestId: 'contest-1',
      role: 'attacker',
      sourceTerritorySlug: edge.a,
      targetTerritorySlug: edge.b,
      roundNumber: 2,
      yourRemainingInfluence: 50,
      opponentRemainingInfluence: 30,
      startedAt: '2026-09-16T06:02:00Z',
    }]);
    expect(JSON.stringify(participant)).not.toContain('defender-secret-id');

    expect(spectator.counts.activeContests).toBe(1);
    expect(spectator.territories.find((territory) => territory.slug === edge.b)?.contested).toBe(true);
    expect(spectator.player.activeContests).toEqual([]);
    expect(JSON.stringify(spectator)).not.toContain('viewer-player');
    expect(JSON.stringify(spectator)).not.toContain('defender-secret-id');
    expect(JSON.stringify(spectator)).not.toContain('opponentRemainingInfluence');
  });

  it('projects only the viewer skyline and keeps private property names sanitized', () => {
    const publicProperty = cantonFoundingSeasonPackage.properties.find((property) => property.publicNameSafe);
    const privateProperty = cantonFoundingSeasonPackage.properties.find((property) => !property.publicNameSafe);

    const propertyStates = cantonFoundingSeasonPackage.properties.slice(0, 2).map((property) => ({
      propertySlug: property.slug,
      ownerPlayerId: 'viewer-player',
      acquiredAt: '2026-09-15T20:00:00Z',
      developmentBranch: 'commerce' as const,
      developmentLevel: 1,
      conditionBps: 10000,
    }));

    const projection = buildGridWorldProjection(cantonFoundingSeasonPackage, {
      viewerPlayerId: 'viewer-player',
      runtime: {
        seasonId: 'season-1',
        seasonStatus: 'active',
        territories: [],
        properties: propertyStates,
        playerState: {
          credits: 1,
          influence: 2,
          commandPoints: 3,
          resourcesSettledAt: '2026-09-15T20:00:00Z',
        },
      },
    });

    if (publicProperty) {
      expect(projection.properties.find((property) => property.slug === publicProperty.slug)?.name).toBe(publicProperty.name);
    }
    if (privateProperty) {
      expect(projection.properties.find((property) => property.slug === privateProperty.slug)?.name).toBe('Grid Property');
    }
    expect(projection.yourSkylines.every((skyline) => skyline.ruleIds.length > 0)).toBe(true);
  });

  it('keeps the world API and Supabase adapter read-only', () => {
    const root = process.cwd();
    const api = fs.readFileSync(path.join(root, 'app/api/grid/world/route.ts'), 'utf8');
    const adapter = fs.readFileSync(path.join(root, 'lib/grid/server/supabase-world-projection.ts'), 'utf8');

    expect(api).toContain('export async function GET');
    expect(api).not.toMatch(/export async function (POST|PUT|PATCH|DELETE)/);
    expect(adapter).not.toMatch(/\.(insert|update|delete|upsert|rpc)\s*\(/);
    expect(adapter).toContain(".from('grid_contests')");
    expect(adapter).toContain('isMissingContestTable');
  });
});

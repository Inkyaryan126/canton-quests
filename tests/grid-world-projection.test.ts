import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cantonFoundingSeasonPackage } from '../lib/grid/cities/canton/founding-season';
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
    expect(JSON.stringify(projection)).not.toContain('rival-secret-id');
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
  });
});

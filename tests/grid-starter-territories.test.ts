import { describe, expect, it, vi } from 'vitest';
import { cantonFoundingSeasonPackage } from '../lib/grid/cities/canton/founding-season';
import { resolveTerritoryClaimCost } from '../lib/grid/core/resources';
import type { GridStarterTerritoryPort } from '../lib/grid/server/starter-territory-port';
import { readGridStarterTerritories } from '../lib/grid/server/starter-territory-service';

function portWith(
  context: Awaited<ReturnType<GridStarterTerritoryPort['getContext']>>,
): GridStarterTerritoryPort {
  return { getContext: vi.fn().mockResolvedValue(context) };
}

const starterSlugs =
  cantonFoundingSeasonPackage.seasonTemplate.economy!.neutralClaims
    .starterTerritorySlugs;
const buildableStarterSlugs = starterSlugs.filter((slug) =>
  cantonFoundingSeasonPackage.properties.some(
    (property) => property.territorySlug === slug,
  ),
);

describe('Grid starter territory selection', () => {
  it('configures every Founding Season starter with at least one buildable property', () => {
    expect(starterSlugs).toHaveLength(6);
    expect(buildableStarterSlugs).toEqual(starterSlugs);
  });

  it('blocks choices when the season is not playable', async () => {
    const result = await readGridStarterTerritories(
      portWith({
        seasonPlayable: false,
        joined: false,
        credits: 0,
        commandPoints: 0,
        ownsAnyTerritory: false,
        territories: [],
      }),
      cantonFoundingSeasonPackage,
      'player-1',
    );

    expect(result.state).toBe('season-unavailable');
    expect(result.options).toEqual([]);
  });

  it('requires a joined seasonal wallet before offering starter claims', async () => {
    const result = await readGridStarterTerritories(
      portWith({
        seasonPlayable: true,
        joined: false,
        credits: 0,
        commandPoints: 0,
        ownsAnyTerritory: false,
        territories: [],
      }),
      cantonFoundingSeasonPackage,
      'player-1',
    );

    expect(result.state).toBe('join-required');
  });

  it('stops offering starters once the player owns any territory', async () => {
    const result = await readGridStarterTerritories(
      portWith({
        seasonPlayable: true,
        joined: true,
        credits: 9999,
        commandPoints: 99,
        ownsAnyTerritory: true,
        territories: [],
      }),
      cantonFoundingSeasonPackage,
      'player-1',
    );

    expect(result.state).toBe('starter-claim-complete');
    expect(result.options).toEqual([]);
  });

  it('returns only neutral configured build-ready starters with exact configured costs', async () => {
    const economy = cantonFoundingSeasonPackage.seasonTemplate.economy!;
    const territories = starterSlugs.map((slug, index) => ({
      territoryId: `territory-${index + 1}`,
      territorySlug: slug,
      occupied: false,
    }));
    const sampleAvailable = buildableStarterSlugs[0];
    expect(sampleAvailable).toBeDefined();
    const expectedCost = resolveTerritoryClaimCost(economy, sampleAvailable);
    const sampleIndex = starterSlugs.indexOf(sampleAvailable);

    const result = await readGridStarterTerritories(
      portWith({
        seasonPlayable: true,
        joined: true,
        credits: expectedCost.credits,
        commandPoints: expectedCost.commandPoints,
        ownsAnyTerritory: false,
        territories,
      }),
      cantonFoundingSeasonPackage,
      'player-1',
    );

    expect(result.state).toBe('choose-starter');
    expect(result.availableCount).toBe(buildableStarterSlugs.length);
    expect(result.unavailableCount).toBe(0);
    expect(
      result.options.every((option) =>
        cantonFoundingSeasonPackage.properties.some(
          (property) => property.territorySlug === option.slug,
        ),
      ),
    ).toBe(true);

    const sample = result.options.find((option) => option.slug === sampleAvailable);
    expect(sample).toMatchObject({
      territoryId: `territory-${sampleIndex + 1}`,
      slug: sampleAvailable,
      cost: expectedCost,
      affordable: true,
    });
  });

  it('marks unaffordable choices without hiding them', async () => {
    const territories = starterSlugs.map((slug, index) => ({
      territoryId: `territory-${index + 1}`,
      territorySlug: slug,
      occupied: false,
    }));

    const result = await readGridStarterTerritories(
      portWith({
        seasonPlayable: true,
        joined: true,
        credits: 0,
        commandPoints: 0,
        ownsAnyTerritory: false,
        territories,
      }),
      cantonFoundingSeasonPackage,
      'player-1',
    );

    expect(result.options).toHaveLength(buildableStarterSlugs.length);
    expect(result.options.every((option) => !option.affordable)).toBe(true);
  });

  it('reports no starters available when every configured starter is occupied', async () => {
    const result = await readGridStarterTerritories(
      portWith({
        seasonPlayable: true,
        joined: true,
        credits: 9999,
        commandPoints: 99,
        ownsAnyTerritory: false,
        territories: starterSlugs.map((slug, index) => ({
          territoryId: `territory-${index + 1}`,
          territorySlug: slug,
          occupied: true,
        })),
      }),
      cantonFoundingSeasonPackage,
      'player-1',
    );

    expect(result.state).toBe('no-starters-available');
    expect(result.availableCount).toBe(0);
    expect(result.unavailableCount).toBe(buildableStarterSlugs.length);
  });
});

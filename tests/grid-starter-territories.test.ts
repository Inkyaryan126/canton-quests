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

describe('Grid starter territory selection', () => {
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

  it('returns only neutral configured starters with exact configured costs', async () => {
    const economy = cantonFoundingSeasonPackage.seasonTemplate.economy!;
    const territories = starterSlugs.map((slug, index) => ({
      territoryId: `territory-${index + 1}`,
      territorySlug: slug,
      occupied: index === 0,
    }));
    const sampleAvailable = starterSlugs[1];
    const expectedCost = resolveTerritoryClaimCost(economy, sampleAvailable);

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
    expect(result.availableCount).toBe(starterSlugs.length - 1);
    expect(result.unavailableCount).toBe(1);
    expect(result.options.some((option) => option.slug === starterSlugs[0]))
      .toBe(false);

    const sample = result.options.find((option) => option.slug === sampleAvailable);
    expect(sample).toMatchObject({
      territoryId: 'territory-2',
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

    expect(result.options).toHaveLength(starterSlugs.length);
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
    expect(result.unavailableCount).toBe(starterSlugs.length);
  });
});

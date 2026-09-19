import { describe, expect, it, vi } from 'vitest';
import { cantonDominanceHeatConfig } from '../lib/grid/cities/canton/dominance-heat';
import type { GridDominanceHeatLivePort } from '../lib/grid/server/dominance-heat-live-port';
import { readGridDominanceHeatLive } from '../lib/grid/server/dominance-heat-live-service';

function port(): GridDominanceHeatLivePort {
  return {
    readContext: vi.fn().mockResolvedValue({
      seasonId: 'season-private-id',
      seasonStatus: 'active',
      joined: true,
      eligibleTerritories: 20,
      playerControlledTerritories: 7,
      alliance: {
        allianceId: 'alliance-private-id',
        name: 'NORTH CANTON CREW',
        controlledTerritories: 11,
      },
    }),
  };
}

describe('live Grid Dominance Heat service', () => {
  it('projects both personal and alliance territory concentration', async () => {
    const source = port();
    const result = await readGridDominanceHeatLive(
      source,
      'player-private-id',
      cantonDominanceHeatConfig,
    );

    expect(source.readContext).toHaveBeenCalledWith('player-private-id');
    expect(result.state).toBe('ready');
    expect(result.measurement).toBe('territory-share');
    expect(result.effectEnforcement).toBe('projected');
    expect(result.player).toMatchObject({
      scope: 'player',
      label: 'YOU',
      controlledTerritories: 7,
      eligibleTerritories: 20,
      dominanceScoreBps: 3_500,
      bandId: 'warm',
    });
    expect(result.alliance).toMatchObject({
      scope: 'alliance',
      label: 'NORTH CANTON CREW',
      controlledTerritories: 11,
      eligibleTerritories: 20,
      dominanceScoreBps: 5_500,
      bandId: 'hot',
    });
  });

  it('strips actor, alliance, season, and player identifiers from the public projection', async () => {
    const result = await readGridDominanceHeatLive(
      port(),
      'player-private-id',
      cantonDominanceHeatConfig,
    );
    const encoded = JSON.stringify(result);

    expect(encoded).not.toContain('player-private-id');
    expect(encoded).not.toContain('alliance-private-id');
    expect(encoded).not.toContain('season-private-id');
    expect(result.player).not.toHaveProperty('actorId');
    expect(result.alliance).not.toHaveProperty('actorId');
  });

  it('returns a join-required state before ownership projection', async () => {
    const source = port();
    vi.mocked(source.readContext).mockResolvedValue({
      seasonId: 'season-private-id',
      seasonStatus: 'scheduled',
      joined: false,
      eligibleTerritories: 20,
      playerControlledTerritories: 0,
      alliance: null,
    });

    await expect(
      readGridDominanceHeatLive(
        source,
        'player-private-id',
        cantonDominanceHeatConfig,
      ),
    ).resolves.toEqual({
      state: 'join-required',
      seasonStatus: 'scheduled',
      measurement: 'territory-share',
      effectEnforcement: 'projected',
      player: null,
      alliance: null,
    });
  });

  it('returns unavailable when the configured city/season or territory inventory is missing', async () => {
    const source = port();
    vi.mocked(source.readContext).mockResolvedValue(null);

    const missing = await readGridDominanceHeatLive(
      source,
      'player-private-id',
      cantonDominanceHeatConfig,
    );
    expect(missing.state).toBe('unavailable');

    vi.mocked(source.readContext).mockResolvedValue({
      seasonId: 'season-private-id',
      seasonStatus: 'active',
      joined: true,
      eligibleTerritories: 0,
      playerControlledTerritories: 0,
      alliance: null,
    });
    const noTerritories = await readGridDominanceHeatLive(
      source,
      'player-private-id',
      cantonDominanceHeatConfig,
    );
    expect(noTerritories.state).toBe('unavailable');
  });

  it('fails closed when persisted ownership counts are impossible', async () => {
    const source = port();
    vi.mocked(source.readContext).mockResolvedValue({
      seasonId: 'season-private-id',
      seasonStatus: 'active',
      joined: true,
      eligibleTerritories: 20,
      playerControlledTerritories: 21,
      alliance: null,
    });

    await expect(
      readGridDominanceHeatLive(
        source,
        'player-private-id',
        cantonDominanceHeatConfig,
      ),
    ).rejects.toThrow('exceeds eligible territory count');
  });
});

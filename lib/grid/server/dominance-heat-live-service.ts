import {
  projectGridDominanceHeat,
  validateGridDominanceHeatConfig,
} from '../core/dominance-heat';
import type {
  GridDominanceHeatConfig,
  GridDominanceHeatEffects,
  GridDominanceHeatProjection,
} from '../core/dominance-heat-types';
import type { GridDominanceHeatLivePort } from './dominance-heat-live-port';

export type GridDominanceHeatLiveState =
  | 'unavailable'
  | 'join-required'
  | 'ready';

export interface GridDominanceHeatPublicProjection {
  scope: 'player' | 'alliance';
  label: string;
  controlledTerritories: number;
  eligibleTerritories: number;
  territoryShareBps: number;
  dominanceScoreBps: number;
  exposureSource: GridDominanceHeatProjection['exposureSource'];
  active: boolean;
  bandId: string | null;
  effects: GridDominanceHeatEffects;
  nextBandId: string | null;
  bpsToNextBand: number | null;
}

export interface GridDominanceHeatLiveProjection {
  state: GridDominanceHeatLiveState;
  seasonStatus: string | null;
  measurement: 'territory-share';
  effectEnforcement: 'projected';
  player: GridDominanceHeatPublicProjection | null;
  alliance: GridDominanceHeatPublicProjection | null;
}

function requiredPlayerId(value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error('Grid Dominance Heat requires playerId');
  }
  return normalized;
}

function safeCount(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Grid Dominance Heat requires non-negative ${label}`);
  }
  return value;
}

function publicProjection(
  projection: GridDominanceHeatProjection,
  input: {
    scope: 'player' | 'alliance';
    label: string;
    controlledTerritories: number;
    eligibleTerritories: number;
  },
): GridDominanceHeatPublicProjection {
  return {
    scope: input.scope,
    label: input.label,
    controlledTerritories: input.controlledTerritories,
    eligibleTerritories: input.eligibleTerritories,
    territoryShareBps: projection.territoryShareBps,
    dominanceScoreBps: projection.dominanceScoreBps,
    exposureSource: projection.exposureSource,
    active: projection.active,
    bandId: projection.bandId,
    effects: { ...projection.effects },
    nextBandId: projection.nextBandId,
    bpsToNextBand: projection.bpsToNextBand,
  };
}

export async function readGridDominanceHeatLive(
  port: GridDominanceHeatLivePort,
  playerIdInput: string,
  config: GridDominanceHeatConfig,
): Promise<GridDominanceHeatLiveProjection> {
  const playerId = requiredPlayerId(playerIdInput);
  validateGridDominanceHeatConfig(config);

  const context = await port.readContext(playerId);
  if (!context) {
    return {
      state: 'unavailable',
      seasonStatus: null,
      measurement: 'territory-share',
      effectEnforcement: 'projected',
      player: null,
      alliance: null,
    };
  }

  const eligibleTerritories = safeCount(
    context.eligibleTerritories,
    'eligibleTerritories',
  );
  safeCount(
    context.playerControlledTerritories,
    'playerControlledTerritories',
  );

  if (!context.joined) {
    return {
      state: 'join-required',
      seasonStatus: context.seasonStatus,
      measurement: 'territory-share',
      effectEnforcement: 'projected',
      player: null,
      alliance: null,
    };
  }

  if (eligibleTerritories === 0) {
    return {
      state: 'unavailable',
      seasonStatus: context.seasonStatus,
      measurement: 'territory-share',
      effectEnforcement: 'projected',
      player: null,
      alliance: null,
    };
  }

  if (context.playerControlledTerritories > eligibleTerritories) {
    throw new Error(
      'Grid Dominance Heat player territory count exceeds eligible territory count',
    );
  }

  const playerProjection = projectGridDominanceHeat(
    {
      actorId: playerId,
      actorKind: 'player',
      controlledTerritories: context.playerControlledTerritories,
      eligibleTerritories,
    },
    config,
  );

  let alliance: GridDominanceHeatPublicProjection | null = null;
  if (context.alliance) {
    const allianceCount = safeCount(
      context.alliance.controlledTerritories,
      'alliance controlledTerritories',
    );
    if (allianceCount > eligibleTerritories) {
      throw new Error(
        'Grid Dominance Heat alliance territory count exceeds eligible territory count',
      );
    }
    const label = context.alliance.name.trim();
    if (!label) {
      throw new Error('Grid Dominance Heat alliance requires a public name');
    }

    const allianceProjection = projectGridDominanceHeat(
      {
        actorId: context.alliance.allianceId,
        actorKind: 'alliance',
        controlledTerritories: allianceCount,
        eligibleTerritories,
      },
      config,
    );
    alliance = publicProjection(allianceProjection, {
      scope: 'alliance',
      label,
      controlledTerritories: allianceCount,
      eligibleTerritories,
    });
  }

  return {
    state: 'ready',
    seasonStatus: context.seasonStatus,
    measurement: 'territory-share',
    effectEnforcement: 'projected',
    player: publicProjection(playerProjection, {
      scope: 'player',
      label: 'YOU',
      controlledTerritories: context.playerControlledTerritories,
      eligibleTerritories,
    }),
    alliance,
  };
}

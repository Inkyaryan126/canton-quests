import { projectGridDominanceHeat } from '../core/dominance-heat';
import type {
  GridDominanceHeatConfig,
  GridDominanceHeatProjection,
} from '../core/dominance-heat-types';

export interface GridNpcDominanceAllianceMembership {
  allianceId: string;
  playerId: string;
}

export interface GridNpcDominancePressureInput {
  eligibleTerritories: number;
  ownerPlayerIds: string[];
  allianceMemberships: GridNpcDominanceAllianceMembership[];
}

export interface GridNpcDominancePressureResult {
  pressureBps: number;
  source: 'none' | 'player' | 'alliance';
  dominanceScoreBps: number;
  bandId: string | null;
  controlledTerritories: number;
}

function nonNegativeSafeInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(
      `Grid NPC Dominance pressure requires non-negative ${label}`,
    );
  }
  return value;
}

function nonBlank(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`Grid NPC Dominance pressure requires ${label}`);
  }
  return normalized;
}

function projectionRank(
  projection: GridDominanceHeatProjection,
  source: 'player' | 'alliance',
): [number, number, number, string] {
  return [
    projection.effects.neutralFactionPressureBps,
    projection.dominanceScoreBps,
    source === 'alliance' ? 1 : 0,
    projection.actorId,
  ];
}

function higher(
  left: {
    source: 'player' | 'alliance';
    projection: GridDominanceHeatProjection;
    controlledTerritories: number;
  },
  right: {
    source: 'player' | 'alliance';
    projection: GridDominanceHeatProjection;
    controlledTerritories: number;
  },
) {
  const a = projectionRank(left.projection, left.source);
  const b = projectionRank(right.projection, right.source);
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) {
      return (a[index] as number) > (b[index] as number) ? left : right;
    }
  }
  return String(a[3]).localeCompare(String(b[3])) <= 0 ? left : right;
}

export function deriveGridNpcDominancePressure(
  input: GridNpcDominancePressureInput,
  config: GridDominanceHeatConfig,
): GridNpcDominancePressureResult {
  const eligibleTerritories = nonNegativeSafeInteger(
    input.eligibleTerritories,
    'eligibleTerritories',
  );
  if (eligibleTerritories === 0) {
    return {
      pressureBps: 0,
      source: 'none',
      dominanceScoreBps: 0,
      bandId: null,
      controlledTerritories: 0,
    };
  }

  const playerCounts = new Map<string, number>();
  for (const ownerId of input.ownerPlayerIds) {
    const playerId = nonBlank(ownerId, 'owner player id');
    playerCounts.set(playerId, (playerCounts.get(playerId) ?? 0) + 1);
  }

  const allianceByPlayer = new Map<string, string>();
  for (const membership of input.allianceMemberships) {
    const playerId = nonBlank(membership.playerId, 'alliance player id');
    const allianceId = nonBlank(membership.allianceId, 'alliance id');
    const previous = allianceByPlayer.get(playerId);
    if (previous && previous !== allianceId) {
      throw new Error(
        'Grid NPC Dominance pressure found multiple active alliances for one player',
      );
    }
    allianceByPlayer.set(playerId, allianceId);
  }

  const allianceCounts = new Map<string, number>();
  for (const [playerId, count] of playerCounts) {
    const allianceId = allianceByPlayer.get(playerId);
    if (!allianceId) continue;
    allianceCounts.set(
      allianceId,
      (allianceCounts.get(allianceId) ?? 0) + count,
    );
  }

  const candidates: Array<{
    source: 'player' | 'alliance';
    projection: GridDominanceHeatProjection;
    controlledTerritories: number;
  }> = [];

  for (const [playerId, count] of playerCounts) {
    if (count > eligibleTerritories) {
      throw new Error(
        'Grid NPC Dominance pressure player ownership exceeds eligible territories',
      );
    }
    candidates.push({
      source: 'player',
      controlledTerritories: count,
      projection: projectGridDominanceHeat(
        {
          actorId: playerId,
          actorKind: 'player',
          controlledTerritories: count,
          eligibleTerritories,
        },
        config,
      ),
    });
  }

  for (const [allianceId, count] of allianceCounts) {
    if (count > eligibleTerritories) {
      throw new Error(
        'Grid NPC Dominance pressure alliance ownership exceeds eligible territories',
      );
    }
    candidates.push({
      source: 'alliance',
      controlledTerritories: count,
      projection: projectGridDominanceHeat(
        {
          actorId: allianceId,
          actorKind: 'alliance',
          controlledTerritories: count,
          eligibleTerritories,
        },
        config,
      ),
    });
  }

  if (candidates.length === 0) {
    return {
      pressureBps: 0,
      source: 'none',
      dominanceScoreBps: 0,
      bandId: null,
      controlledTerritories: 0,
    };
  }

  const strongest = candidates.reduce(higher);
  return {
    pressureBps: strongest.projection.effects.neutralFactionPressureBps,
    source: strongest.source,
    dominanceScoreBps: strongest.projection.dominanceScoreBps,
    bandId: strongest.projection.bandId,
    controlledTerritories: strongest.controlledTerritories,
  };
}

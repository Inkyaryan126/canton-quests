import {
  getDevelopmentBonusesThroughLevel,
  getNextDevelopmentLevel,
} from '../core/development';
import {
  GRID_DEVELOPMENT_BRANCHES,
  type GridDevelopmentBranch,
  type GridEconomyCost,
} from '../core/economy-types';
import {
  resolvePropertyAcquisitionCost,
  resolvePropertyIncomeRate,
  resolveTerritoryClaimCost,
  resolveTerritoryIncomeRate,
  settleGridResources,
} from '../core/resources';
import { computeSkylineComponents, matchSkylineRules } from '../core/skyline';
import { projectTerritoryControl } from '../core/territory-control';
import type { GridCityPackage } from '../core/types';

export type GridWorldOwnership = 'neutral' | 'you' | 'occupied';

export interface GridWorldRuntimeTerritoryState {
  territorySlug: string;
  ownerPlayerId: string | null;
  claimedAt: string | null;
}

export interface GridWorldRuntimePropertyState {
  propertySlug: string;
  ownerPlayerId: string | null;
  acquiredAt: string | null;
  developmentBranch: GridDevelopmentBranch | null;
  developmentLevel: number;
  conditionBps: number;
}

export interface GridWorldRuntimePlayerState {
  credits: number;
  influence: number;
  commandPoints: number;
  resourcesSettledAt: string;
  creditsAccrualRemainder?: number;
  influenceAccrualRemainder?: number;
}

export interface GridWorldRuntimeContestState {
  contestId: string;
  sourceTerritorySlug: string;
  targetTerritorySlug: string;
  attackerPlayerId: string;
  defenderPlayerId: string;
  attackerRemainingInfluence: number;
  defenderRemainingInfluence: number;
  roundNumber: number;
  status: 'active' | 'captured' | 'defended' | 'withdrawn' | 'cancelled';
  startedAt: string;
}

export interface GridWorldRuntimeSnapshot {
  seasonId: string;
  seasonStatus: string;
  territories: GridWorldRuntimeTerritoryState[];
  properties: GridWorldRuntimePropertyState[];
  contests?: GridWorldRuntimeContestState[];
  playerState: GridWorldRuntimePlayerState | null;
}

export interface GridWorldProjection {
  version: 1;
  readOnly: true;
  source: 'compiled-package' | 'database';
  city: GridCityPackage['city'];
  season: {
    slug: string;
    name: string;
    status: string;
    runtimeActive: boolean;
  };
  player: {
    authenticated: boolean;
    joined: boolean;
    wallet: GridWorldRuntimePlayerState | null;
    attackCommitOptions: Array<{
      influence: number;
      dice: number;
      affordable: boolean;
    }>;
    income: {
      pendingCredits: number;
      pendingInfluence: number;
      creditsPerHour: number;
      influencePerHour: number;
      collectibleAt: string | null;
    } | null;
    activeContests: Array<{
      contestId: string;
      role: 'attacker' | 'defender';
      sourceTerritorySlug: string;
      targetTerritorySlug: string;
      roundNumber: number;
      yourRemainingInfluence: number;
      opponentRemainingInfluence: number;
      startedAt: string;
    }>;
  };
  counts: {
    districts: number;
    territories: number;
    properties: number;
    occupiedTerritories: number;
    occupiedProperties: number;
    activeContests: number;
  };
  territories: Array<{
    slug: string;
    name: string;
    districtSlug: string;
    geometry?: GeoJSON.MultiPolygon;
    ownership: GridWorldOwnership;
    claimable: boolean;
    claimCost: { credits: number; commandPoints: number };
    attackable: boolean;
    attackSourceSlugs: string[];
    starterEligible: boolean;
    contested: boolean;
  }>;
  properties: Array<{
    slug: string;
    name: string;
    territorySlug: string;
    point?: GridCityPackage['city']['mapCenter'];
    geometry?: GeoJSON.MultiPolygon;
    ownership: GridWorldOwnership;
    territoryOwnership: GridWorldOwnership;
    acquisitionCost: GridEconomyCost;
    acquirable: boolean;
    affordableToAcquire: boolean;
    developmentBranch: GridDevelopmentBranch | null;
    developmentLevel: number;
    developmentOptions: Array<{
      branch: GridDevelopmentBranch;
      level: number;
      cost: GridEconomyCost;
      affordable: boolean;
    }>;
    conditionBps: number;
  }>;
  validClaimSlugs: string[];
  yourSkylines: Array<{
    propertySlugs: string[];
    territorySlugs: string[];
    totalDevelopmentLevel: number;
    ruleIds: string[];
  }>;
}

function ownershipFor(ownerPlayerId: string | null | undefined, viewerPlayerId: string | null): GridWorldOwnership {
  if (!ownerPlayerId) return 'neutral';
  return viewerPlayerId && ownerPlayerId === viewerPlayerId ? 'you' : 'occupied';
}

function canAfford(
  wallet: GridWorldRuntimePlayerState | null,
  cost: GridEconomyCost,
): boolean {
  return Boolean(
    wallet &&
      wallet.credits >= cost.credits &&
      wallet.commandPoints >= cost.commandPoints,
  );
}

const HOUR_MS = 60 * 60 * 1000;

function msUntilWholeResource(
  ratePerHour: number,
  remainder: number,
): number | null {
  if (ratePerHour <= 0) return null;
  return Math.max(1, Math.ceil((HOUR_MS - remainder) / ratePerHour));
}

function nextCollectibleAt(
  generatedAt: string,
  creditsPerHour: number,
  influencePerHour: number,
  creditsRemainder: number,
  influenceRemainder: number,
): string | null {
  const waits = [
    msUntilWholeResource(creditsPerHour, creditsRemainder),
    msUntilWholeResource(influencePerHour, influenceRemainder),
  ].filter((value): value is number => value !== null);

  if (waits.length === 0) return null;
  return new Date(Date.parse(generatedAt) + Math.min(...waits)).toISOString();
}

export function buildGridWorldProjection(
  pkg: GridCityPackage,
  options: {
    viewerPlayerId?: string | null;
    runtime?: GridWorldRuntimeSnapshot | null;
    generatedAt?: string | null;
  } = {},
): GridWorldProjection {
  const viewerPlayerId = options.viewerPlayerId ?? null;
  const runtime = options.runtime ?? null;
  const economy = pkg.seasonTemplate.economy;

  const territoryRuntime = new Map(
    (runtime?.territories ?? []).map((row) => [row.territorySlug, row] as const),
  );
  const propertyRuntime = new Map(
    (runtime?.properties ?? []).map((row) => [row.propertySlug, row] as const),
  );
  const joined = Boolean(viewerPlayerId && runtime?.playerState);
  const activeRuntimeContests = (runtime?.contests ?? []).filter(
    (contest) => contest.status === 'active',
  );
  const contestedTargets = new Set(
    activeRuntimeContests.map((contest) => contest.targetTerritorySlug),
  );
  const activeContests = viewerPlayerId
    ? activeRuntimeContests.flatMap((contest) => {
        const role: 'attacker' | 'defender' | null =
          contest.attackerPlayerId === viewerPlayerId
            ? 'attacker'
            : contest.defenderPlayerId === viewerPlayerId
              ? 'defender'
              : null;
        if (!role) return [];

        return [{
          contestId: contest.contestId,
          role,
          sourceTerritorySlug: contest.sourceTerritorySlug,
          targetTerritorySlug: contest.targetTerritorySlug,
          roundNumber: contest.roundNumber,
          yourRemainingInfluence:
            role === 'attacker'
              ? contest.attackerRemainingInfluence
              : contest.defenderRemainingInfluence,
          opponentRemainingInfluence:
            role === 'attacker'
              ? contest.defenderRemainingInfluence
              : contest.attackerRemainingInfluence,
          startedAt: contest.startedAt,
        }];
      })
    : [];

  const control = projectTerritoryControl({
    territories: pkg.territories,
    edges: pkg.edges,
    ownership: pkg.territories.map((territory) => ({
      territorySlug: territory.slug,
      ownerPlayerId: territoryRuntime.get(territory.slug)?.ownerPlayerId ?? null,
    })),
    playerId: viewerPlayerId ?? '__anonymous__',
    starterTerritorySlugs: economy?.neutralClaims.starterTerritorySlugs ?? [],
  });
  const validClaimSlugs = joined ? control.validClaimSlugs : [];
  const validClaims = new Set(validClaimSlugs);
  const starterSlugs = new Set(economy?.neutralClaims.starterTerritorySlugs ?? []);
  const ownedTerritorySlugs = new Set(control.ownedTerritorySlugs);
  const ownerByTerritorySlug = new Map(
    pkg.territories.map((territory) => [
      territory.slug,
      territoryRuntime.get(territory.slug)?.ownerPlayerId ?? null,
    ] as const),
  );
  const attackSourcesByTarget = new Map<string, Set<string>>();

  if (joined && viewerPlayerId) {
    const addAttackSource = (sourceSlug: string, targetSlug: string) => {
      const targetOwner = ownerByTerritorySlug.get(targetSlug);
      if (!targetOwner || targetOwner === viewerPlayerId) return;
      const sources = attackSourcesByTarget.get(targetSlug) ?? new Set<string>();
      sources.add(sourceSlug);
      attackSourcesByTarget.set(targetSlug, sources);
    };

    for (const edge of pkg.edges) {
      if (ownedTerritorySlugs.has(edge.a)) addAttackSource(edge.a, edge.b);
      if (ownedTerritorySlugs.has(edge.b)) addAttackSource(edge.b, edge.a);
    }
  }

  const territories = pkg.territories.map((territory) => {
    const state = territoryRuntime.get(territory.slug);
    const attackSourceSlugs = [
      ...(attackSourcesByTarget.get(territory.slug) ?? new Set<string>()),
    ].sort();
    const contested = contestedTargets.has(territory.slug);

    return {
      slug: territory.slug,
      name: territory.name,
      districtSlug: territory.districtSlug,
      geometry: territory.geometry,
      ownership: ownershipFor(state?.ownerPlayerId, viewerPlayerId),
      claimable: validClaims.has(territory.slug),
      claimCost: economy
        ? resolveTerritoryClaimCost(economy, territory.slug)
        : { credits: 0, commandPoints: 0 },
      attackable: attackSourceSlugs.length > 0 && !contested,
      attackSourceSlugs,
      starterEligible: starterSlugs.has(territory.slug),
      contested,
    };
  });

  const territoryOwnershipBySlug = new Map(
    territories.map((territory) => [territory.slug, territory.ownership] as const),
  );

  const properties = pkg.properties.map((property) => {
    const state = propertyRuntime.get(property.slug);
    const ownership = ownershipFor(state?.ownerPlayerId, viewerPlayerId);
    const territoryOwnership =
      territoryOwnershipBySlug.get(property.territorySlug) ?? 'neutral';
    const acquisitionCost = economy
      ? resolvePropertyAcquisitionCost(economy, property.slug)
      : { credits: 0, commandPoints: 0 };
    const acquirable =
      joined && ownership === 'neutral' && territoryOwnership === 'you';
    const developmentBranch = state?.developmentBranch ?? null;
    const developmentLevel = state?.developmentLevel ?? 0;
    const branches =
      ownership === 'you'
        ? developmentBranch
          ? [developmentBranch]
          : [...GRID_DEVELOPMENT_BRANCHES]
        : [];
    const developmentOptions =
      economy && ownership === 'you'
        ? branches.flatMap((branch) => {
            const next = getNextDevelopmentLevel(
              economy.development,
              branch,
              developmentLevel,
            );
            return next
              ? [{
                  branch,
                  level: next.level,
                  cost: { ...next.cost },
                  affordable: canAfford(runtime?.playerState ?? null, next.cost),
                }]
              : [];
          })
        : [];

    return {
      slug: property.slug,
      name: property.publicNameSafe ? property.name : 'Grid Property',
      territorySlug: property.territorySlug,
      point: property.point,
      geometry: property.geometry,
      ownership,
      territoryOwnership,
      acquisitionCost,
      acquirable,
      affordableToAcquire:
        acquirable && canAfford(runtime?.playerState ?? null, acquisitionCost),
      developmentBranch,
      developmentLevel,
      developmentOptions,
      conditionBps: state?.conditionBps ?? 10000,
    };
  });
  const yourPropertyStates = properties
    .filter((property) => property.ownership === 'you')
    .map((property) => ({
      propertySlug: property.slug,
      territorySlug: property.territorySlug,
      developmentBranch: property.developmentBranch,
      developmentLevel: property.developmentLevel,
    }));

  const yourSkylines = economy
    ? computeSkylineComponents(yourPropertyStates, pkg.edges)
        .map((component) => ({
          propertySlugs: component.propertySlugs,
          territorySlugs: component.territorySlugs,
          totalDevelopmentLevel: component.totalDevelopmentLevel,
          ruleIds: matchSkylineRules(component, economy.skyline.rules).map((rule) => rule.id),
        }))
        .filter((component) => component.ruleIds.length > 0)
    : [];

  const attackCommitOptions =
    joined && runtime?.playerState && pkg.seasonTemplate.contest
      ? [...pkg.seasonTemplate.contest.attacker.bands]
          .sort(
            (a, b) =>
              a.minCommittedInfluence - b.minCommittedInfluence,
          )
          .map((band) => ({
            influence: band.minCommittedInfluence,
            dice: band.dice,
            affordable:
              runtime.playerState!.influence >= band.minCommittedInfluence,
          }))
      : [];

  let income: GridWorldProjection['player']['income'] = null;
  const generatedAt =
    options.generatedAt ?? runtime?.playerState?.resourcesSettledAt ?? null;

  if (
    economy &&
    runtime?.playerState &&
    generatedAt &&
    Number.isFinite(Date.parse(generatedAt))
  ) {
    let creditsPerHour = 0;
    let influencePerHour = 0;

    for (const territorySlug of control.ownedTerritorySlugs) {
      const rate = resolveTerritoryIncomeRate(economy, territorySlug);
      creditsPerHour += rate.creditsPerHour;
      influencePerHour += rate.influencePerHour;
    }

    for (const property of yourPropertyStates) {
      const rate = resolvePropertyIncomeRate(economy, property.propertySlug);
      creditsPerHour += rate.creditsPerHour;
      influencePerHour += rate.influencePerHour;

      if (property.developmentBranch && property.developmentLevel > 0) {
        const bonuses = getDevelopmentBonusesThroughLevel(
          economy.development,
          property.developmentBranch,
          property.developmentLevel,
        );
        creditsPerHour += bonuses.creditsPerHour;
        influencePerHour += bonuses.influencePerHour;
      }
    }

    const settlement = settleGridResources({
      credits: runtime.playerState.credits,
      influence: runtime.playerState.influence,
      creditsPerHour,
      influencePerHour,
      remainders: {
        credits: runtime.playerState.creditsAccrualRemainder ?? 0,
        influence: runtime.playerState.influenceAccrualRemainder ?? 0,
      },
      lastSettledAtMs: Date.parse(runtime.playerState.resourcesSettledAt),
      nowMs: Date.parse(generatedAt),
      offlineAccrualCapMinutes: economy.offlineAccrualCapMinutes,
    });

    income = {
      pendingCredits: settlement.creditsEarned,
      pendingInfluence: settlement.influenceEarned,
      creditsPerHour,
      influencePerHour,
      collectibleAt:
        settlement.creditsEarned > 0 || settlement.influenceEarned > 0
          ? null
          : nextCollectibleAt(
              generatedAt,
              creditsPerHour,
              influencePerHour,
              settlement.remainders.credits,
              settlement.remainders.influence,
            ),
    };
  }

  return {
    version: 1,
    readOnly: true,
    source: runtime ? 'database' : 'compiled-package',
    city: pkg.city,
    season: {
      slug: pkg.seasonTemplate.slug,
      name: pkg.seasonTemplate.name,
      status: runtime?.seasonStatus ?? 'not-activated',
      runtimeActive: runtime?.seasonStatus === 'active' || runtime?.seasonStatus === 'surge',
    },
    player: {
      authenticated: Boolean(viewerPlayerId),
      joined,
      wallet: runtime?.playerState ?? null,
      attackCommitOptions,
      income,
      activeContests,
    },
    counts: {
      districts: pkg.districts.length,
      territories: territories.length,
      properties: properties.length,
      occupiedTerritories: territories.filter((territory) => territory.ownership !== 'neutral').length,
      occupiedProperties: properties.filter((property) => property.ownership !== 'neutral').length,
      activeContests: activeRuntimeContests.length,
    },
    territories,
    properties,
    validClaimSlugs,
    yourSkylines,
  };
}

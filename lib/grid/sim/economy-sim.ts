import type { GridCityPackage } from '../core/types';
import type { GridDevelopmentBranch, GridEconomyConfig } from '../core/economy-types';
import { GRID_DEVELOPMENT_BRANCHES } from '../core/economy-types';
import {
  resolvePropertyAcquisitionCost,
  resolvePropertyIncomeRate,
  resolveTerritoryClaimCost,
  resolveTerritoryIncomeRate,
  settleCommandPoints,
  settleGridResources,
} from '../core/resources';
import {
  getDevelopmentBonusesThroughLevel,
  getNextDevelopmentLevel,
} from '../core/development';
import { computeSkylineComponents, matchSkylineRules } from '../core/skyline';
import { createSeededRng } from './rng';

const HOUR_MS = 60 * 60 * 1000;

export interface GridEconomySimulationOptions {
  seed: number;
  playerCount: number;
  seasonHours?: number;
  activityCadenceHours?: number[];
}

interface DevelopmentState {
  branch: GridDevelopmentBranch;
  level: number;
}

interface SimPlayer {
  id: string;
  credits: number;
  influence: number;
  commandPoints: number;
  commandPointsUpdatedAtMs: number;
  resourcesSettledAtMs: number;
  creditRemainder: number;
  influenceRemainder: number;
  earnedCredits: number;
  earnedInfluence: number;
  discardedAccrualMs: number;
  ownedTerritories: string[];
  ownedProperties: string[];
  development: Record<string, DevelopmentState>;
  cadenceHours: number;
  firstClaimHour: number | null;
  firstPropertyHour: number | null;
  firstUpgradeHour: number | null;
  firstSkylineHour: number | null;
}

export interface GridEconomySimulationEvent {
  sequence: number;
  hour: number;
  type: 'join' | 'claim' | 'acquire' | 'develop';
  playerId: string;
  assetSlug?: string;
  claimMode?: 'starter' | 'adjacent';
  sourceTerritorySlug?: string;
  branch?: GridDevelopmentBranch;
  level?: number;
}

export interface GridEconomySimulationPlayerReport {
  playerId: string;
  cadenceHours: number;
  credits: number;
  influence: number;
  commandPoints: number;
  territories: number;
  properties: number;
  developedProperties: number;
  earnedCredits: number;
  earnedInfluence: number;
  discardedOfflineHours: number;
  firstClaimHour: number | null;
  firstPropertyHour: number | null;
  firstUpgradeHour: number | null;
  firstSkylineHour: number | null;
}

export interface GridEconomySimulationSnapshot {
  hour: number;
  credits: number;
  influence: number;
  claimedTerritories: number;
  acquiredProperties: number;
  developmentLevels: number;
}

export interface GridEconomySimulationReport {
  seed: number;
  hours: number;
  playerCount: number;
  totals: {
    credits: number;
    influence: number;
    claimedTerritories: number;
    acquiredProperties: number;
    developmentLevels: number;
  };
  concentration: {
    territoryGini: number;
    propertyGini: number;
    creditGini: number;
  };
  milestones: {
    medianFirstClaimHour: number | null;
    medianFirstPropertyHour: number | null;
    medianFirstUpgradeHour: number | null;
    medianFirstSkylineHour: number | null;
    allTerritoriesClaimedHour: number | null;
    allPropertiesAcquiredHour: number | null;
  };
  branchRoi: Record<
    GridDevelopmentBranch,
    {
      totalCreditCost: number;
      totalCommandPointCost: number;
      creditsPerHour: number;
      influencePerHour: number;
      creditPaybackHours: number | null;
    }
  >;
  snapshots: GridEconomySimulationSnapshot[];
  players: GridEconomySimulationPlayerReport[];
  events: GridEconomySimulationEvent[];
  invariantViolations: string[];
}

function pick<T>(items: T[], rng: () => number): T | null {
  if (items.length === 0) return null;
  return items[Math.floor(rng() * items.length)] ?? null;
}

function canPay(player: SimPlayer, cost: { credits: number; commandPoints: number }): boolean {
  return player.credits >= cost.credits && player.commandPoints >= cost.commandPoints;
}

function pay(player: SimPlayer, cost: { credits: number; commandPoints: number }): void {
  player.credits -= cost.credits;
  player.commandPoints -= cost.commandPoints;
}

function median(values: Array<number | null>): number | null {
  const sorted = values.filter((value): value is number => value !== null).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

function gini(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const total = sorted.reduce((sum, value) => sum + value, 0);
  if (total === 0) return 0;
  let weighted = 0;
  for (let i = 0; i < sorted.length; i += 1) weighted += (i + 1) * sorted[i];
  return Number(((2 * weighted) / (sorted.length * total) - (sorted.length + 1) / sorted.length).toFixed(4));
}

function developmentLevelTotal(players: SimPlayer[]): number {
  return players.reduce(
    (sum, player) =>
      sum + Object.values(player.development).reduce((inner, dev) => inner + dev.level, 0),
    0,
  );
}

function makeSnapshot(
  hour: number,
  players: SimPlayer[],
  territoryOwners: Map<string, string>,
  propertyOwners: Map<string, string>,
): GridEconomySimulationSnapshot {
  return {
    hour,
    credits: players.reduce((sum, player) => sum + player.credits, 0),
    influence: players.reduce((sum, player) => sum + player.influence, 0),
    claimedTerritories: territoryOwners.size,
    acquiredProperties: propertyOwners.size,
    developmentLevels: developmentLevelTotal(players),
  };
}

function buildBranchRoi(
  economy: GridEconomyConfig,
): GridEconomySimulationReport['branchRoi'] {
  return Object.fromEntries(
    GRID_DEVELOPMENT_BRANCHES.map((branch) => {
      const levels = economy.development[branch].levels;
      const totalCreditCost = levels.reduce((sum, entry) => sum + entry.cost.credits, 0);
      const totalCommandPointCost = levels.reduce(
        (sum, entry) => sum + entry.cost.commandPoints,
        0,
      );
      const creditsPerHour = levels.reduce(
        (sum, entry) => sum + (entry.bonuses.creditsPerHour ?? 0),
        0,
      );
      const influencePerHour = levels.reduce(
        (sum, entry) => sum + (entry.bonuses.influencePerHour ?? 0),
        0,
      );
      return [
        branch,
        {
          totalCreditCost,
          totalCommandPointCost,
          creditsPerHour,
          influencePerHour,
          creditPaybackHours:
            creditsPerHour > 0
              ? Number((totalCreditCost / creditsPerHour).toFixed(2))
              : null,
        },
      ];
    }),
  ) as GridEconomySimulationReport['branchRoi'];
}

function territoryNeighbors(pkg: GridCityPackage, slug: string): string[] {
  return pkg.edges
    .flatMap((edge) => (edge.a === slug ? [edge.b] : edge.b === slug ? [edge.a] : []))
    .sort();
}

function incomeForPlayer(
  pkg: GridCityPackage,
  economy: GridEconomyConfig,
  player: SimPlayer,
): { creditsPerHour: number; influencePerHour: number } {
  let creditsPerHour = 0;
  let influencePerHour = 0;
  for (const slug of player.ownedTerritories) {
    const rate = resolveTerritoryIncomeRate(economy, slug);
    creditsPerHour += rate.creditsPerHour;
    influencePerHour += rate.influencePerHour;
  }

  for (const slug of player.ownedProperties) {
    const rate = resolvePropertyIncomeRate(economy, slug);
    creditsPerHour += rate.creditsPerHour;
    influencePerHour += rate.influencePerHour;
    const dev = player.development[slug];
    if (!dev) continue;
    const bonus = getDevelopmentBonusesThroughLevel(economy.development, dev.branch, dev.level);
    creditsPerHour += bonus.creditsPerHour;
    influencePerHour += bonus.influencePerHour;
  }

  const propertyStates = player.ownedProperties.map((propertySlug) => {
    const property = pkg.properties.find((entry) => entry.slug === propertySlug)!;
    const dev = player.development[propertySlug];
    return {
      propertySlug,
      territorySlug: property.territorySlug,
      developmentBranch: dev?.branch ?? null,
      developmentLevel: dev?.level ?? 0,
    };
  });

  for (const component of computeSkylineComponents(propertyStates, pkg.edges)) {
    for (const rule of matchSkylineRules(component, economy.skyline.rules)) {
      creditsPerHour += rule.bonuses.creditsPerHour ?? 0;
      influencePerHour += rule.bonuses.influencePerHour ?? 0;
    }
  }

  return { creditsPerHour, influencePerHour };
}

function settlePlayer(
  pkg: GridCityPackage,
  economy: GridEconomyConfig,
  player: SimPlayer,
  hour: number,
): void {
  const nowMs = hour * HOUR_MS;
  const income = incomeForPlayer(pkg, economy, player);
  const elapsedMs = nowMs - player.resourcesSettledAtMs;
  const resources = settleGridResources({
    credits: player.credits,
    influence: player.influence,
    creditsPerHour: income.creditsPerHour,
    influencePerHour: income.influencePerHour,
    remainders: {
      credits: player.creditRemainder,
      influence: player.influenceRemainder,
    },
    lastSettledAtMs: player.resourcesSettledAtMs,
    nowMs,
    offlineAccrualCapMinutes: economy.offlineAccrualCapMinutes,
  });

  player.credits = resources.credits;
  player.influence = resources.influence;
  player.creditRemainder = resources.remainders.credits;
  player.influenceRemainder = resources.remainders.influence;
  player.resourcesSettledAtMs = resources.settledAtMs;
  player.earnedCredits += resources.creditsEarned;
  player.earnedInfluence += resources.influenceEarned;
  player.discardedAccrualMs += Math.max(0, elapsedMs - resources.billableMs);

  const cp = settleCommandPoints({
    current: player.commandPoints,
    max: pkg.seasonTemplate.balance.maxCommandPoints,
    regenIntervalMinutes: pkg.seasonTemplate.balance.commandPointRegenMinutes,
    updatedAtMs: player.commandPointsUpdatedAtMs,
    nowMs,
  });
  player.commandPoints = cp.commandPoints;
  player.commandPointsUpdatedAtMs = cp.updatedAtMs;
}

function availableClaimTargets(
  pkg: GridCityPackage,
  economy: GridEconomyConfig,
  player: SimPlayer,
  territoryOwners: Map<string, string>,
): Array<{ slug: string; mode: 'starter' | 'adjacent'; source?: string }> {
  if (player.ownedTerritories.length === 0) {
    return economy.neutralClaims.starterTerritorySlugs
      .filter((slug) => !territoryOwners.has(slug))
      .sort()
      .map((slug) => ({ slug, mode: 'starter' as const }));
  }

  const targets = new Map<string, string>();
  for (const source of player.ownedTerritories.slice().sort()) {
    for (const neighbor of territoryNeighbors(pkg, source)) {
      if (!territoryOwners.has(neighbor) && !targets.has(neighbor)) {
        targets.set(neighbor, source);
      }
    }
  }

  return [...targets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([slug, source]) => ({
      slug,
      mode: 'adjacent' as const,
      source,
    }));
}

function attemptClaim(
  pkg: GridCityPackage,
  economy: GridEconomyConfig,
  player: SimPlayer,
  hour: number,
  rng: () => number,
  territoryOwners: Map<string, string>,
  events: GridEconomySimulationEvent[],
): boolean {
  const payable = availableClaimTargets(pkg, economy, player, territoryOwners).filter(
    (target) => canPay(player, resolveTerritoryClaimCost(economy, target.slug)),
  );
  const target = pick(payable, rng);
  if (!target) return false;

  pay(player, resolveTerritoryClaimCost(economy, target.slug));
  territoryOwners.set(target.slug, player.id);
  player.ownedTerritories.push(target.slug);
  player.ownedTerritories.sort();
  if (player.firstClaimHour === null) player.firstClaimHour = hour;

  events.push({
    sequence: events.length + 1,
    hour,
    type: 'claim',
    playerId: player.id,
    assetSlug: target.slug,
    claimMode: target.mode,
    sourceTerritorySlug: target.source,
  });
  return true;
}
function attemptAcquire(
  pkg: GridCityPackage,
  economy: GridEconomyConfig,
  player: SimPlayer,
  hour: number,
  rng: () => number,
  propertyOwners: Map<string, string>,
  events: GridEconomySimulationEvent[],
): boolean {
  const ownedTerritories = new Set(player.ownedTerritories);
  const payable = pkg.properties
    .filter((property) => !propertyOwners.has(property.slug))
    .filter(
      (property) =>
        !economy.propertyAcquisition.requireTerritoryControl ||
        ownedTerritories.has(property.territorySlug),
    )
    .filter((property) =>
      canPay(player, resolvePropertyAcquisitionCost(economy, property.slug)),
    )
    .sort((a, b) => a.slug.localeCompare(b.slug));
  const property = pick(payable, rng);
  if (!property) return false;

  pay(player, resolvePropertyAcquisitionCost(economy, property.slug));
  propertyOwners.set(property.slug, player.id);
  player.ownedProperties.push(property.slug);
  player.ownedProperties.sort();
  if (player.firstPropertyHour === null) player.firstPropertyHour = hour;

  events.push({
    sequence: events.length + 1,
    hour,
    type: 'acquire',
    playerId: player.id,
    assetSlug: property.slug,
  });
  return true;
}

function chooseDevelopmentBranch(rng: () => number): GridDevelopmentBranch {
  return GRID_DEVELOPMENT_BRANCHES[
    Math.floor(rng() * GRID_DEVELOPMENT_BRANCHES.length)
  ];
}

function hasSkyline(
  pkg: GridCityPackage,
  economy: GridEconomyConfig,
  player: SimPlayer,
): boolean {
  const states = player.ownedProperties.map((propertySlug) => {
    const property = pkg.properties.find((entry) => entry.slug === propertySlug)!;
    const dev = player.development[propertySlug];
    return {
      propertySlug,
      territorySlug: property.territorySlug,
      developmentBranch: dev?.branch ?? null,
      developmentLevel: dev?.level ?? 0,
    };
  });

  return computeSkylineComponents(states, pkg.edges).some(
    (component) => matchSkylineRules(component, economy.skyline.rules).length > 0,
  );
}

function attemptDevelop(
  pkg: GridCityPackage,
  economy: GridEconomyConfig,
  player: SimPlayer,
  hour: number,
  rng: () => number,
  events: GridEconomySimulationEvent[],
): boolean {
  const candidates = player.ownedProperties.flatMap((propertySlug) => {
    const existing = player.development[propertySlug];
    const branch = existing?.branch ?? chooseDevelopmentBranch(rng);
    const currentLevel = existing?.level ?? 0;
    const next = getNextDevelopmentLevel(
      economy.development,
      branch,
      currentLevel,
    );
    if (!next || !canPay(player, next.cost)) return [];
    return [{ propertySlug, branch, next }];
  });

  const candidate = pick(candidates, rng);
  if (!candidate) return false;

  pay(player, candidate.next.cost);
  player.development[candidate.propertySlug] = {
    branch: candidate.branch,
    level: candidate.next.level,
  };
  if (player.firstUpgradeHour === null) player.firstUpgradeHour = hour;
  if (player.firstSkylineHour === null && hasSkyline(pkg, economy, player)) {
    player.firstSkylineHour = hour;
  }

  events.push({
    sequence: events.length + 1,
    hour,
    type: 'develop',
    playerId: player.id,
    assetSlug: candidate.propertySlug,
    branch: candidate.branch,
    level: candidate.next.level,
  });
  return true;
}

function takeAction(
  pkg: GridCityPackage,
  economy: GridEconomyConfig,
  player: SimPlayer,
  hour: number,
  rng: () => number,
  territoryOwners: Map<string, string>,
  propertyOwners: Map<string, string>,
  events: GridEconomySimulationEvent[],
): void {
  if (player.ownedTerritories.length === 0) {
    attemptClaim(pkg, economy, player, hour, rng, territoryOwners, events);
    return;
  }

  const roll = rng();
  const order =
    roll < 0.36
      ? ['claim', 'acquire', 'develop']
      : roll < 0.7
        ? ['acquire', 'develop', 'claim']
        : ['develop', 'claim', 'acquire'];

  for (const action of order) {
    if (
      action === 'claim' &&
      attemptClaim(pkg, economy, player, hour, rng, territoryOwners, events)
    ) return;
    if (
      action === 'acquire' &&
      attemptAcquire(pkg, economy, player, hour, rng, propertyOwners, events)
    ) return;
    if (
      action === 'develop' &&
      attemptDevelop(pkg, economy, player, hour, rng, events)
    ) return;
  }
}

function auditLedger(
  pkg: GridCityPackage,
  economy: GridEconomyConfig,
  events: GridEconomySimulationEvent[],
): string[] {
  const violations: string[] = [];
  const territoryOwners = new Map<string, string>();
  const propertyOwners = new Map<string, string>();
  const playerTerritories = new Map<string, Set<string>>();

  for (const event of events) {
    if (event.type === 'join') {
      if (!playerTerritories.has(event.playerId)) {
        playerTerritories.set(event.playerId, new Set());
      }
      continue;
    }

    if (event.type === 'claim' && event.assetSlug) {
      const owned = playerTerritories.get(event.playerId) ?? new Set<string>();
      if (territoryOwners.has(event.assetSlug)) {
        violations.push(`double-owned territory ${event.assetSlug}`);
      }

      if (event.claimMode === 'starter') {
        if (
          owned.size !== 0 ||
          !economy.neutralClaims.starterTerritorySlugs.includes(event.assetSlug)
        ) {
          violations.push(`invalid starter claim ${event.assetSlug}`);
        }
      } else if (event.claimMode === 'adjacent') {
        const source = event.sourceTerritorySlug;
        const neighbors = source ? territoryNeighbors(pkg, source) : [];
        if (!source || !owned.has(source) || !neighbors.includes(event.assetSlug)) {
          violations.push(`invalid adjacent claim ${event.assetSlug}`);
        }
      }

      territoryOwners.set(event.assetSlug, event.playerId);
      owned.add(event.assetSlug);
      playerTerritories.set(event.playerId, owned);
    }

    if (event.type === 'acquire' && event.assetSlug) {
      if (propertyOwners.has(event.assetSlug)) {
        violations.push(`double-owned property ${event.assetSlug}`);
      }
      const property = pkg.properties.find(
        (entry) => entry.slug === event.assetSlug,
      );
      const owned = playerTerritories.get(event.playerId) ?? new Set<string>();
      if (
        !property ||
        (economy.propertyAcquisition.requireTerritoryControl &&
          !owned.has(property.territorySlug))
      ) {
        violations.push(`invalid property acquisition ${event.assetSlug}`);
      }
      propertyOwners.set(event.assetSlug, event.playerId);
    }
  }

  return violations;
}
function makePlayer(
  index: number,
  pkg: GridCityPackage,
  cadenceHours: number,
): SimPlayer {
  return {
    id: `player-${index + 1}`,
    credits: pkg.seasonTemplate.balance.startingCredits,
    influence: pkg.seasonTemplate.balance.startingInfluence,
    commandPoints: pkg.seasonTemplate.balance.maxCommandPoints,
    commandPointsUpdatedAtMs: 0,
    resourcesSettledAtMs: 0,
    creditRemainder: 0,
    influenceRemainder: 0,
    earnedCredits: 0,
    earnedInfluence: 0,
    discardedAccrualMs: 0,
    ownedTerritories: [],
    ownedProperties: [],
    development: {},
    cadenceHours,
    firstClaimHour: null,
    firstPropertyHour: null,
    firstUpgradeHour: null,
    firstSkylineHour: null,
  };
}
export function runEconomySimulation(
  pkg: GridCityPackage,
  options: GridEconomySimulationOptions,
): GridEconomySimulationReport {
  const economy = pkg.seasonTemplate.economy;
  if (!economy) {
    throw new Error('economy simulation requires season economy configuration');
  }
  if (!Number.isInteger(options.playerCount) || options.playerCount < 1) {
    throw new Error('economy simulation playerCount must be a positive integer');
  }

  const hours =
    options.seasonHours ?? pkg.seasonTemplate.durationDays * 24;
  if (!Number.isInteger(hours) || hours < 1) {
    throw new Error('economy simulation seasonHours must be positive');
  }

  const cadence =
    options.activityCadenceHours ?? [1, 2, 4, 8, 12, 24];
  if (
    cadence.length === 0 ||
    cadence.some((value) => !Number.isInteger(value) || value < 1)
  ) {
    throw new Error(
      'economy simulation activity cadence must contain positive integers',
    );
  }

  const rng = createSeededRng(options.seed);
  const players = Array.from({ length: options.playerCount }, (_, index) =>
    makePlayer(index, pkg, cadence[index % cadence.length]),
  );
  const territoryOwners = new Map<string, string>();
  const propertyOwners = new Map<string, string>();
  const snapshots: GridEconomySimulationSnapshot[] = [];
  const events: GridEconomySimulationEvent[] = players.map(
    (player, index) => ({
      sequence: index + 1,
      hour: 0,
      type: 'join',
      playerId: player.id,
    }),
  );

  for (let hour = 0; hour <= hours; hour += 1) {
    for (const player of players) {
      if (hour === 0) {
        takeAction(
          pkg,
          economy,
          player,
          hour,
          rng,
          territoryOwners,
          propertyOwners,
          events,
        );
        continue;
      }
      if (hour % player.cadenceHours !== 0) continue;
      settlePlayer(pkg, economy, player, hour);
      takeAction(
        pkg,
        economy,
        player,
        hour,
        rng,
        territoryOwners,
        propertyOwners,
        events,
      );
      if (
        player.credits < 0 ||
        player.influence < 0 ||
        player.commandPoints < 0
      ) {
        throw new Error(
          `simulation produced negative resources for ${player.id}`,
        );
      }
    }

    if (hour === 0 || (hour % 24 === 0 && hour !== hours)) {
      snapshots.push(makeSnapshot(hour, players, territoryOwners, propertyOwners));
    }
  }

  for (const player of players) {
    if (player.resourcesSettledAtMs !== hours * HOUR_MS) {
      settlePlayer(pkg, economy, player, hours);
    }
  }
  snapshots.push(makeSnapshot(hours, players, territoryOwners, propertyOwners));

  const claimEvents = events.filter((event) => event.type === 'claim');
  const acquireEvents = events.filter((event) => event.type === 'acquire');
  const allTerritoriesClaimedHour =
    claimEvents.length === pkg.territories.length
      ? claimEvents[claimEvents.length - 1]?.hour ?? null
      : null;
  const allPropertiesAcquiredHour =
    acquireEvents.length === pkg.properties.length
      ? acquireEvents[acquireEvents.length - 1]?.hour ?? null
      : null;

  const playerReports: GridEconomySimulationPlayerReport[] =
    players.map((player) => ({
      playerId: player.id,
      cadenceHours: player.cadenceHours,
      credits: player.credits,
      influence: player.influence,
      commandPoints: player.commandPoints,
      territories: player.ownedTerritories.length,
      properties: player.ownedProperties.length,
      developedProperties: Object.keys(player.development).length,
      earnedCredits: player.earnedCredits,
      earnedInfluence: player.earnedInfluence,
      discardedOfflineHours: Number(
        (player.discardedAccrualMs / HOUR_MS).toFixed(2),
      ),
      firstClaimHour: player.firstClaimHour,
      firstPropertyHour: player.firstPropertyHour,
      firstUpgradeHour: player.firstUpgradeHour,
      firstSkylineHour: player.firstSkylineHour,
    }));

  const violations = auditLedger(pkg, economy, events);
  for (const player of playerReports) {
    if (
      player.credits < 0 ||
      player.influence < 0 ||
      player.commandPoints < 0
    ) {
      violations.push(`negative resources for ${player.playerId}`);
    }
  }

  return {
    seed: options.seed,
    hours,
    playerCount: players.length,
    totals: {
      credits: playerReports.reduce(
        (sum, player) => sum + player.credits,
        0,
      ),
      influence: playerReports.reduce(
        (sum, player) => sum + player.influence,
        0,
      ),
      claimedTerritories: territoryOwners.size,
      acquiredProperties: propertyOwners.size,
      developmentLevels: developmentLevelTotal(players),
    },
    concentration: {
      territoryGini: gini(
        playerReports.map((player) => player.territories),
      ),
      propertyGini: gini(
        playerReports.map((player) => player.properties),
      ),
      creditGini: gini(
        playerReports.map((player) => player.credits),
      ),
    },
    milestones: {
      medianFirstClaimHour: median(
        playerReports.map((player) => player.firstClaimHour),
      ),
      medianFirstPropertyHour: median(
        playerReports.map((player) => player.firstPropertyHour),
      ),
      medianFirstUpgradeHour: median(
        playerReports.map((player) => player.firstUpgradeHour),
      ),
      medianFirstSkylineHour: median(
        playerReports.map((player) => player.firstSkylineHour),
      ),
      allTerritoriesClaimedHour,
      allPropertiesAcquiredHour,
    },
    branchRoi: buildBranchRoi(economy),
    snapshots,
    players: playerReports,
    events,
    invariantViolations: violations,
  };
}

import type { GridCityPackage } from '../core/types';
import { getDevelopmentBonusesThroughLevel } from '../core/development';
import {
  resolvePropertyIncomeRate,
  resolveTerritoryIncomeRate,
  settleCommandPoints,
  settleGridResources,
} from '../core/resources';
import type {
  GridReturnActivityEvent,
  GridReturnResourceState,
  GridReturnSummaryPort,
  GridReturnViewerRole,
} from './return-summary-port';

export interface GridReturnSummary {
  since: string;
  generatedAt: string;
  timeAwayMinutes: number;
  truncated: boolean;
  eventsScanned: number;
  pendingResources: {
    creditsProduced: number;
    influenceGenerated: number;
    commandPointsRestored: number;
    projectedCredits: number;
    projectedInfluence: number;
    projectedCommandPoints: number;
    billableMinutes: number;
    offlineAccrualCapped: boolean;
  };
  cityActivity: {
    territoryClaims: number;
    propertyAcquisitions: number;
    propertyDevelopments: number;
    contestsStarted: number;
    contestRounds: number;
    territoryCaptures: number;
  };
  yourActivity: {
    territoryClaims: number;
    propertyAcquisitions: number;
    propertyDevelopments: number;
    attacksStarted: number;
    defensesFaced: number;
    contestsWon: number;
    contestsLost: number;
  };
  highlights: Array<{
    at: string;
    kind: string;
    message: string;
  }>;
}

const MAX_ACTIVITY_EVENTS = 200;
const MAX_HIGHLIGHTS = 6;
const MINUTE_MS = 60 * 1000;

function isYou(role: GridReturnViewerRole): boolean {
  return role !== 'none';
}

function incomeRates(
  pkg: GridCityPackage,
  state: GridReturnResourceState,
): { creditsPerHour: number; influencePerHour: number } {
  const economy = pkg.seasonTemplate.economy;
  if (!economy) return { creditsPerHour: 0, influencePerHour: 0 };

  let creditsPerHour = 0;
  let influencePerHour = 0;

  for (const slug of state.ownedTerritorySlugs) {
    const rate = resolveTerritoryIncomeRate(economy, slug);
    creditsPerHour += rate.creditsPerHour;
    influencePerHour += rate.influencePerHour;
  }

  for (const property of state.ownedProperties) {
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

  return { creditsPerHour, influencePerHour };
}

function previewResources(
  pkg: GridCityPackage,
  state: GridReturnResourceState,
  generatedAt: string,
): GridReturnSummary['pendingResources'] {
  const nowMs = Date.parse(generatedAt);
  const resourceUpdatedMs = Date.parse(state.resourcesSettledAt);
  const commandPointsUpdatedMs = Date.parse(state.commandPointsUpdatedAt);

  if (!Number.isFinite(resourceUpdatedMs) || !Number.isFinite(commandPointsUpdatedMs)) {
    throw new Error('Grid return summary encountered invalid resource timestamps');
  }

  const economy = pkg.seasonTemplate.economy;
  const rates = incomeRates(pkg, state);

  const resourceSettlement = economy
    ? settleGridResources({
        credits: state.credits,
        influence: state.influence,
        creditsPerHour: rates.creditsPerHour,
        influencePerHour: rates.influencePerHour,
        remainders: {
          credits: state.creditsAccrualRemainder,
          influence: state.influenceAccrualRemainder,
        },
        lastSettledAtMs: resourceUpdatedMs,
        nowMs,
        offlineAccrualCapMinutes: economy.offlineAccrualCapMinutes,
      })
    : {
        credits: state.credits,
        influence: state.influence,
        creditsEarned: 0,
        influenceEarned: 0,
        billableMs: 0,
      };

  const commandPoints = settleCommandPoints({
    current: state.commandPoints,
    max: pkg.seasonTemplate.balance.maxCommandPoints,
    regenIntervalMinutes: pkg.seasonTemplate.balance.commandPointRegenMinutes,
    updatedAtMs: commandPointsUpdatedMs,
    nowMs,
  });

  const elapsedResourceMs = Math.max(0, nowMs - resourceUpdatedMs);

  return {
    creditsProduced: resourceSettlement.creditsEarned,
    influenceGenerated: resourceSettlement.influenceEarned,
    commandPointsRestored: commandPoints.regenerated,
    projectedCredits: resourceSettlement.credits,
    projectedInfluence: resourceSettlement.influence,
    projectedCommandPoints: commandPoints.commandPoints,
    billableMinutes: Math.floor(resourceSettlement.billableMs / MINUTE_MS),
    offlineAccrualCapped: elapsedResourceMs > resourceSettlement.billableMs,
  };
}

function highlightFor(
  event: GridReturnActivityEvent,
): GridReturnSummary['highlights'][number] | null {
  const base = { at: event.createdAt };

  if (event.eventType === 'grid:territory_claimed' && event.viewerRole === 'actor') {
    return { ...base, kind: 'territory-claimed', message: 'You claimed new territory.' };
  }
  if (event.eventType === 'grid:property_acquired' && event.viewerRole === 'actor') {
    return { ...base, kind: 'property-acquired', message: 'You acquired a Grid property.' };
  }
  if (event.eventType === 'grid:property_developed' && event.viewerRole === 'actor') {
    return { ...base, kind: 'property-developed', message: 'One of your Grid properties was upgraded.' };
  }
  if (event.eventType === 'grid:contest_started') {
    if (event.viewerRole === 'attacker') {
      return { ...base, kind: 'attack-started', message: 'You launched a territory contest.' };
    }
    if (event.viewerRole === 'defender') {
      return { ...base, kind: 'defense-started', message: 'One of your territories came under contest.' };
    }
  }
  if (event.eventType === 'grid:contest_auto_retreat_capture') {
    if (event.viewerRole === 'attacker') {
      return { ...base, kind: 'contest-won', message: 'A defender auto-retreated and you captured territory.' };
    }
    if (event.viewerRole === 'defender') {
      return { ...base, kind: 'contest-lost', message: 'Your defense doctrine auto-retreated from a territory.' };
    }
  }
  if (event.eventType === 'grid:contest_session_round_resolved') {
    if (event.contestOutcome === 'captured') {
      return event.viewerRole === 'attacker'
        ? { ...base, kind: 'contest-won', message: 'Your attack captured a territory.' }
        : event.viewerRole === 'defender'
          ? { ...base, kind: 'contest-lost', message: 'You lost a territory after a contest.' }
          : null;
    }
    if (event.contestOutcome === 'defended') {
      return event.viewerRole === 'defender'
        ? { ...base, kind: 'contest-won', message: 'You successfully defended a territory.' }
        : event.viewerRole === 'attacker'
          ? { ...base, kind: 'contest-lost', message: 'Your territory attack was stopped.' }
          : null;
    }
  }
  if (event.eventType === 'grid:contest_withdrawn' && isYou(event.viewerRole)) {
    return event.viewerRole === 'attacker'
      ? { ...base, kind: 'contest-withdrawn', message: 'You withdrew from a territory contest.' }
      : { ...base, kind: 'contest-withdrawn', message: 'An attacker withdrew from your territory.' };
  }

  return null;
}

export async function buildGridReturnSummary(
  port: GridReturnSummaryPort,
  pkg: GridCityPackage,
  playerId: string,
  generatedAt: string,
): Promise<GridReturnSummary | null> {
  if (!playerId.trim()) throw new Error('Grid return summary requires playerId');
  if (!Number.isFinite(Date.parse(generatedAt))) {
    throw new Error('Grid return summary requires a valid generatedAt timestamp');
  }

  const context = await port.getContext(playerId);
  if (!context) return null;

  const sinceMs = Date.parse(context.lastActiveAt);
  if (!Number.isFinite(sinceMs)) {
    throw new Error('Grid return summary encountered invalid lastActiveAt');
  }

  const batch = await port.listActivity(
    context.seasonId,
    playerId,
    context.lastActiveAt,
    MAX_ACTIVITY_EVENTS,
  );

  const summary: GridReturnSummary = {
    since: context.lastActiveAt,
    generatedAt,
    timeAwayMinutes: Math.max(0, Math.floor((Date.parse(generatedAt) - sinceMs) / MINUTE_MS)),
    truncated: batch.truncated,
    eventsScanned: batch.events.length,
    pendingResources: previewResources(pkg, context.resources, generatedAt),
    cityActivity: {
      territoryClaims: 0,
      propertyAcquisitions: 0,
      propertyDevelopments: 0,
      contestsStarted: 0,
      contestRounds: 0,
      territoryCaptures: 0,
    },
    yourActivity: {
      territoryClaims: 0,
      propertyAcquisitions: 0,
      propertyDevelopments: 0,
      attacksStarted: 0,
      defensesFaced: 0,
      contestsWon: 0,
      contestsLost: 0,
    },
    highlights: [],
  };

  for (const event of batch.events) {
    if (event.eventType === 'grid:territory_claimed') {
      summary.cityActivity.territoryClaims += 1;
      if (event.viewerRole === 'actor') summary.yourActivity.territoryClaims += 1;
    } else if (event.eventType === 'grid:property_acquired') {
      summary.cityActivity.propertyAcquisitions += 1;
      if (event.viewerRole === 'actor') summary.yourActivity.propertyAcquisitions += 1;
    } else if (event.eventType === 'grid:property_developed') {
      summary.cityActivity.propertyDevelopments += 1;
      if (event.viewerRole === 'actor') summary.yourActivity.propertyDevelopments += 1;
    } else if (event.eventType === 'grid:contest_started') {
      summary.cityActivity.contestsStarted += 1;
      if (event.viewerRole === 'attacker') summary.yourActivity.attacksStarted += 1;
      if (event.viewerRole === 'defender') summary.yourActivity.defensesFaced += 1;
    } else if (event.eventType === 'grid:contest_session_round_resolved') {
      summary.cityActivity.contestRounds += 1;
      if (event.contestOutcome === 'captured') {
        summary.cityActivity.territoryCaptures += 1;
        if (event.viewerRole === 'attacker') summary.yourActivity.contestsWon += 1;
        if (event.viewerRole === 'defender') summary.yourActivity.contestsLost += 1;
      } else if (event.contestOutcome === 'defended') {
        if (event.viewerRole === 'defender') summary.yourActivity.contestsWon += 1;
        if (event.viewerRole === 'attacker') summary.yourActivity.contestsLost += 1;
      }
    } else if (event.eventType === 'grid:contest_auto_retreat_capture') {
      summary.cityActivity.territoryCaptures += 1;
      if (event.viewerRole === 'attacker') summary.yourActivity.contestsWon += 1;
      if (event.viewerRole === 'defender') summary.yourActivity.contestsLost += 1;
    }

    if (summary.highlights.length < MAX_HIGHLIGHTS) {
      const highlight = highlightFor(event);
      if (highlight) summary.highlights.push(highlight);
    }
  }

  return summary;
}

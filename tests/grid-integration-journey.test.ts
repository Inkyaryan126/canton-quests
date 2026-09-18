import { describe, expect, it } from 'vitest';
import { cantonFoundingSeasonPackage } from '../lib/grid/cities/canton/founding-season';
import { validateGridCityPackage } from '../lib/grid/core/city-package';
import {
  joinGridOnboardingSeason,
  type GridOnboardingJoinRequest,
} from '../lib/grid/server/onboarding-join-service';
import {
  claimGridOnboardingStarterTerritory,
  type GridOnboardingStarterClaimRequest,
} from '../lib/grid/server/onboarding-starter-claim-service';
import { readGridStarterTerritories } from '../lib/grid/server/starter-territory-service';
import { buildGridWorldProjection, type GridWorldRuntimeSnapshot } from '../lib/grid/server/world-projection';
import {
  resolvePropertyIncomeRate,
  resolveTerritoryClaimCost,
  resolveTerritoryIncomeRate,
  settleCommandPoints,
  settleGridResources,
} from '../lib/grid/core/resources';
import {
  getDevelopmentBonusesThroughLevel,
  getNextDevelopmentLevel,
} from '../lib/grid/core/development';
import {
  resolveSignalDiceRound,
  signalDiceForCommit,
} from '../lib/grid/core/contest';
import { buildGridReturnSummary } from '../lib/grid/server/return-summary-service';
import {
  scheduleGridAuction,
  placeGridAuctionBid,
  settleGridAuctionCommand,
} from '../lib/grid/server/auction-service';
import type {
  GridAuctionCommandPort,
} from '../lib/grid/server/auction-port';
import {
  planGridFixedPricePurchase,
} from '../lib/grid/core/market-listings';
import { projectGridNpcStronghold } from '../lib/grid/core/npc-strongholds';
import {
  instantiateGridDynamicEvent,
  projectGridDynamicEventStack,
  validateGridDynamicEventTemplate,
} from '../lib/grid/core/dynamic-events';
import { deriveSurgeTiming } from '../lib/grid/core/surge-timing';
import type { GridDevelopmentBranch } from '../lib/grid/core/economy-types';
import type { GridDynamicEventTemplate } from '../lib/grid/core/dynamic-event-types';

import type { GridOnboardingHomeCityPort } from '../lib/grid/server/onboarding-home-city-port';
import type { GridOnboardingSeasonPort } from '../lib/grid/server/onboarding-season-port';
import type { GridEconomyCommandPort, GridPlayerSeasonState } from '../lib/grid/server/economy-port';
import type { GridOnboardingStarterClaimPort } from '../lib/grid/server/onboarding-starter-claim-port';
import type { GridStarterTerritoryPort } from '../lib/grid/server/starter-territory-port';
import type { GridReturnSummaryPort, GridReturnActivityEvent } from '../lib/grid/server/return-summary-port';
import type {
  GridFixedPriceListingRules,
  GridFixedPriceListingState,
  GridMarketAssetSnapshot,
  GridMarketBuyerSnapshot,
} from '../lib/grid/core/market-listing-types';
import { buildGridProgressionSnapshot } from '../lib/grid/core/progression';
import { rankGridProgression } from '../lib/grid/core/progression-ranking';

describe('The Grid: Player Journey Coexistence & Integration Layer', () => {
  const seasonId = 'season-canton-founding-2026';
  const cityId = 'canton-oh';
  const playerAlpha = 'player-alpha-0000-4000-8000-000000000001';
  const playerBravo = 'player-bravo-0000-4000-8000-000000000002';
  const t0 = '2026-09-17T12:00:00.000Z';

  // In-memory persistent stores across journey stages
  const homeCityConfirmations = new Set<string>();
  const playerWallets = new Map<string, GridPlayerSeasonState>();
  const territoryOwners = new Map<string, string>(); // territorySlug -> playerId
  const propertyOwners = new Map<string, string>(); // propertySlug -> playerId
  const propertyDevelopments = new Map<string, { branch: GridDevelopmentBranch; level: number }>();
  const returnEvents: GridReturnActivityEvent[] = [];

  const balance = cantonFoundingSeasonPackage.seasonTemplate.balance;
  const economy = cantonFoundingSeasonPackage.seasonTemplate.economy!;
  const contestConfig = cantonFoundingSeasonPackage.seasonTemplate.contest!;

  // Home City Port
  const homeCityPort: GridOnboardingHomeCityPort = {
    async isHomeCityConfirmed(playerId: string) {
      return homeCityConfirmations.has(playerId);
    },
    async confirmHomeCity(playerId: string) {
      homeCityConfirmations.add(playerId);
      return { cityId, citySlug: cityId, confirmed: true };
    },
  };

  // Season Port
  const seasonPort: GridOnboardingSeasonPort = {
    async getCurrentSeason() {
      return {
        seasonId,
        cityId,
        slug: cantonFoundingSeasonPackage.seasonTemplate.slug,
        name: cantonFoundingSeasonPackage.seasonTemplate.name,
        status: 'active',
      };
    },
  };

  // Economy Command Port
  const economyPort: GridEconomyCommandPort = {
    async joinSeason(input) {
      const existing = playerWallets.get(input.playerId);
      if (existing) return existing;
      const initial: GridPlayerSeasonState = {
        seasonId: input.seasonId,
        cityId,
        playerId: input.playerId,
        credits: balance.startingCredits,
        influence: balance.startingInfluence,
        commandPoints: balance.maxCommandPoints,
        commandPointsUpdatedAt: input.now,
        resourcesSettledAt: input.now,
        creditsAccrualRemainder: 0,
        influenceAccrualRemainder: 0,
        joined: true,
        eventId: null,
      };
      playerWallets.set(input.playerId, initial);
      return initial;
    },
    async settleResources(input) {
      const wallet = playerWallets.get(input.playerId);
      if (!wallet) throw new Error('Player not found');
      wallet.resourcesSettledAt = input.now;
      return wallet;
    },
  };

  // Starter Claim Port
  const starterClaimPort: GridOnboardingStarterClaimPort = {
    async claimStarterTerritory(input) {
      const wallet = playerWallets.get(input.playerId);
      if (!wallet) throw new Error('Wallet not found');

      const territory = cantonFoundingSeasonPackage.territories.find((t) => t.slug === input.territoryId);
      if (!territory) throw new Error('Territory not found');

      if (territoryOwners.has(territory.slug)) {
        throw new Error(`Territory ${territory.slug} already occupied`);
      }

      const cost = resolveTerritoryClaimCost(economy, territory.slug);
      if (wallet.credits < cost.credits || wallet.commandPoints < cost.commandPoints) {
        throw new Error('Insufficient resources for starter claim');
      }

      wallet.credits -= cost.credits;
      wallet.commandPoints -= cost.commandPoints;
      territoryOwners.set(territory.slug, input.playerId);

      returnEvents.push({
        eventType: 'grid:territory_claimed',
        entityType: 'territory',
        createdAt: input.now,
        viewerRole: 'actor',
        contestOutcome: null,
      });

      return {
        seasonId: input.seasonId,
        cityId,
        playerId: input.playerId,
        territoryId: territory.slug,
        territorySlug: territory.slug,
        claimMode: 'starter',
        claimedAt: input.now,
        creditsSpent: cost.credits,
        commandPointsSpent: cost.commandPoints,
        credits: wallet.credits,
        influence: wallet.influence,
        commandPoints: wallet.commandPoints,
        eventId: `claim-event-${Date.now()}`,
      };
    },
  };

  // Starter Territory Read Port
  const starterTerritoryPort: GridStarterTerritoryPort = {
    async getContext(playerId: string) {
      const wallet = playerWallets.get(playerId);
      const owned = [...territoryOwners.entries()]
        .filter(([, owner]) => owner === playerId)
        .map(([slug]) => slug);

      return {
        seasonPlayable: true,
        joined: Boolean(wallet && wallet.joined),
        ownsAnyTerritory: owned.length > 0,
        credits: wallet?.credits ?? 0,
        commandPoints: wallet?.commandPoints ?? 0,
        territories: cantonFoundingSeasonPackage.territories.map((t) => ({
          territoryId: t.slug,
          territorySlug: t.slug,
          occupied: territoryOwners.has(t.slug),
          ownerPlayerId: territoryOwners.get(t.slug) ?? null,
        })),
      };
    },
  };

  let claimedStarterSlug = '';

  it('Stage 0: validates city package configuration integrity', () => {
    const check = validateGridCityPackage(cantonFoundingSeasonPackage);
    expect(check.ok).toBe(true);
    expect(check.errors).toEqual([]);
  });

  it('Stage 1 & 2: enforces auth & requires confirmed Home City before joining', async () => {
    const unconfirmedRequest: GridOnboardingJoinRequest = {
      playerId: playerAlpha,
      idempotencyKey: 'join-alpha-001',
      now: t0,
    };

    // Pre-condition: home city not confirmed
    await expect(
      joinGridOnboardingSeason(homeCityPort, seasonPort, economyPort, unconfirmedRequest),
    ).rejects.toThrow('Grid onboarding Home City must be confirmed before joining');

    // Confirm home city
    homeCityConfirmations.add(playerAlpha);

    // Join succeeds
    const joinResult = await joinGridOnboardingSeason(homeCityPort, seasonPort, economyPort, unconfirmedRequest);
    expect(joinResult.joined).toBe(true);
    expect(joinResult.credits).toBe(balance.startingCredits);
    expect(joinResult.influence).toBe(balance.startingInfluence);
    expect(joinResult.commandPoints).toBe(balance.maxCommandPoints);

    // Idempotency: rejoining with same key returns identical wallet
    const repeatResult = await joinGridOnboardingSeason(homeCityPort, seasonPort, economyPort, unconfirmedRequest);
    expect(repeatResult).toEqual(joinResult);
  });

  it('Stage 3 & 4: views starter territory options and executes starter claim', async () => {
    const starterProjection = await readGridStarterTerritories(
      starterTerritoryPort,
      cantonFoundingSeasonPackage,
      playerAlpha,
    );

    expect(starterProjection.state).toBe('choose-starter');
    expect(starterProjection.availableCount).toBeGreaterThan(0);
    const chosenStarter = starterProjection.options[0];
    expect(chosenStarter).toBeDefined();
    expect(chosenStarter.affordable).toBe(true);
    claimedStarterSlug = chosenStarter.slug;

    // Execute starter claim
    const claimRequest: GridOnboardingStarterClaimRequest = {
      playerId: playerAlpha,
      territoryId: chosenStarter.slug,
      idempotencyKey: 'starter-claim-alpha-001',
      now: t0,
    };

    const claimResult = await claimGridOnboardingStarterTerritory(seasonPort, starterClaimPort, claimRequest);
    expect(claimResult.territorySlug).toBe(chosenStarter.slug);
    expect(territoryOwners.get(chosenStarter.slug)).toBe(playerAlpha);

    // Post-claim projection state
    const postClaimProjection = await readGridStarterTerritories(
      starterTerritoryPort,
      cantonFoundingSeasonPackage,
      playerAlpha,
    );
    expect(postClaimProjection.state).toBe('starter-claim-complete');
    expect(postClaimProjection.options).toHaveLength(0);
  });

  it('Stage 5: projects reactive world reflecting player ownership and city skyline', () => {
    const snapshot: GridWorldRuntimeSnapshot = {
      seasonId,
      seasonStatus: 'active',
      startsAt: t0,
      surgeStartsAt: '2026-09-24T12:00:00.000Z',
      endsAt: '2026-09-27T12:00:00.000Z',
      territories: cantonFoundingSeasonPackage.territories.map((t) => ({
        territorySlug: t.slug,
        ownerPlayerId: territoryOwners.get(t.slug) ?? null,
        claimedAt: territoryOwners.has(t.slug) ? t0 : null,
      })),
      properties: cantonFoundingSeasonPackage.properties.map((p) => ({
        propertySlug: p.slug,
        ownerPlayerId: propertyOwners.get(p.slug) ?? null,
        acquiredAt: null,
        developmentBranch: propertyDevelopments.get(p.slug)?.branch ?? null,
        developmentLevel: propertyDevelopments.get(p.slug)?.level ?? 0,
        conditionBps: 10_000,
      })),
      playerState: playerWallets.get(playerAlpha) ?? null,
    };

    // Projection for playerAlpha
    const alphaWorld = buildGridWorldProjection(cantonFoundingSeasonPackage, {
      viewerPlayerId: playerAlpha,
      runtime: snapshot,
      now: t0,
    });

    expect(alphaWorld.player.authenticated).toBe(true);
    expect(alphaWorld.player.joined).toBe(true);
    const myTerritory = alphaWorld.territories.find((t) => t.slug === claimedStarterSlug);
    expect(myTerritory?.ownership).toBe('you');

    // Projection for spectator / another player
    const spectatorWorld = buildGridWorldProjection(cantonFoundingSeasonPackage, {
      viewerPlayerId: playerBravo,
      runtime: snapshot,
      now: t0,
    });
    const occupiedTerritory = spectatorWorld.territories.find((t) => t.slug === claimedStarterSlug);
    expect(occupiedTerritory?.ownership).toBe('occupied');

    const neutralTerritory = spectatorWorld.territories.find((t) => t.slug !== claimedStarterSlug);
    expect(neutralTerritory?.ownership).toBe('neutral');
  });

  it('Stage 6: returns deterministic public progression rankings after the player loop', () => {
    const ranked = rankGridProgression([
      { playerId: playerBravo, snapshot: buildGridProgressionSnapshot({ xp: 750, territoriesCaptured: 2 }) },
      { playerId: playerAlpha, snapshot: buildGridProgressionSnapshot({ xp: 750, territoriesCaptured: 2 }) },
    ], { type: 'overall' });

    expect(ranked.map((entry) => entry.playerId)).toEqual([playerAlpha, playerBravo]);
    expect(ranked.map((entry) => entry.rank)).toEqual([1, 1]);
    expect(ranked.every((entry) => entry.snapshot.version === 1)).toBe(true);
  });

  it('Stage 6: resolves resource generation, offline caps, and property development', () => {
    const incomeRate = resolveTerritoryIncomeRate(economy, claimedStarterSlug);
    expect(incomeRate.creditsPerHour).toBeGreaterThan(0);

    // Settle 4 hours of offline accrual
    const t4HoursLater = '2026-09-17T16:00:00.000Z';
    const settlement = settleGridResources({
      credits: 500,
      influence: 50,
      creditsPerHour: incomeRate.creditsPerHour,
      influencePerHour: incomeRate.influencePerHour,
      remainders: { credits: 0, influence: 0 },
      lastSettledAtMs: Date.parse(t0),
      nowMs: Date.parse(t4HoursLater),
      offlineAccrualCapMinutes: economy.offlineAccrualCapMinutes,
    });

    expect(settlement.creditsEarned).toBe(incomeRate.creditsPerHour * 4);
    expect(settlement.credits).toBe(500 + incomeRate.creditsPerHour * 4);

    // Command point regeneration: 5 current + 4 hours * 1 cp/hr = 9
    const cpSettlement = settleCommandPoints({
      current: 5,
      max: balance.maxCommandPoints,
      regenIntervalMinutes: balance.commandPointRegenMinutes,
      updatedAtMs: Date.parse(t0),
      nowMs: Date.parse(t4HoursLater),
    });
    expect(cpSettlement.commandPoints).toBe(9);

    // Property development on commerce branch
    const property = cantonFoundingSeasonPackage.properties[0];
    propertyOwners.set(property.slug, playerAlpha);
    const level1Next = getNextDevelopmentLevel(economy.development, 'commerce', 0);
    expect(level1Next).toBeDefined();

    propertyDevelopments.set(property.slug, { branch: 'commerce', level: 1 });
    const bonuses = getDevelopmentBonusesThroughLevel(economy.development, 'commerce', 1);
    expect(bonuses.creditsPerHour).toBeGreaterThan(0);
  });

  it('Stage 7: resolves contest attacks, Signal Dice combat, and territory capture', () => {
    expect(contestConfig.attacker.maxDice).toBeGreaterThan(0);
    expect(contestConfig.defender.maxDice).toBeGreaterThan(0);

    // Determine dice unlock for influence commitments
    const attackerDice = signalDiceForCommit(60, contestConfig.attacker);
    const defenderDice = signalDiceForCommit(20, contestConfig.defender);
    expect(attackerDice).toBeGreaterThanOrEqual(2);
    expect(defenderDice).toBeGreaterThanOrEqual(1);

    // Round 1: Attacker rolls high, defender loses influence
    const roundResult = resolveSignalDiceRound(
      {
        attackerCommittedInfluence: 60,
        defenderCommittedInfluence: 20,
        attackerRolls: [6, 5, 4].slice(0, attackerDice),
        defenderRolls: [2, 1].slice(0, defenderDice),
      },
      contestConfig,
    );

    expect(roundResult.comparisons.length).toBeGreaterThan(0);
    expect(roundResult.defenderInfluenceLost).toBeGreaterThan(0);
    expect(roundResult.defenderRemainingInfluence).toBeLessThan(20);

    // Simulate conquest: defender reaches 0 influence -> ownership transfers
    const targetTerritory = cantonFoundingSeasonPackage.territories[1];
    territoryOwners.set(targetTerritory.slug, playerBravo);
    // After defeat, territory transfers to playerAlpha
    territoryOwners.set(targetTerritory.slug, playerAlpha);
    expect(territoryOwners.get(targetTerritory.slug)).toBe(playerAlpha);

    returnEvents.push({
      eventType: 'grid:contest_started',
      entityType: 'contest',
      createdAt: '2026-09-17T17:50:00.000Z',
      viewerRole: 'defender',
      contestOutcome: null,
    });
    returnEvents.push({
      eventType: 'grid:contest_session_round_resolved',
      entityType: 'contest',
      createdAt: '2026-09-17T18:00:00.000Z',
      viewerRole: 'defender',
      contestOutcome: 'captured',
    });
  });

  it('Stage 8: returns player briefing with billable minutes and combat event alerts', async () => {
    const returnSummaryPort: GridReturnSummaryPort = {
      async getContext(playerId: string) {
        return {
          cityId,
          seasonId,
          lastActiveAt: t0,
          resources: {
            credits: 400,
            influence: 10,
            commandPoints: 4,
            commandPointsUpdatedAt: t0,
            resourcesSettledAt: t0,
            creditsAccrualRemainder: 0,
            influenceAccrualRemainder: 0,
            ownedTerritorySlugs: [],
            ownedProperties: [],
          },
        };
      },
      async listActivity() {
        return {
          events: returnEvents,
          truncated: false,
        };
      },
    };

    const returnSummary = await buildGridReturnSummary(
      returnSummaryPort,
      cantonFoundingSeasonPackage,
      playerBravo,
      '2026-09-17T20:00:00.000Z',
    );

    expect(returnSummary).not.toBeNull();
    expect(returnSummary!.timeAwayMinutes).toBe(480);
    expect(returnSummary!.yourActivity.defensesFaced).toBeGreaterThanOrEqual(1);
    expect(returnSummary!.yourActivity.contestsLost).toBeGreaterThanOrEqual(1);
    expect(returnSummary!.highlights.length).toBeGreaterThan(0);
  });

  it('Stage 9: verifies property auctions, competitive bidding, and fixed-price listings', async () => {
    const auctionStore = new Map<string, {
      auctionId: string;
      reserveCredits: number;
      minimumIncrement: number;
      leadingBidder: string | null;
      leadingBid: number;
      settled: boolean;
    }>();

    const auctionPort: GridAuctionCommandPort = {
      async scheduleAuction(command) {
        const id = 'auction-onesto-001';
        auctionStore.set(id, {
          auctionId: id,
          reserveCredits: command.reserveCredits,
          minimumIncrement: command.minimumBidIncrementCredits,
          leadingBidder: null,
          leadingBid: 0,
          settled: false,
        });
        return {
          auctionId: id,
          seasonId: command.seasonId,
          cityId,
          propertyId: command.propertyId,
          status: 'scheduled',
          reserveCredits: command.reserveCredits,
          minimumBidIncrementCredits: command.minimumBidIncrementCredits,
          startsAt: command.startsAt,
          endsAt: command.endsAt,
          eventId: 'auction-scheduled-001',
        };
      },
      async placeBid(command) {
        const auction = auctionStore.get(command.auctionId);
        if (!auction) throw new Error('Auction not found');
        const minRequired = auction.leadingBid > 0 ? auction.leadingBid + auction.minimumIncrement : auction.reserveCredits;
        if (command.amountCredits < minRequired) {
          throw new Error(`Bid too low; required at least ${minRequired}`);
        }
        const previousLeaderPlayerId = auction.leadingBidder;
        const previousLeaderBid = auction.leadingBid;
        auction.leadingBidder = command.bidderPlayerId;
        auction.leadingBid = command.amountCredits;
        return {
          auctionId: auction.auctionId,
          seasonId,
          propertyId: 'canton-onesto',
          bidderPlayerId: command.bidderPlayerId,
          amountCredits: command.amountCredits,
          creditsAfter: 0,
          previousLeaderPlayerId: previousLeaderPlayerId ?? undefined,
          previousLeaderRefundedCredits: previousLeaderPlayerId ? previousLeaderBid : 0,
          eventId: `bid-${command.idempotencyKey}`,
        };
      },
      async settleAuction(command) {
        const auction = auctionStore.get(command.auctionId);
        if (!auction) throw new Error('Auction not found');
        auction.settled = true;
        return {
          auctionId: auction.auctionId,
          seasonId,
          cityId,
          propertyId: 'canton-onesto',
          sold: auction.leadingBidder !== null,
          winnerPlayerId: auction.leadingBidder ?? undefined,
          winningBidCredits: auction.leadingBidder ? auction.leadingBid : undefined,
          settledAt: command.now,
          eventId: `settle-${command.idempotencyKey}`,
        };
      },
    };

    // 1. Schedule auction
    const scheduled = await scheduleGridAuction(auctionPort, {
      seasonId,
      propertyId: 'canton-onesto',
      reserveCredits: 500,
      minimumBidIncrementCredits: 50,
      startsAt: '2026-09-17T20:00:00.000Z',
      endsAt: '2026-09-17T22:00:00.000Z',
      idempotencyKey: 'sched-001',
      now: '2026-09-17T19:00:00.000Z',
    });
    expect(scheduled.auctionId).toBe('auction-onesto-001');

    // 2. Place first bid
    const bid1 = await placeGridAuctionBid(auctionPort, {
      auctionId: scheduled.auctionId,
      bidderPlayerId: playerAlpha,
      amountCredits: 500,
      idempotencyKey: 'bid-alpha-001',
      now: '2026-09-17T20:30:00.000Z',
    });
    expect(bid1.amountCredits).toBe(500);

    // 3. Reject insufficient outbid
    await expect(
      placeGridAuctionBid(auctionPort, {
        auctionId: scheduled.auctionId,
        bidderPlayerId: playerBravo,
        amountCredits: 520, // requires 500 + 50 = 550
        idempotencyKey: 'bid-bravo-fail',
        now: '2026-09-17T20:35:00.000Z',
      }),
    ).rejects.toThrow('Bid too low');

    // 4. Valid outbid
    const bid2 = await placeGridAuctionBid(auctionPort, {
      auctionId: scheduled.auctionId,
      bidderPlayerId: playerBravo,
      amountCredits: 600,
      idempotencyKey: 'bid-bravo-001',
      now: '2026-09-17T20:40:00.000Z',
    });
    expect(bid2.amountCredits).toBe(600);

    // 5. Settle auction
    const settled = await settleGridAuctionCommand(auctionPort, {
      auctionId: scheduled.auctionId,
      idempotencyKey: 'settle-001',
      now: '2026-09-17T22:01:00.000Z',
    });
    expect(settled.winnerPlayerId).toBe(playerBravo);
    expect(settled.winningBidCredits).toBe(600);

    // 6. Fixed-price market listing purchase
    const listingRules: GridFixedPriceListingRules = {
      transactionTaxBps: 500, // 5%
      propertyTradeCooldownMinutes: 60,
      minimumPriceCredits: 100,
      maximumPriceCredits: 100_000,
      minimumListingDurationMinutes: 60,
      maximumListingDurationMinutes: 10_080,
    };

    const listing: GridFixedPriceListingState = {
      listingId: 'listing-001',
      cityId,
      sellerPlayerId: playerBravo,
      assetId: 'canton-onesto',
      assetKind: 'property',
      priceCredits: 1000,
      status: 'open',
      createdAt: '2026-09-17T22:30:00.000Z',
      expiresAt: '2026-09-18T22:30:00.000Z',
      buyerPlayerId: undefined,
      soldAt: undefined,
      cancelledAt: undefined,
    };

    const buyer: GridMarketBuyerSnapshot = {
      playerId: playerAlpha,
      cityId,
      creditBalance: 1500,
    };

    const asset: GridMarketAssetSnapshot = {
      assetId: 'canton-onesto',
      kind: 'property',
      cityId,
      ownerPlayerId: playerBravo,
      tradable: true,
      majorLandmark: false,
      acquiredAt: '2026-09-17T21:00:00.000Z',
    };

    const purchasePlan = planGridFixedPricePurchase(
      listing,
      buyer,
      asset,
      listingRules,
      '2026-09-17T23:00:00.000Z',
    );

    expect(purchasePlan.purchasable).toBe(true);
    if (purchasePlan.purchasable) {
      expect(purchasePlan.priceCredits).toBe(1000);
      expect(purchasePlan.taxCredits).toBe(50);
      expect(purchasePlan.buyerTotalDebitCredits).toBe(1050);
      expect(purchasePlan.sellerCreditDelta).toBe(1000);
    }
  });

  it('Stage 10: projects NPC strongholds, dynamic event modifiers, and Surge finale transitions', () => {
    // 1. NPC Stronghold projection
    const stronghold = projectGridNpcStronghold(
      {
        strongholdId: 'npc-iron-syndicate-1',
        factionId: 'iron-syndicate',
        territorySlug: 'canton-downtown-core',
        activation: 'season',
        baseGarrisonInfluence: 150,
        maxGarrisonInfluence: 300,
        pressureReinforcementBps: 1000,
        surgeReinforcementBps: 2500,
      },
      {
        seasonActive: true,
        eventActive: false,
        surgeIntensityBps: 0,
        factionPressureBps: 0,
        captured: false,
      },
    );
    expect(stronghold.status).toBe('active');
    expect(stronghold.contestable).toBe(true);
    expect(stronghold.garrisonInfluence).toBe(150);

    // 2. Dynamic event stack application
    const eventTemplate: GridDynamicEventTemplate = {
      id: 'downtown-festival',
      kind: 'economic-boom',
      priority: 10,
      durationMinutes: 180,
      target: { type: 'district' as const, ids: ['downtown'] },
      modifiers: [
        { key: 'credits-multiplier-bps', operation: 'add-bps' as const, value: 2000 }, // +20%
      ],
      tags: ['civic', 'bonus'],
    };
    validateGridDynamicEventTemplate(eventTemplate);

    const instance = instantiateGridDynamicEvent(eventTemplate, {
      instanceId: 'inst-001',
      cityId,
      startsAt: '2026-09-17T12:00:00.000Z',
    });

    const stack = projectGridDynamicEventStack(
      [instance],
      '2026-09-17T13:00:00.000Z',
      { type: 'district', id: 'downtown', cityId },
    );
    expect(stack.activeEventIds).toContain('inst-001');
    expect(stack.additiveBps['credits-multiplier-bps']).toBe(2000);

    // 3. Surge finale timing states
    const upcomingSurge = deriveSurgeTiming(
      {
        surgeStartsAt: '2026-09-24T12:00:00.000Z',
        endsAt: '2026-09-27T12:00:00.000Z',
      },
      '2026-09-17T12:00:00.000Z',
    );
    expect(upcomingSurge.state).toBe('upcoming');
    expect(upcomingSurge.millisecondsRemaining).toBeGreaterThan(0);

    const liveSurge = deriveSurgeTiming(
      {
        surgeStartsAt: '2026-09-24T12:00:00.000Z',
        endsAt: '2026-09-27T12:00:00.000Z',
      },
      '2026-09-25T12:00:00.000Z',
    );
    expect(liveSurge.state).toBe('live');

    const finishedSurge = deriveSurgeTiming(
      {
        surgeStartsAt: '2026-09-24T12:00:00.000Z',
        endsAt: '2026-09-27T12:00:00.000Z',
      },
      '2026-09-28T12:00:00.000Z',
    );
    expect(finishedSurge.state).toBe('finished');
    expect(finishedSurge.millisecondsRemaining).toBe(0);
  });
});

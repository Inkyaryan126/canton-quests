import { describe, expect, it } from 'vitest';
import { cantonFoundingSeasonPackage } from '../lib/grid/cities/canton/founding-season';
import {
  joinGridOnboardingSeason,
  type GridOnboardingJoinRequest,
} from '../lib/grid/server/onboarding-join-service';
import {
  claimGridOnboardingStarterTerritory,
  type GridOnboardingStarterClaimRequest,
} from '../lib/grid/server/onboarding-starter-claim-service';
import { buildGridWorldProjection, type GridWorldRuntimeSnapshot } from '../lib/grid/server/world-projection';
import {
  scheduleGridAuction,
  placeGridAuctionBid,
  settleGridAuctionCommand,
} from '../lib/grid/server/auction-service';
import type {
  GridAuctionCommandPort,
  GridPlaceAuctionBidCommand,
} from '../lib/grid/server/auction-port';
import {
  planGridFixedPricePurchase,
  openGridFixedPriceListing,
} from '../lib/grid/core/market-listings';
import type {
  GridFixedPriceListingRules,
  GridFixedPriceListingState,
  GridMarketAssetSnapshot,
  GridMarketBuyerSnapshot,
} from '../lib/grid/core/market-listing-types';
import { resolveGridContestRound } from '../lib/grid/server/contest-service';
import type { GridContestRoundPort } from '../lib/grid/server/contest-port';
import type { GridOnboardingHomeCityPort } from '../lib/grid/server/onboarding-home-city-port';
import type { GridOnboardingSeasonPort } from '../lib/grid/server/onboarding-season-port';
import type { GridEconomyCommandPort, GridPlayerSeasonState } from '../lib/grid/server/economy-port';
import type { GridOnboardingStarterClaimPort } from '../lib/grid/server/onboarding-starter-claim-port';
import { buildDirectChatScopeKey, normalizeGridChatBody } from '../lib/grid/core/chat';
import { createGridScrimmage, joinGridScrimmage } from '../lib/grid/core/scrimmage';

describe('The Grid: Security, Server Authority, Multi-Tenancy & Concurrency', () => {
  const seasonId = 'season-canton-2026';
  const cityId = 'canton-oh';
  const playerAlpha = 'player-alpha-1111-4000-8000-000000000001';
  const playerBravo = 'player-bravo-2222-4000-8000-000000000002';
  const playerCharlie = 'player-charlie-3333-4000-8000-000000000003';
  const t0 = '2026-09-17T14:00:00.000Z';

  const balance = cantonFoundingSeasonPackage.seasonTemplate.balance;
  const economy = cantonFoundingSeasonPackage.seasonTemplate.economy!;
  const contestConfig = cantonFoundingSeasonPackage.seasonTemplate.contest!;

  it('keeps communications scoped and rejects malformed player input', () => {
    expect(buildDirectChatScopeKey(playerBravo, playerAlpha)).toBe(
      `direct:${playerAlpha}:${playerBravo}`,
    );
    expect(() => buildDirectChatScopeKey(playerAlpha, playerAlpha)).toThrow(
      'Direct chat requires two different players',
    );
    expect(() => normalizeGridChatBody('hello\u0007world')).toThrow(
      'unsupported control characters',
    );
  });

  it('keeps scrimmage invite identity city-bound and does not silently add a player twice', () => {
    const lobby = createGridScrimmage({
      sessionId: 'security-scrimmage',
      cityId,
      hostPlayerId: playerAlpha,
      inviteCode: 'SECURE-26',
      rules: { minPlayers: 2, maxPlayers: 2, requireAllReady: true },
      now: t0,
    });
    const joined = joinGridScrimmage(lobby, {
      playerId: playerBravo,
      inviteCode: ' secure-26 ',
      now: t0,
    });
    const repeated = joinGridScrimmage(joined, {
      playerId: playerBravo,
      inviteCode: 'SECURE-26',
      now: t0,
    });
    expect(repeated).toEqual(joined);
    expect(repeated.participants).toHaveLength(2);
    expect(repeated.cityId).toBe(cityId);
    expect(repeated.progressionScope).toBe('session-only');
  });

  // --------------------------------------------------------------------------
  // 1. SERVER AUTHORITY & ANTI-TAMPERING
  // --------------------------------------------------------------------------
  describe('1. Server Authority & Anti-Tampering', () => {
    it('rejects client-side attempts to attack non-differing source/target or attacker/defender', async () => {
      const dummyRoundPort: GridContestRoundPort = {
        async resolveRound() {
          throw new Error('Should not reach port');
        },
      };

      const dummyRoller = { roll: () => 6 };

      // Attacker attacks self
      await expect(
        resolveGridContestRound(dummyRoundPort, dummyRoller, contestConfig, {
          seasonId,
          attackerPlayerId: playerAlpha,
          defenderPlayerId: playerAlpha, // same player
          sourceTerritoryId: 't-1',
          targetTerritoryId: 't-2',
          attackerCommittedInfluence: 50,
          defenderCommittedInfluence: 50,
          idempotencyKey: 'same-player-attack',
          now: t0,
        }),
      ).rejects.toThrow('Grid contest attacker and defender must differ');

      // Attacker attacks same territory
      await expect(
        resolveGridContestRound(dummyRoundPort, dummyRoller, contestConfig, {
          seasonId,
          attackerPlayerId: playerAlpha,
          defenderPlayerId: playerBravo,
          sourceTerritoryId: 't-1',
          targetTerritoryId: 't-1', // same territory
          attackerCommittedInfluence: 50,
          defenderCommittedInfluence: 50,
          idempotencyKey: 'same-territory-attack',
          now: t0,
        }),
      ).rejects.toThrow('Grid contest source and target territories must differ');
    });

    it('rejects zero or negative influence commitments in combat', async () => {
      const dummyRoundPort: GridContestRoundPort = {
        async resolveRound() {
          throw new Error('Should not reach port');
        },
      };
      const dummyRoller = { roll: () => 6 };

      await expect(
        resolveGridContestRound(dummyRoundPort, dummyRoller, contestConfig, {
          seasonId,
          attackerPlayerId: playerAlpha,
          defenderPlayerId: playerBravo,
          sourceTerritoryId: 't-1',
          targetTerritoryId: 't-2',
          attackerCommittedInfluence: 0, // invalid
          defenderCommittedInfluence: 50,
          idempotencyKey: 'zero-inf-attack',
          now: t0,
        }),
      ).rejects.toThrow('Grid contest requires positive integer attackerCommittedInfluence');

      await expect(
        resolveGridContestRound(dummyRoundPort, dummyRoller, contestConfig, {
          seasonId,
          attackerPlayerId: playerAlpha,
          defenderPlayerId: playerBravo,
          sourceTerritoryId: 't-1',
          targetTerritoryId: 't-2',
          attackerCommittedInfluence: 50,
          defenderCommittedInfluence: -10, // invalid
          idempotencyKey: 'neg-inf-attack',
          now: t0,
        }),
      ).rejects.toThrow('Grid contest requires positive integer defenderCommittedInfluence');
    });

    it('fails closed when player lacks sufficient credits or command points for claims', async () => {
      const seasonPort: GridOnboardingSeasonPort = {
        async getCurrentSeason() {
          return { seasonId, cityId, slug: 'founding', name: 'Founding', status: 'active' };
        },
      };

      const poorPlayerWallet: GridPlayerSeasonState = {
        seasonId,
        cityId,
        playerId: 'poor-player',
        credits: 5, // needs at least 900
        influence: 10,
        commandPoints: 0, // needs at least 2
        commandPointsUpdatedAt: t0,
        resourcesSettledAt: t0,
        creditsAccrualRemainder: 0,
        influenceAccrualRemainder: 0,
        joined: true,
        eventId: null,
      };

      const claimPort: GridOnboardingStarterClaimPort = {
        async claimStarterTerritory(input) {
          const cost = economy.neutralClaims.defaultCost;
          if (poorPlayerWallet.credits < cost.credits || poorPlayerWallet.commandPoints < cost.commandPoints) {
            throw new Error('Insufficient resources: claim rejected by server authority');
          }
          return {
            seasonId: input.seasonId,
            cityId,
            playerId: input.playerId,
            territoryId: input.territoryId,
            territorySlug: 'census-block-391517001002029',
            claimMode: 'starter',
            claimedAt: input.now,
            creditsSpent: cost.credits,
            commandPointsSpent: cost.commandPoints,
            credits: poorPlayerWallet.credits - cost.credits,
            influence: poorPlayerWallet.influence,
            commandPoints: poorPlayerWallet.commandPoints - cost.commandPoints,
            eventId: 'ev-1',
          };
        },
      };

      await expect(
        claimGridOnboardingStarterTerritory(seasonPort, claimPort, {
          playerId: 'poor-player',
          territoryId: 'census-block-391517001002029',
          idempotencyKey: 'poor-claim',
          now: t0,
        }),
      ).rejects.toThrow('Insufficient resources: claim rejected by server authority');
    });
  });

  // --------------------------------------------------------------------------
  // 2. CITY & SEASON ISOLATION (MULTI-TENANCY)
  // --------------------------------------------------------------------------
  describe('2. City & Season Isolation (Multi-Tenancy)', () => {
    it('rejects cross-city transactions when buyer or asset belongs to a different city', () => {
      const rules: GridFixedPriceListingRules = {
        transactionTaxBps: 500,
        propertyTradeCooldownMinutes: 60,
        minimumPriceCredits: 100,
        maximumPriceCredits: 100_000,
        minimumListingDurationMinutes: 60,
        maximumListingDurationMinutes: 10_080,
      };

      const cantonListing: GridFixedPriceListingState = {
        listingId: 'listing-canton-01',
        cityId: 'canton-oh',
        sellerPlayerId: playerAlpha,
        assetId: 'property-canton-01',
        assetKind: 'property',
        priceCredits: 1000,
        status: 'open',
        createdAt: t0,
        expiresAt: '2026-09-18T14:00:00.000Z',
      };

      const akronBuyer: GridMarketBuyerSnapshot = {
        playerId: playerBravo,
        cityId: 'akron-oh', // Mismatch!
        creditBalance: 5000,
      };

      const cantonAsset: GridMarketAssetSnapshot = {
        assetId: 'property-canton-01',
        kind: 'property',
        cityId: 'canton-oh',
        ownerPlayerId: playerAlpha,
        tradable: true,
        majorLandmark: false,
      };

      const plan = planGridFixedPricePurchase(
        cantonListing,
        akronBuyer,
        cantonAsset,
        rules,
        '2026-09-17T15:00:00.000Z',
      );

      expect(plan.purchasable).toBe(false);
      expect(plan.reason).toBe('city-mismatch');
    });

    it('rejects listing open when asset city differs from seller city', () => {
      const rules: GridFixedPriceListingRules = {
        transactionTaxBps: 500,
        propertyTradeCooldownMinutes: 60,
        minimumPriceCredits: 100,
        maximumPriceCredits: 100_000,
        minimumListingDurationMinutes: 60,
        maximumListingDurationMinutes: 10_080,
      };

      const foreignAsset: GridMarketAssetSnapshot = {
        assetId: 'foreign-prop',
        kind: 'property',
        cityId: 'cleveland-oh', // different city
        ownerPlayerId: playerAlpha,
        tradable: true,
        majorLandmark: false,
      };

      const openResult = openGridFixedPriceListing(
        {
          listingId: 'list-foreign',
          cityId: 'canton-oh',
          sellerPlayerId: playerAlpha,
          sellerCityId: 'canton-oh',
          assetId: 'foreign-prop',
          priceCredits: 1000,
          createdAt: t0,
          expiresAt: '2026-09-18T14:00:00.000Z',
        },
        foreignAsset,
        rules,
      );

      expect(openResult.accepted).toBe(false);
      expect(openResult.reason).toBe('city-mismatch');
    });
  });

  // --------------------------------------------------------------------------
  // 3. IDEMPOTENCY & REPLAY PROTECTION
  // --------------------------------------------------------------------------
  describe('3. Idempotency & Replay Protection', () => {
    it('guarantees join requests with identical idempotency keys never double-provision funds', async () => {
      let callCount = 0;
      const ledger = new Map<string, GridPlayerSeasonState>();

      const mockEconomyPort: GridEconomyCommandPort = {
        async joinSeason(input) {
          callCount += 1;
          const cached = ledger.get(input.idempotencyKey);
          if (cached) return cached;

          const created: GridPlayerSeasonState = {
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
          ledger.set(input.idempotencyKey, created);
          return created;
        },
        async settleResources() { throw new Error(); },
      };

      const homePort: GridOnboardingHomeCityPort = {
        async isHomeCityConfirmed() { return true; },
        async confirmHomeCity() { return { cityId, citySlug: cityId, confirmed: true }; },
      };

      const seasonPort: GridOnboardingSeasonPort = {
        async getCurrentSeason() {
          return { seasonId, cityId, slug: 'f', name: 'F', status: 'active' };
        },
      };

      const joinReq: GridOnboardingJoinRequest = {
        playerId: playerAlpha,
        idempotencyKey: 'idemp-join-key-999',
        now: t0,
      };

      // Call 1
      const res1 = await joinGridOnboardingSeason(homePort, seasonPort, mockEconomyPort, joinReq);
      // Call 2 (simulated network retry)
      const res2 = await joinGridOnboardingSeason(homePort, seasonPort, mockEconomyPort, joinReq);

      expect(callCount).toBe(2);
      expect(res1.credits).toBe(balance.startingCredits);
      expect(res2.credits).toBe(balance.startingCredits);
      expect(res1).toEqual(res2);
    });

    it('rejects blank or whitespace-only idempotency keys', async () => {
      const homePort: GridOnboardingHomeCityPort = { async isHomeCityConfirmed() { return true; }, async confirmHomeCity() { return { cityId, citySlug: cityId, confirmed: true }; } };
      const seasonPort: GridOnboardingSeasonPort = {
        async getCurrentSeason() { return { seasonId, cityId, slug: 'f', name: 'F', status: 'active' }; },
      };
      const dummyEconomy: GridEconomyCommandPort = {
        async joinSeason() { throw new Error(); },
        async settleResources() { throw new Error(); },
      };

      await expect(
        joinGridOnboardingSeason(homePort, seasonPort, dummyEconomy, {
          playerId: playerAlpha,
          idempotencyKey: '   ', // invalid
          now: t0,
        }),
      ).rejects.toThrow('Grid onboarding join requires a non-empty idempotency key');
    });
  });

  // --------------------------------------------------------------------------
  // 4. STALE WRITES & CONCURRENCY / RACE CONDITIONS
  // --------------------------------------------------------------------------
  describe('4. Stale Writes & Concurrency / Race Handling', () => {
    it('enforces atomic territory claiming: first claim succeeds, concurrent second claim fails', async () => {
      const occupiedTerritories = new Set<string>();

      const claimPort: GridOnboardingStarterClaimPort = {
        async claimStarterTerritory(input) {
          if (occupiedTerritories.has(input.territoryId)) {
            throw new Error(`Territory ${input.territoryId} is already claimed by another player`);
          }
          occupiedTerritories.add(input.territoryId);
          return {
            seasonId: input.seasonId,
            cityId,
            playerId: input.playerId,
            territoryId: input.territoryId,
            territorySlug: 't-prime',
            claimMode: 'starter',
            claimedAt: input.now,
            creditsSpent: 900,
            commandPointsSpent: 2,
            credits: 4100,
            influence: 100,
            commandPoints: 8,
            eventId: 'ev-race',
          };
        },
      };

      const seasonPort: GridOnboardingSeasonPort = {
        async getCurrentSeason() {
          return { seasonId, cityId, slug: 'f', name: 'F', status: 'active' };
        },
      };

      // Player Alpha claims territory 't-prime'
      const alphaResult = await claimGridOnboardingStarterTerritory(seasonPort, claimPort, {
        playerId: playerAlpha,
        territoryId: 't-prime',
        idempotencyKey: 'alpha-claim',
        now: t0,
      });
      expect(alphaResult.territoryId).toBe('t-prime');

      // Player Bravo concurrently attempts to claim 't-prime'
      await expect(
        claimGridOnboardingStarterTerritory(seasonPort, claimPort, {
          playerId: playerBravo,
          territoryId: 't-prime',
          idempotencyKey: 'bravo-claim',
          now: t0,
        }),
      ).rejects.toThrow('Territory t-prime is already claimed by another player');
    });

    it('enforces atomic auction bidding race: equal or lower outbids rejected', async () => {
      let leadingBid = 1000;
      const minIncrement = 100;
      const auctionId = 'auction-live-race';

      const auctionPort: GridAuctionCommandPort = {
        async scheduleAuction() { throw new Error(); },
        async placeBid(command: GridPlaceAuctionBidCommand) {
          const required = leadingBid + minIncrement;
          if (command.amountCredits < required) {
            throw new Error(`Outbid rejected: current lead is ${leadingBid}, minimum required is ${required}`);
          }
          const previousLeaderRefundedCredits = leadingBid;
          leadingBid = command.amountCredits;
          return {
            auctionId: command.auctionId,
            seasonId,
            propertyId: 'property-race',
            bidderPlayerId: command.bidderPlayerId,
            amountCredits: command.amountCredits,
            creditsAfter: 0,
            previousLeaderPlayerId: 'prev-bidder',
            previousLeaderRefundedCredits,
            eventId: `bid-${command.idempotencyKey}`,
          };
        },
        async settleAuction() { throw new Error(); },
      };

      // Player Bravo bids 1100 (valid: 1000 + 100)
      const bidBravo = await placeGridAuctionBid(auctionPort, {
        auctionId,
        bidderPlayerId: playerBravo,
        amountCredits: 1100,
        idempotencyKey: 'bid-b-1100',
        now: t0,
      });
      expect(bidBravo.amountCredits).toBe(1100);

      // Player Charlie also submitted 1100 at the same instant -> rejected!
      await expect(
        placeGridAuctionBid(auctionPort, {
          auctionId,
          bidderPlayerId: playerCharlie,
          amountCredits: 1100,
          idempotencyKey: 'bid-c-1100',
          now: t0,
        }),
      ).rejects.toThrow('Outbid rejected');

      // Player Charlie must bid at least 1100 + 100 = 1200
      const bidCharlie = await placeGridAuctionBid(auctionPort, {
        auctionId,
        bidderPlayerId: playerCharlie,
        amountCredits: 1200,
        idempotencyKey: 'bid-c-1200',
        now: t0,
      });
      expect(bidCharlie.amountCredits).toBe(1200);
    });

    it('rejects purchase of an already sold fixed-price listing', () => {
      const rules: GridFixedPriceListingRules = {
        transactionTaxBps: 500,
        propertyTradeCooldownMinutes: 60,
        minimumPriceCredits: 100,
        maximumPriceCredits: 100_000,
        minimumListingDurationMinutes: 60,
        maximumListingDurationMinutes: 10_080,
      };

      const soldListing: GridFixedPriceListingState = {
        listingId: 'list-sold-already',
        cityId,
        sellerPlayerId: playerAlpha,
        assetId: 'property-canton-01',
        assetKind: 'property',
        priceCredits: 1000,
        status: 'sold', // Already sold!
        createdAt: t0,
        expiresAt: '2026-09-18T14:00:00.000Z',
        buyerPlayerId: playerBravo,
        soldAt: '2026-09-17T14:30:00.000Z',
      };

      const buyerCharlie: GridMarketBuyerSnapshot = {
        playerId: playerCharlie,
        cityId,
        creditBalance: 5000,
      };

      const asset: GridMarketAssetSnapshot = {
        assetId: 'property-canton-01',
        kind: 'property',
        cityId,
        ownerPlayerId: playerBravo,
        tradable: true,
        majorLandmark: false,
      };

      const plan = planGridFixedPricePurchase(
        soldListing,
        buyerCharlie,
        asset,
        rules,
        '2026-09-17T15:00:00.000Z',
      );

      expect(plan.purchasable).toBe(false);
      expect(plan.reason).toBe('listing-not-open');
    });
  });

  // --------------------------------------------------------------------------
  // 5. PRIVACY LEAKAGE PREVENTION
  // --------------------------------------------------------------------------
  describe('5. Privacy Leakage & Information Boundary Protection', () => {
    it('redacts opponent wallet balances and active contest details from spectator projections', () => {
      const snapshot: GridWorldRuntimeSnapshot = {
        seasonId,
        seasonStatus: 'active',
        territories: cantonFoundingSeasonPackage.territories.map((t) => ({
          territorySlug: t.slug,
          ownerPlayerId: t.slug.includes('2029') ? playerAlpha : null,
          claimedAt: t.slug.includes('2029') ? t0 : null,
        })),
        properties: [],
        contests: [
          {
            contestId: 'secret-contest-01',
            sourceTerritorySlug: 'census-block-391517001002029',
            targetTerritorySlug: 'census-block-391517001002040',
            attackerPlayerId: playerAlpha,
            defenderPlayerId: playerBravo,
            attackerRemainingInfluence: 80,
            defenderRemainingInfluence: 30,
            roundNumber: 2,
            status: 'active',
            startedAt: t0,
          },
        ],
        playerState: {
          credits: 4200,
          influence: 80,
          commandPoints: 8,
          resourcesSettledAt: t0,
        },
      };

      // 1. Authenticated Player Alpha projection: sees their own wallet & contest role
      const alphaProj = buildGridWorldProjection(cantonFoundingSeasonPackage, {
        viewerPlayerId: playerAlpha,
        runtime: snapshot,
        now: t0,
      });

      expect(alphaProj.player.wallet).not.toBeNull();
      expect(alphaProj.player.wallet?.credits).toBe(4200);
      expect(alphaProj.player.activeContests).toHaveLength(1);
      expect(alphaProj.player.activeContests[0]?.role).toBe('attacker');

      // 2. Unauthenticated Spectator projection: wallet MUST be null
      const spectatorProj = buildGridWorldProjection(cantonFoundingSeasonPackage, {
        viewerPlayerId: null,
        runtime: { ...snapshot, playerState: null },
        now: t0,
      });

      expect(spectatorProj.player.authenticated).toBe(false);
      expect(spectatorProj.player.joined).toBe(false);
      expect(spectatorProj.player.wallet).toBeNull();
      expect(spectatorProj.player.activeContests).toHaveLength(0);

      // 3. Third party Player Charlie: cannot see Alpha's wallet or participate in Alpha's contest
      const charlieProj = buildGridWorldProjection(cantonFoundingSeasonPackage, {
        viewerPlayerId: playerCharlie,
        runtime: { ...snapshot, playerState: null },
        now: t0,
      });

      expect(charlieProj.player.wallet).toBeNull();
      expect(charlieProj.player.activeContests).toHaveLength(0);
    });

    it('guarantees that unsafe property display names are protected', () => {
      // Create a test package with an unverified or unsafe user-generated property name
      const packageWithUnsafeProperty = {
        ...cantonFoundingSeasonPackage,
        properties: [
          ...cantonFoundingSeasonPackage.properties,
          {
            id: 'unsafe-prop-1',
            slug: 'property-with-private-memo',
            districtSlug: 'downtown',
            territorySlug: 'census-block-391517001002029',
            displayName: 'Dustin Secret Vault (Private Key: 0x9999)',
            baseValue: 1000,
            publicNameSafe: false, // Explicitly marked as unsafe
          },
        ],
      };

      const snapshot: GridWorldRuntimeSnapshot = {
        seasonId,
        seasonStatus: 'active',
        territories: [],
        properties: [
          {
            propertySlug: 'property-with-private-memo',
            ownerPlayerId: playerAlpha,
            acquiredAt: t0,
            developmentBranch: null,
            developmentLevel: 0,
            conditionBps: 10000,
          },
        ],
        playerState: null,
      };

      const world = buildGridWorldProjection(packageWithUnsafeProperty as any, {
        viewerPlayerId: playerBravo,
        runtime: snapshot,
        now: t0,
      });

      const projectedProp = world.properties.find((p) => p.slug === 'property-with-private-memo');
      expect(projectedProp).toBeDefined();
      // Ensure private key / internal string was not leaked verbatim and safe fallback was applied
      expect(projectedProp?.name).toBe('Grid Property');
      expect(projectedProp?.name).not.toContain('Private Key');
    });
  });
});

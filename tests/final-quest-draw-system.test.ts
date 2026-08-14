import { describe, it, expect, beforeEach } from 'vitest';
import {
  PERMANENT_CANTON_QUESTS_NUMBER,
  PERMANENT_CANTON_QUESTS_BIGINT,
  getTicketNumberWidth,
  assignTicketRanges,
  findPlayerByTicketNumber,
  standardizeEventMetrics,
  calculateFinalQuestNumber,
  executeFinalQuestDraw,
  createFinalQuestReceipt,
  getFrozenEventMetrics,
} from '../lib/final-quest-draw';
import {
  initializeGameEngine,
  resetGameEngineStore,
  awardDrawingEntries,
  exportDrawingLedgerSnapshot,
  lockDrawingLedger,
  cancelDrawingLedger,
  executePrizeDraw,
  publishDrawingResults,
  getPublicDrawingPageData,
  assignTicketsToSnapshot,
  computeFinalQuestNumber,
  followTheTrail,
} from '../lib/game-engine';
import { CanonicalSnapshotPlayer } from '../lib/types';

describe('Canton Quests — The Final Quest Draw System', () => {
  const TEST_EVENT_ID = 'evt-canton-vol-1';

  beforeEach(() => {
    resetGameEngineStore();
    initializeGameEngine();
  });

  // 1. Permanent Canton Quests Number Invariant
  it('1. Permanent Canton Quests Number is fixed to 311420151417215192019', () => {
    expect(PERMANENT_CANTON_QUESTS_NUMBER).toBe('311420151417215192019');
    expect(PERMANENT_CANTON_QUESTS_BIGINT).toBe(311420151417215192019n);

    // Verify mathematical conversion of CANTON QUESTS:
    // C=3, A=1, N=14, T=20, O=15, N=14, Q=17, U=21, E=5, S=19, T=20, S=19
    const letters = 'CANTONQUESTS';
    const computed = letters
      .split('')
      .map((c) => c.charCodeAt(0) - 64)
      .join('');
    expect(computed).toBe('311420151417215192019');
    expect(computed).toBe(PERMANENT_CANTON_QUESTS_NUMBER);
  });

  // 2. Ticket Number Width Calculation
  describe('2. Ticket Number Width Calculation', () => {
    it('calculates width 1 for 1–9 tickets', () => {
      expect(getTicketNumberWidth(1)).toBe(1);
      expect(getTicketNumberWidth(5)).toBe(1);
      expect(getTicketNumberWidth(9)).toBe(1);
    });

    it('calculates width 2 for 10–99 tickets', () => {
      expect(getTicketNumberWidth(10)).toBe(2);
      expect(getTicketNumberWidth(87)).toBe(2);
      expect(getTicketNumberWidth(99)).toBe(2);
    });

    it('calculates width 3 for 100–999 tickets', () => {
      expect(getTicketNumberWidth(100)).toBe(3);
      expect(getTicketNumberWidth(356)).toBe(3);
      expect(getTicketNumberWidth(999)).toBe(3);
    });

    it('calculates width 4+ for 1,000+ tickets', () => {
      expect(getTicketNumberWidth(1000)).toBe(4);
      expect(getTicketNumberWidth(4812)).toBe(4);
      expect(getTicketNumberWidth(10000)).toBe(5);
    });
  });

  // 3. Ticket Assignment
  describe('3. Deterministic Ticket Range Assignment', () => {
    it('assigns contiguous, 1-indexed ticket ranges matching player entry counts', () => {
      const players: CanonicalSnapshotPlayer[] = [
        { publicPlayerLabel: 'Agent #1', publicParticipantId: 'p1', entries: 3 },
        { publicPlayerLabel: 'Agent #2', publicParticipantId: 'p2', entries: 2 },
        { publicPlayerLabel: 'Agent #3', publicParticipantId: 'p3', entries: 5 },
      ];

      const ranges = assignTicketRanges(players);
      expect(ranges).toHaveLength(3);

      expect(ranges[0]).toEqual({
        publicPlayerLabel: 'Agent #1',
        publicParticipantId: 'p1',
        startTicket: 1,
        endTicket: 3,
        ticketCount: 3,
      });

      expect(ranges[1]).toEqual({
        publicPlayerLabel: 'Agent #2',
        publicParticipantId: 'p2',
        startTicket: 4,
        endTicket: 5,
        ticketCount: 2,
      });

      expect(ranges[2]).toEqual({
        publicPlayerLabel: 'Agent #3',
        publicParticipantId: 'p3',
        startTicket: 6,
        endTicket: 10,
        ticketCount: 5,
      });

      // Lookup player by ticket number
      expect(findPlayerByTicketNumber(ranges, 1)?.publicPlayerLabel).toBe('Agent #1');
      expect(findPlayerByTicketNumber(ranges, 3)?.publicPlayerLabel).toBe('Agent #1');
      expect(findPlayerByTicketNumber(ranges, 4)?.publicPlayerLabel).toBe('Agent #2');
      expect(findPlayerByTicketNumber(ranges, 5)?.publicPlayerLabel).toBe('Agent #2');
      expect(findPlayerByTicketNumber(ranges, 6)?.publicPlayerLabel).toBe('Agent #3');
      expect(findPlayerByTicketNumber(ranges, 10)?.publicPlayerLabel).toBe('Agent #3');
      expect(findPlayerByTicketNumber(ranges, 11)).toBeUndefined();
    });
  });

  // 4. Final Quest Number Multiplication
  describe('4. Final Quest Number Multiplication', () => {
    it('multiplies predetermined event totals and the permanent Canton Quests number', () => {
      const metrics = {
        totalPlayers: 481,
        totalValidTickets: 356,
        totalCompletedQuests: 229,
        flagshipQuestCompletions: 68,
      };

      const calc = calculateFinalQuestNumber(metrics);
      const expectedProduct = 481n * 356n * 229n * 68n;
      expect(calc.eventProduct).toBe(expectedProduct);

      const expectedFinalQuest = expectedProduct * 311420151417215192019n;
      expect(calc.finalQuestNumber).toBe(expectedFinalQuest);
      expect(calc.finalQuestNumberString).toBe(expectedFinalQuest.toString());
      expect(calc.productFormula).toContain('311420151417215192019');
    });
  });

  // 5. Sliding-Window Trail Algorithm & Example Verification
  describe('5. Sliding-Window Trail & Example Verification', () => {
    it('verifies the mission example: 356 tickets with 809295648... yields Ticket #92 on second window (092)', () => {
      const players: CanonicalSnapshotPlayer[] = [
        { publicPlayerLabel: 'Agent #Alpha', publicParticipantId: 'pa', entries: 90 }, // Tickets 1..90
        { publicPlayerLabel: 'Agent #Winner', publicParticipantId: 'pw', entries: 10 }, // Tickets 91..100 -> contains 92!
        { publicPlayerLabel: 'Agent #Beta', publicParticipantId: 'pb', entries: 256 },  // Tickets 101..356
      ];

      const customFinalNumber = '8092956481234567890';
      const result = executeFinalQuestDraw({
        totalTickets: 356,
        finalQuestNumber: customFinalNumber,
        snapshotPlayers: players,
        eventMetrics: {
          totalPlayers: 3,
          totalValidEntries: 356,
          totalCompletedQuests: 50,
          totalFinishers: 10,
        },
      });

      expect(result.ticketWidth).toBe(3);
      expect(result.trailSteps.length).toBeGreaterThanOrEqual(2);

      // Window 0: '809' -> 809 > 356 -> invalid
      expect(result.trailSteps[0].windowString).toBe('809');
      expect(result.trailSteps[0].parsedTicketNumber).toBe(809);
      expect(result.trailSteps[0].isValid).toBe(false);

      // Window 1: '092' -> 92 <= 356 -> valid winner!
      expect(result.trailSteps[1].windowString).toBe('092');
      expect(result.trailSteps[1].parsedTicketNumber).toBe(92);
      expect(result.trailSteps[1].isValid).toBe(true);

      expect(result.winningTicket).toBe(92);
      expect(result.winningPublicPlayerLabel).toBe('Agent #Winner');
      expect(result.resolutionMethod).toBe('forward_trail');
      expect(result.isFallback).toBe(false);
    });

    it('handles leading zeros properly (e.g. 05 = 5 for width 2)', () => {
      const players: CanonicalSnapshotPlayer[] = [
        { publicPlayerLabel: 'Agent #5', entries: 10 }, // Tickets 1..10
      ];

      const customFinalNumber = '99051234';
      const result = executeFinalQuestDraw({
        totalTickets: 50, // width 2
        finalQuestNumber: customFinalNumber,
        snapshotPlayers: players,
        eventMetrics: {
          totalPlayers: 1,
          totalValidEntries: 50,
          totalCompletedQuests: 10,
          totalFinishers: 5,
        },
      });

      expect(result.ticketWidth).toBe(2);
      // Window 0: '99' > 50 -> invalid
      expect(result.trailSteps[0].windowString).toBe('99');
      expect(result.trailSteps[0].isValid).toBe(false);

      // Window 1: '90' > 50 -> invalid
      expect(result.trailSteps[1].windowString).toBe('90');
      expect(result.trailSteps[1].isValid).toBe(false);

      // Window 2: '05' -> 5 <= 50 -> valid!
      expect(result.trailSteps[2].windowString).toBe('05');
      expect(result.trailSteps[2].parsedTicketNumber).toBe(5);
      expect(result.trailSteps[2].isValid).toBe(true);
      expect(result.winningTicket).toBe(5);
    });

    it('rejects 000 window as invalid (zero)', () => {
      const players: CanonicalSnapshotPlayer[] = [
        { publicPlayerLabel: 'Agent #1', entries: 500 },
      ];

      const customFinalNumber = '0000071234';
      const result = executeFinalQuestDraw({
        totalTickets: 500, // width 3
        finalQuestNumber: customFinalNumber,
        snapshotPlayers: players,
        eventMetrics: {
          totalPlayers: 1,
          totalValidEntries: 500,
          totalCompletedQuests: 10,
          totalFinishers: 5,
        },
      });

      // Window 0: '000' -> 0 -> invalid zero
      expect(result.trailSteps[0].windowString).toBe('000');
      expect(result.trailSteps[0].parsedTicketNumber).toBe(0);
      expect(result.trailSteps[0].isValid).toBe(false);

      // Window 1: '000' -> 0 -> invalid zero
      expect(result.trailSteps[1].windowString).toBe('000');
      expect(result.trailSteps[1].isValid).toBe(false);

      // Window 2: '000' -> 0 -> invalid zero
      expect(result.trailSteps[2].windowString).toBe('000');
      expect(result.trailSteps[2].isValid).toBe(false);

      // Window 3: '007' -> 7 <= 500 -> valid!
      expect(result.trailSteps[3].windowString).toBe('007');
      expect(result.trailSteps[3].parsedTicketNumber).toBe(7);
      expect(result.trailSteps[3].isValid).toBe(true);
      expect(result.winningTicket).toBe(7);
    });

    it('first-valid-window stops immediately upon finding the first valid ticket with 1-digit stepping', () => {
      const players: CanonicalSnapshotPlayer[] = [
        { publicPlayerLabel: 'Agent #1', entries: 100 },
      ];

      // Window 0: '999' (>100), Window 1: '990' (>100), Window 2: '904' (>100), Window 3: '045' (<=100) -> Stops!
      const customFinalNumber = '9990456789';
      const result = executeFinalQuestDraw({
        totalTickets: 100, // width 3
        finalQuestNumber: customFinalNumber,
        snapshotPlayers: players,
        eventMetrics: {
          totalPlayers: 1,
          totalValidEntries: 100,
          totalCompletedQuests: 10,
          totalFinishers: 5,
        },
      });

      expect(result.winningTicket).toBe(45);
      expect(result.trailSteps).toHaveLength(4);
      expect(result.trailSteps[0].windowString).toBe('999');
      expect(result.trailSteps[1].windowString).toBe('990');
      expect(result.trailSteps[2].windowString).toBe('904');
      expect(result.trailSteps[3].windowString).toBe('045');
      expect(result.trailSteps[3].isValid).toBe(true);
    });
  });

  // 6. Fallback Behavior
  describe('6. Fallback Behavior', () => {
    it('executes reverse scan fallback when forward scan finds no valid ticket', () => {
      const players: CanonicalSnapshotPlayer[] = [
        { publicPlayerLabel: 'Agent #Solo', entries: 15 }, // 15 tickets -> width 2
      ];

      // Forward: '989931' -> width 2: '98', '89', '99', '93', '31' (all > 15)
      // Reversed: '139989' -> window 0: '13' (<= 15) -> Valid ticket #13!
      const customFinalNumber = '989931';
      const result = executeFinalQuestDraw({
        totalTickets: 15,
        finalQuestNumber: customFinalNumber,
        snapshotPlayers: players,
        eventMetrics: {
          totalPlayers: 1,
          totalValidEntries: 15,
          totalCompletedQuests: 5,
          totalFinishers: 2,
        },
      });

      expect(result.resolutionMethod).toBe('reverse_trail');
      expect(result.isFallback).toBe(true);
      expect(result.winningTicket).toBe(13);
      expect(result.trailSteps.some((s) => s.reason.includes('Reverse Fallback'))).toBe(true);
    });

    it('executes deterministic modulo fallback when both forward and reverse scans find no valid ticket', () => {
      const players: CanonicalSnapshotPlayer[] = [
        { publicPlayerLabel: 'Agent #1', entries: 10 },
      ];

      // Total tickets = 10 (width 2). All digits 9: '999999'
      // Forward windows of width 2: '99', '99', '99', '99', '99' (all 99 > 10)
      // Reverse windows: '99', '99', '99', '99', '99' (all 99 > 10)
      // Both fail -> Deterministic Modulo Fallback triggers!
      const customFinalNumber = '999999';
      const result = executeFinalQuestDraw({
        totalTickets: 10,
        finalQuestNumber: customFinalNumber,
        snapshotPlayers: players,
        eventMetrics: {
          totalPlayers: 1,
          totalValidEntries: 10,
          totalCompletedQuests: 1,
          totalFinishers: 1,
        },
      });

      expect(result.resolutionMethod).toBe('deterministic_modulo_fallback');
      expect(result.isFallback).toBe(true);

      const expectedModuloTicket = Number(999999n % 10n) + 1; // (999999 % 10) + 1 = 9 + 1 = 10
      expect(result.winningTicket).toBe(expectedModuloTicket);
      expect(result.winningTicket).toBeGreaterThanOrEqual(1);
      expect(result.winningTicket).toBeLessThanOrEqual(10);
    });

    it('deterministic modulo fallback is 100% reproducible and requires zero admin choice', () => {
      const players: CanonicalSnapshotPlayer[] = [
        { publicPlayerLabel: 'Agent #Alpha', entries: 3 },
        { publicPlayerLabel: 'Agent #Beta', entries: 4 },
      ];

      const finalNum = '999999999999999999';
      const res1 = executeFinalQuestDraw({
        totalTickets: 7,
        finalQuestNumber: finalNum,
        snapshotPlayers: players,
        eventMetrics: { totalPlayers: 2, totalValidEntries: 7, totalCompletedQuests: 5, totalFinishers: 2 },
      });

      const res2 = executeFinalQuestDraw({
        totalTickets: 7,
        finalQuestNumber: finalNum,
        snapshotPlayers: players,
        eventMetrics: { totalPlayers: 2, totalValidEntries: 7, totalCompletedQuests: 5, totalFinishers: 2 },
      });

      expect(res1.winningTicket).toBe(res2.winningTicket);
      expect(res1.winningPublicPlayerLabel).toBe(res2.winningPublicPlayerLabel);
      expect(res1.resolutionMethod).toBe('deterministic_modulo_fallback');
    });
  });

  // 7. Full Game Engine & Ledger Integration
  describe('7. Game Engine & Ledger Integration', () => {
    it('executes Final Quest draw on locked ledger and records complete audit receipt', async () => {
      awardDrawingEntries({
        eventId: TEST_EVENT_ID,
        playerId: 'plr-dev-001',
        entriesCount: 3,
        sourceType: 'quest_completion',
        reason: 'Centennial Beacon',
      });

      awardDrawingEntries({
        eventId: TEST_EVENT_ID,
        playerId: 'plr-dev-002',
        entriesCount: 4,
        sourceType: 'quest_completion',
        reason: 'McKinley Cipher',
      });

      const lock = lockDrawingLedger(TEST_EVENT_ID);
      expect(lock.isLocked).toBe(true);
      expect(lock.snapshotHash).toBeTruthy();

      const drawRecord = await executePrizeDraw({
        eventId: TEST_EVENT_ID,
        prizeId: 'prz-final-quest-1',
        prizeTitle: 'Grand Adventure Pass',
        drawMethod: 'final_quest',
      });

      expect(drawRecord.drawMethod).toBe('final_quest');
      expect(drawRecord.winningPublicPlayerLabel).toBeTruthy();
      expect(drawRecord.selectedWeightedEntryIndex).toBeGreaterThanOrEqual(0);
      expect(drawRecord.selectedWeightedEntryIndex).toBeLessThan(7);

      // Audit metadata contains full receipt
      expect(drawRecord.auditMetadata.isSystemVerified).toBe(true);
      expect(drawRecord.auditMetadata.finalQuestReceipt).toBeDefined();

      const receipt = drawRecord.auditMetadata.finalQuestReceipt;
      expect(receipt.totalTickets).toBe(7);
      expect(receipt.permanentNumber).toBe('311420151417215192019');
      expect(receipt.finalQuestNumber).toBeTruthy();
      expect(receipt.winningTicket).toBeGreaterThanOrEqual(1);
      expect(receipt.winningTicket).toBeLessThanOrEqual(7);
      expect(receipt.trailSteps.length).toBeGreaterThan(0);

      // Publish results
      publishDrawingResults(TEST_EVENT_ID);

      const publicData = getPublicDrawingPageData(TEST_EVENT_ID);
      expect(publicData.ledgerLockStatus).toBe('published');
      expect(publicData.publishedPrizes).toHaveLength(1);
      expect(publicData.publishedPrizes[0].drawMethod).toBe('final_quest');
      expect(publicData.publishedPrizes[0].finalQuestReceipt).toBeDefined();
      expect(publicData.ticketRanges).toBeDefined();
      expect(publicData.ticketRanges).toHaveLength(2);
    });

    it('rejects draw execution when ledger is cancelled', async () => {
      awardDrawingEntries({
        eventId: TEST_EVENT_ID,
        playerId: 'plr-dev-001',
        entriesCount: 1,
        sourceType: 'quest_completion',
        reason: 'Test entry for cancellation',
      });

      lockDrawingLedger(TEST_EVENT_ID);
      cancelDrawingLedger(TEST_EVENT_ID, 'Test cancellation');

      await expect(
        executePrizeDraw({
          eventId: TEST_EVENT_ID,
          prizeId: 'prz-cancel-test',
          drawMethod: 'final_quest',
        })
      ).rejects.toThrow(/cancelled/i);
    });

    it('enforces single primary prize per player across multiple draws', async () => {
      awardDrawingEntries({
        eventId: TEST_EVENT_ID,
        playerId: 'plr-dev-001',
        entriesCount: 2,
        sourceType: 'quest_completion',
        reason: 'Primary prize test 1',
      });
      awardDrawingEntries({
        eventId: TEST_EVENT_ID,
        playerId: 'plr-dev-002',
        entriesCount: 2,
        sourceType: 'quest_completion',
        reason: 'Primary prize test 2',
      });

      lockDrawingLedger(TEST_EVENT_ID);

      const draw1 = await executePrizeDraw({
        eventId: TEST_EVENT_ID,
        prizeId: 'prz-primary-1',
        prizeTitle: 'Primary Prize 1',
        drawMethod: 'final_quest',
      });

      const draw2 = await executePrizeDraw({
        eventId: TEST_EVENT_ID,
        prizeId: 'prz-primary-2',
        prizeTitle: 'Primary Prize 2',
        drawMethod: 'final_quest',
      });

      expect(draw1.winningPlayerId).not.toBe(draw2.winningPlayerId);
      expect(draw1.winningPublicPlayerLabel).not.toBe(draw2.winningPublicPlayerLabel);
    });

    it('prevents adding new drawing entries when entry ledger is locked', () => {
      awardDrawingEntries({
        eventId: TEST_EVENT_ID,
        playerId: 'plr-dev-001',
        entriesCount: 2,
        sourceType: 'quest_completion',
        reason: 'Pre-lock entry',
      });

      const lock = lockDrawingLedger(TEST_EVENT_ID);
      expect(lock.isLocked).toBe(true);

      // Attempting to award drawing entries after lock fails/is blocked
      expect(() => {
        awardDrawingEntries({
          eventId: TEST_EVENT_ID,
          playerId: 'plr-dev-002',
          entriesCount: 3,
          sourceType: 'quest_completion',
          reason: 'Post-lock illegal entry',
        });
      }).toThrow(/locked/i);
    });

    it('event numbers freeze upon ledger lock and produce identical Final Quest numbers', () => {
      awardDrawingEntries({
        eventId: TEST_EVENT_ID,
        playerId: 'plr-dev-001',
        entriesCount: 3,
        sourceType: 'quest_completion',
        reason: 'Frozen test 1',
      });

      awardDrawingEntries({
        eventId: TEST_EVENT_ID,
        playerId: 'plr-dev-002',
        entriesCount: 2,
        sourceType: 'quest_completion',
        reason: 'Frozen test 2',
      });

      const lock = lockDrawingLedger(TEST_EVENT_ID);
      const snapshot = lock.canonicalSnapshot!;
      const frozenMetrics1 = getFrozenEventMetrics(TEST_EVENT_ID, snapshot);
      const num1 = computeFinalQuestNumber(frozenMetrics1);

      const frozenMetrics2 = getFrozenEventMetrics(TEST_EVENT_ID, snapshot);
      const num2 = computeFinalQuestNumber(frozenMetrics2);

      expect(frozenMetrics1).toEqual(frozenMetrics2);
      expect(num1.finalQuestNumber).toBe(num2.finalQuestNumber);
      expect(num1.productFormula).toBe(num2.productFormula);
    });

    it('published drawing is immutable and rejects duplicate publication or silent modification', async () => {
      awardDrawingEntries({
        eventId: TEST_EVENT_ID,
        playerId: 'plr-dev-001',
        entriesCount: 3,
        sourceType: 'quest_completion',
        reason: 'Pub test',
      });

      lockDrawingLedger(TEST_EVENT_ID);

      await executePrizeDraw({
        eventId: TEST_EVENT_ID,
        prizeId: 'prz-pub-1',
        prizeTitle: 'Grand Pass',
        drawMethod: 'final_quest',
      });

      publishDrawingResults(TEST_EVENT_ID);

      const publishedData1 = getPublicDrawingPageData(TEST_EVENT_ID);
      expect(publishedData1.ledgerLockStatus).toBe('published');
      expect(publishedData1.publishedPrizes).toHaveLength(1);

      // Duplicate publish call throws error and prevents silent re-publication
      // Re-executing publishDrawingResults rejects republishing from an already published state
      expect(() => {
        publishDrawingResults(TEST_EVENT_ID);
      }).toThrow(/already published|only allowed from a drawn ledger state|status is "published"/i);

      const publishedData2 = getPublicDrawingPageData(TEST_EVENT_ID);
      expect(publishedData2.publishedPrizes).toHaveLength(1);
      expect(publishedData2.publishedPrizes[0].winnerPublicLabel).toBe(
        publishedData1.publishedPrizes![0].winnerPublicLabel
      );
    });

    it('administrator cannot manually choose or influence the winning ticket in Final Quest draw', async () => {
      awardDrawingEntries({
        eventId: TEST_EVENT_ID,
        playerId: 'plr-dev-001',
        entriesCount: 3,
        sourceType: 'quest_completion',
        reason: 'Admin impartiality test 1',
      });
      awardDrawingEntries({
        eventId: TEST_EVENT_ID,
        playerId: 'plr-dev-002',
        entriesCount: 3,
        sourceType: 'quest_completion',
        reason: 'Admin impartiality test 2',
      });

      const lock = lockDrawingLedger(TEST_EVENT_ID);

      // Execute draw twice with same event snapshot
      const snapshot = lock.canonicalSnapshot!;
      const { ticketRanges, totalTickets } = assignTicketsToSnapshot(snapshot);
      const metrics = getFrozenEventMetrics(TEST_EVENT_ID, snapshot);
      const { finalQuestNumber } = computeFinalQuestNumber(metrics);

      const drawA = followTheTrail(finalQuestNumber, totalTickets, ticketRanges);
      const drawB = followTheTrail(finalQuestNumber, totalTickets, ticketRanges);

      // Result is strictly deterministic and identical
      expect(drawA.winningTicket).toBe(drawB.winningTicket);
      expect(drawA.winningRange.publicPlayerLabel).toBe(drawB.winningRange.publicPlayerLabel);
      expect(drawA.resolutionMethod).toBe(drawB.resolutionMethod);
    });

    it('sliding window moves exactly 1 digit to the right across overlapping windows', () => {
      const players: CanonicalSnapshotPlayer[] = [
        { publicPlayerLabel: 'Agent #Target', entries: 350 },
      ];
      const { ticketRanges } = assignTicketsToSnapshot({ eventId: 'test', players });

      // Number: "999888234"
      // Total tickets = 350 (width 3)
      // Step 1: "999" (999 > 350 -> invalid)
      // Step 2: "998" (998 > 350 -> invalid)
      // Step 3: "988" (988 > 350 -> invalid)
      // Step 4: "888" (888 > 350 -> invalid)
      // Step 5: "882" (882 > 350 -> invalid)
      // Step 6: "823" (823 > 350 -> invalid)
      // Step 7: "234" (234 <= 350 -> valid winner Ticket #234!)
      const result = followTheTrail('999888234', 350, ticketRanges);
      expect(result.winningTicket).toBe(234);
      expect(result.trailSteps).toHaveLength(7);
      expect(result.trailSteps[0].windowString).toBe('999');
      expect(result.trailSteps[1].windowString).toBe('998');
      expect(result.trailSteps[2].windowString).toBe('988');
      expect(result.trailSteps[3].windowString).toBe('888');
      expect(result.trailSteps[4].windowString).toBe('882');
      expect(result.trailSteps[5].windowString).toBe('823');
      expect(result.trailSteps[6].windowString).toBe('234');
      expect(result.trailSteps[6].isValid).toBe(true);
    });
  });
});

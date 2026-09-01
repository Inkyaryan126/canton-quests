/**
 * Canton Quests — /how-it-works Final Quest Number & Verification Engine Tests
 *
 * Verifies:
 * 1. Step 01 rewrite explicitly naming all inputs and defining them in plain English
 * 2. Permanent CQ number in full (311420151417215192019)
 * 3. Exact formula: 311420151417215192019 × totalPlayers × totalValidEntries × totalCompletedQuests = FinalQuestNumber
 * 4. Zero usage of totalFinishers
 * 5. Steps 02-07 connection and preservation
 * 6. BigInt arbitrary-precision calculation safety without floating-point math
 * 7. Authoritative metrics extraction (CURRENT — NOT FINAL vs FINAL VERIFIED TOTALS)
 * 8. Historical drawing ledger receipt reproducibility
 */

import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import {
  PERMANENT_CANTON_QUESTS_NUMBER,
  PERMANENT_CANTON_QUESTS_BIGINT,
  calculateVerifiedFinalQuestNumber,
  extractAuthoritativeDrawingMetrics,
} from '../lib/final-quest-verifier';
import { PublicDrawingPageData } from '../lib/types';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

const howItWorksSource = readSource('app/how-it-works/page.tsx');
const verifierPanelSource = readSource('components/drawing/FinalQuestVerifierPanel.tsx');

describe('/how-it-works — Step 01 Final Quest Number Definition', () => {
  it('Step 01 explicitly displays the permanent CQ number in full: 311420151417215192019', () => {
    expect(howItWorksSource).toContain('311420151417215192019');
    expect(PERMANENT_CANTON_QUESTS_NUMBER).toBe('311420151417215192019');
    expect(PERMANENT_CANTON_QUESTS_BIGINT).toBe(311420151417215192019n);
  });

  it('Step 01 explicitly displays the exact 4-variable formula', () => {
    const expectedFormula = '311420151417215192019 × totalPlayers × totalValidEntries × totalCompletedQuests = FinalQuestNumber';
    expect(howItWorksSource).toContain(expectedFormula);
  });

  it('Step 01 explicitly defines all three Mission totals in plain English', () => {
    // totalPlayers
    expect(howItWorksSource).toContain('totalPlayers');
    expect(howItWorksSource).toMatch(/qualified players who registered and participated in (this|the) Mission/i);

    // totalValidEntries
    expect(howItWorksSource).toContain('totalValidEntries');
    expect(howItWorksSource).toMatch(/valid prize drawing tickets earned across all qualified players/i);

    // totalCompletedQuests
    expect(howItWorksSource).toContain('totalCompletedQuests');
    expect(howItWorksSource).toMatch(/verified quest objective completions submitted across the entire Mission/i);
  });

  it('Step 01 does NOT contain or rely on totalFinishers', () => {
    expect(howItWorksSource).not.toContain('totalFinishers');
    expect(verifierPanelSource).not.toContain('totalFinishers');
  });

  it('connects Step 01 to Step 02 cleanly while leaving Steps 02-07 intact', () => {
    expect(howItWorksSource).toContain('Build the Final Quest Number');
    expect(howItWorksSource).toContain('Match the ticket length');
    expect(howItWorksSource).toContain('Read the number in sections');
    expect(howItWorksSource).toContain('Ignore numbers outside the ticket pool');
    expect(howItWorksSource).toContain('Check prize eligibility');
    expect(howItWorksSource).toContain('If needed, scan backward');
    expect(howItWorksSource).toContain('Guaranteed fallback');

    expect(howItWorksSource).toMatch(/Count how many digits are in the total number of valid entries \(totalValidEntries\)/i);
  });

  it('renders Official Final Quest Calculation panel directly above the technical specification accordion', () => {
    expect(howItWorksSource).toContain('<FinalQuestVerifierPanel');
    const step01CardIndex = howItWorksSource.indexOf('{/* STEP 01: BUILD THE FINAL QUEST NUMBER */}');
    const step02GridIndex = howItWorksSource.indexOf('{/* STEPS 02-07 GRID */}');
    const panelIndex = howItWorksSource.indexOf('<FinalQuestVerifierPanel');
    const accordionIndex = howItWorksSource.indexOf('<details className="cq-tech-details">');

    expect(step01CardIndex).toBeGreaterThan(-1);
    expect(step02GridIndex).toBeGreaterThan(step01CardIndex);
    expect(panelIndex).toBeGreaterThan(step02GridIndex);
    expect(accordionIndex).toBeGreaterThan(panelIndex);
  });

  it('verifier panel clearly separates OFFICIAL NUMBERS and CHECK THE MATH YOURSELF sections', () => {
    const panelSource = readSource('components/drawing/FinalQuestVerifierPanel.tsx');
    expect(panelSource).toContain('OFFICIAL NUMBERS — READ ONLY');
    expect(panelSource).toContain('CHECK THE MATH YOURSELF — LOCAL CALCULATOR');
    expect(panelSource).toContain('OFFICIAL FINAL QUEST CALCULATION');

    // Calculator controls
    expect(panelSource).toContain('calc-input-cq');
    expect(panelSource).toContain('calc-input-players');
    expect(panelSource).toContain('calc-input-entries');
    expect(panelSource).toContain('calc-input-quests');
    expect(panelSource).toContain('CALCULATE');
    expect(panelSource).toContain('RESET TO OFFICIAL NUMBERS');
  });
});

describe('Final Quest Number Verifier Engine — BigInt Arbitrary-Precision Math', () => {
  it('multiplies using BigInt and never standard JS floating-point math', () => {
    const totalPlayers = 142;
    const totalValidEntries = 356;
    const totalCompletedQuests = 229;

    const result = calculateVerifiedFinalQuestNumber(totalPlayers, totalValidEntries, totalCompletedQuests);

    const expectedProduct = 311420151417215192019n * 142n * 356n * 229n;
    expect(result.rawBigInt).toBe(expectedProduct);
    expect(result.finalQuestNumber).toBe(expectedProduct.toString());
    expect(result.substitutedEquation).toBe(
      `311420151417215192019 × 142 × 356 × 229 = ${expectedProduct.toString()}`
    );
  });

  it('handles zero participation gracefully without errors', () => {
    const result = calculateVerifiedFinalQuestNumber(0, 0, 0);
    expect(result.rawBigInt).toBe(0n);
    expect(result.finalQuestNumber).toBe('0');
    expect(result.substitutedEquation).toBe('311420151417215192019 × 0 × 0 × 0 = 0');
  });

  it('maintains precision for very large participant counts without numerical truncation', () => {
    const totalPlayers = 10000;
    const totalValidEntries = 50000;
    const totalCompletedQuests = 80000;

    const result = calculateVerifiedFinalQuestNumber(totalPlayers, totalValidEntries, totalCompletedQuests);

    // Product of 3 counts = 40,000,000,000,000
    // Multiplied by 311420151417215192019
    const expectedProduct = 311420151417215192019n * 10000n * 50000n * 80000n;
    expect(result.rawBigInt).toBe(expectedProduct);
    expect(result.finalQuestNumber).toBe(expectedProduct.toString());
    // Ends with 13 zeroes exactly
    expect(result.finalQuestNumber.endsWith('0000000000000')).toBe(true);
  });
});

describe('Authoritative Drawing Metrics Extraction & Immutability', () => {
  it('marks active missions as CURRENT — NOT FINAL with live telemetry', () => {
    const activeData: PublicDrawingPageData = {
      eventId: 'evt-test-active',
      eventTitle: "Founder's Cipher",
      ledgerLockStatus: 'open',
      ledgerLockTimestamp: null,
      snapshotHash: null,
      totalQualifiedPlayers: 28,
      totalQualifiedEntries: 84,
      totalCompletedQuests: 120,
      publicPlayerEntries: [],
      publishedPrizes: [],
      publishedAt: null,
    };

    const metrics = extractAuthoritativeDrawingMetrics(activeData);
    expect(metrics.isFrozen).toBe(false);
    expect(metrics.statusLabel).toBe('CURRENT — NOT FINAL');
    expect(metrics.totalPlayers).toBe(28);
    expect(metrics.totalValidEntries).toBe(84);
    expect(metrics.totalCompletedQuests).toBe(120);
    expect(metrics.finalQuestNumber).toBe((311420151417215192019n * 28n * 84n * 120n).toString());
    expect(metrics.frozenAt).toBeNull();
  });

  it('marks locked drawing ledger as FINAL VERIFIED TOTALS with frozen snapshot hash', () => {
    const lockedData: PublicDrawingPageData = {
      eventId: 'evt-test-locked',
      eventTitle: "Founder's Cipher",
      ledgerLockStatus: 'locked',
      ledgerLockTimestamp: '2026-08-31T20:00:00.000Z',
      snapshotHash: 'SHA256-abcdef1234567890',
      totalQualifiedPlayers: 50,
      totalQualifiedEntries: 150,
      totalCompletedQuests: 210,
      publicPlayerEntries: [],
      publishedPrizes: [],
      publishedAt: null,
    };

    const metrics = extractAuthoritativeDrawingMetrics(lockedData);
    expect(metrics.isFrozen).toBe(true);
    expect(metrics.statusLabel).toBe('FINAL VERIFIED TOTALS');
    expect(metrics.totalPlayers).toBe(50);
    expect(metrics.totalValidEntries).toBe(150);
    expect(metrics.totalCompletedQuests).toBe(210);
    expect(metrics.frozenAt).toBe('2026-08-31T20:00:00.000Z');
    expect(metrics.snapshotHash).toBe('SHA256-abcdef1234567890');
    expect(metrics.finalQuestNumber).toBe((311420151417215192019n * 50n * 150n * 210n).toString());
  });

  it('preserves historical drawing receipt totals permanently regardless of subsequent database changes', () => {
    // A published prize receipt has frozen numbers (e.g. 40 players, 100 entries, 160 quests)
    // even if later mutable database rows report 99 players and 500 entries.
    const historicalReceiptData: PublicDrawingPageData = {
      eventId: 'evt-test-published',
      eventTitle: "Founder's Cipher",
      ledgerLockStatus: 'locked',
      ledgerLockTimestamp: '2026-08-31T20:00:00.000Z',
      snapshotHash: 'SHA256-snapshot123',
      totalQualifiedPlayers: 99, // Mutable database row changed later
      totalQualifiedEntries: 500, // Mutable database row changed later
      totalCompletedQuests: 800,  // Mutable database row changed later
      publicPlayerEntries: [],
      publishedPrizes: [
        {
          drawRecordId: 'dr-1',
          prizeId: 'prz-1',
          prizeTitle: 'Grand Prize $500',
          winnerPublicLabel: 'Agent #Alpha',
          drawMethod: 'final_quest',
          drawnAt: '2026-08-31T20:05:00.000Z',
          verificationStatus: 'final_quest_trail',
          isSystemVerified: true,
          isIndependent: false,
          finalQuestReceipt: {
            eventId: 'evt-test-published',
            eventTitle: "Founder's Cipher",
            totalTickets: 100,
            ticketWidth: 3,
            eventMetrics: {
              totalPlayers: 40,
              totalValidEntries: 100,
              totalCompletedQuests: 160,
              totalFinishers: 15,
            },
            permanentNumber: '311420151417215192019',
            productFormula: '40 × 100 × 160 × 311420151417215192019 = 199308896907017722892160000',
            finalQuestNumber: '199308896907017722892160000',
            trailSteps: [],
            winningTicket: 42,
            winningPublicPlayerLabel: 'Agent #Alpha',
            winningPlayerTicketRange: { start: 1, end: 100 },
            allTicketRanges: [],
            resolutionMethod: 'forward_trail',
            lockedLedgerHash: 'SHA256-frozen-receipt-hash',
            drawnAt: '2026-08-31T20:05:00.000Z',
          },
        },
      ],
      publishedAt: '2026-08-31T20:05:00.000Z',
    };

    const metrics = extractAuthoritativeDrawingMetrics(historicalReceiptData);
    expect(metrics.isFrozen).toBe(true);
    expect(metrics.isHistoricalReceipt).toBe(true);
    expect(metrics.statusLabel).toBe('FINAL VERIFIED TOTALS');

    // Authoritative frozen numbers are used, NOT the mutable later database counts
    expect(metrics.totalPlayers).toBe(40);
    expect(metrics.totalValidEntries).toBe(100);
    expect(metrics.totalCompletedQuests).toBe(160);

    const expectedProduct = 311420151417215192019n * 40n * 100n * 160n;
    expect(metrics.finalQuestNumber).toBe(expectedProduct.toString());
    expect(metrics.snapshotHash).toBe('SHA256-frozen-receipt-hash');
  });

  it('guarantees stranger reproducibility: independent calculation matches exact digits', () => {
    // Suppose a stranger stands on /how-it-works after a drawing:
    const publishedNumbers = {
      permanentConstant: '311420151417215192019',
      totalPlayers: 63,
      totalValidEntries: 189,
      totalCompletedQuests: 277,
    };

    // The stranger multiplies them independently on their phone/terminal:
    const strangerBigInt =
      BigInt(publishedNumbers.permanentConstant) *
      BigInt(publishedNumbers.totalPlayers) *
      BigInt(publishedNumbers.totalValidEntries) *
      BigInt(publishedNumbers.totalCompletedQuests);

    const serverCalc = calculateVerifiedFinalQuestNumber(
      publishedNumbers.totalPlayers,
      publishedNumbers.totalValidEntries,
      publishedNumbers.totalCompletedQuests
    );

    expect(serverCalc.finalQuestNumber).toBe(strangerBigInt.toString());
    expect(serverCalc.substitutedEquation).toContain(strangerBigInt.toString());
  });
});

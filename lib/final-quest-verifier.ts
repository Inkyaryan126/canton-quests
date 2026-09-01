/**
 * Canton Quests — Final Quest Number Verification Engine
 *
 * Provides BigInt arbitrary-precision calculation and authoritative ledger extraction
 * for verifying the Final Quest Number on /how-it-works.
 *
 * FORMULA:
 * 311420151417215192019 × totalPlayers × totalValidEntries × totalCompletedQuests = FinalQuestNumber
 */

import { PublicDrawingPageData } from './types';

export const PERMANENT_CANTON_QUESTS_NUMBER = '311420151417215192019';
export const PERMANENT_CANTON_QUESTS_BIGINT = 311420151417215192019n;

export interface FinalQuestVerificationResult {
  eventName: string;
  permanentNumber: string;
  totalPlayers: number;
  totalValidEntries: number;
  totalCompletedQuests: number;
  finalQuestNumber: string;
  substitutedEquation: string;
  isFrozen: boolean;
  statusLabel: 'FINAL VERIFIED TOTALS' | 'CURRENT — NOT FINAL';
  isHistoricalReceipt: boolean;
  frozenAt: string | null;
  snapshotHash: string | null;
  note: string;
}

/**
 * Calculates the Final Quest Number with BigInt arbitrary-precision arithmetic.
 * Never uses standard JavaScript floating-point numbers.
 */
export function calculateVerifiedFinalQuestNumber(
  totalPlayers: number,
  totalValidEntries: number,
  totalCompletedQuests: number
): {
  finalQuestNumber: string;
  substitutedEquation: string;
  rawBigInt: bigint;
} {
  const p = BigInt(Math.max(0, Math.floor(totalPlayers || 0)));
  const e = BigInt(Math.max(0, Math.floor(totalValidEntries || 0)));
  const q = BigInt(Math.max(0, Math.floor(totalCompletedQuests || 0)));

  const rawBigInt = PERMANENT_CANTON_QUESTS_BIGINT * p * e * q;
  const finalQuestNumber = rawBigInt.toString();
  const substitutedEquation = `${PERMANENT_CANTON_QUESTS_NUMBER} × ${p.toString()} × ${e.toString()} × ${q.toString()} = ${finalQuestNumber}`;

  return {
    finalQuestNumber,
    substitutedEquation,
    rawBigInt,
  };
}

/**
 * Extracts authoritative numbers from drawing ledger data.
 * If a drawing has been finalized and frozen, returns the immutable historical receipt values
 * so that future database activity never alters the historical drawing numbers.
 */
export function extractAuthoritativeDrawingMetrics(
  data: PublicDrawingPageData | null
): FinalQuestVerificationResult {
  if (!data) {
    const calc = calculateVerifiedFinalQuestNumber(0, 0, 0);
    return {
      eventName: 'Canton Quests Mission',
      permanentNumber: PERMANENT_CANTON_QUESTS_NUMBER,
      totalPlayers: 0,
      totalValidEntries: 0,
      totalCompletedQuests: 0,
      finalQuestNumber: calc.finalQuestNumber,
      substitutedEquation: calc.substitutedEquation,
      isFrozen: false,
      statusLabel: 'CURRENT — NOT FINAL',
      isHistoricalReceipt: false,
      frozenAt: null,
      snapshotHash: null,
      note: 'Connecting to authoritative Mission drawing ledger...',
    };
  }

  const eventName = data.eventTitle || "Canton Quests: Volume 1 - The Founder's Cipher";

  // 1. Check for published prize with frozen Final Quest receipt
  const publishedWithReceipt = data.publishedPrizes?.find((p) => p.finalQuestReceipt);
  if (publishedWithReceipt?.finalQuestReceipt) {
    const receipt = publishedWithReceipt.finalQuestReceipt;
    const totalPlayers = receipt.eventMetrics?.totalPlayers ?? data.totalQualifiedPlayers;
    const totalValidEntries = receipt.eventMetrics?.totalValidEntries ?? data.totalQualifiedEntries;
    const totalCompletedQuests = receipt.eventMetrics?.totalCompletedQuests ?? (data.totalCompletedQuests || 0);

    const calc = calculateVerifiedFinalQuestNumber(totalPlayers, totalValidEntries, totalCompletedQuests);

    return {
      eventName,
      permanentNumber: PERMANENT_CANTON_QUESTS_NUMBER,
      totalPlayers,
      totalValidEntries,
      totalCompletedQuests,
      finalQuestNumber: calc.finalQuestNumber,
      substitutedEquation: calc.substitutedEquation,
      isFrozen: true,
      statusLabel: 'FINAL VERIFIED TOTALS',
      isHistoricalReceipt: true,
      frozenAt: receipt.drawnAt || data.publishedAt || data.ledgerLockTimestamp,
      snapshotHash: receipt.lockedLedgerHash || data.snapshotHash,
      note: 'Exact frozen historical values from finalized drawing ledger receipt. Permanently immutable.',
    };
  }

  // 2. Check for locked ledger (drawing closed and frozen, awaiting or post-draw)
  if (data.ledgerLockStatus === 'locked') {
    const totalPlayers = data.totalQualifiedPlayers || 0;
    const totalValidEntries = data.totalQualifiedEntries || 0;
    const totalCompletedQuests = data.totalCompletedQuests || 0;

    const calc = calculateVerifiedFinalQuestNumber(totalPlayers, totalValidEntries, totalCompletedQuests);

    return {
      eventName,
      permanentNumber: PERMANENT_CANTON_QUESTS_NUMBER,
      totalPlayers,
      totalValidEntries,
      totalCompletedQuests,
      finalQuestNumber: calc.finalQuestNumber,
      substitutedEquation: calc.substitutedEquation,
      isFrozen: true,
      statusLabel: 'FINAL VERIFIED TOTALS',
      isHistoricalReceipt: false,
      frozenAt: data.ledgerLockTimestamp,
      snapshotHash: data.snapshotHash,
      note: 'Exact frozen historical values from cryptographically locked ledger snapshot.',
    };
  }

  // 3. Active Mission (live telemetry, totals update in real-time)
  const totalPlayers = data.totalQualifiedPlayers || 0;
  const totalValidEntries = data.totalQualifiedEntries || 0;
  const totalCompletedQuests = data.totalCompletedQuests || 0;

  const calc = calculateVerifiedFinalQuestNumber(totalPlayers, totalValidEntries, totalCompletedQuests);

  return {
    eventName,
    permanentNumber: PERMANENT_CANTON_QUESTS_NUMBER,
    totalPlayers,
    totalValidEntries,
    totalCompletedQuests,
    finalQuestNumber: calc.finalQuestNumber,
    substitutedEquation: calc.substitutedEquation,
    isFrozen: false,
    statusLabel: 'CURRENT — NOT FINAL',
    isHistoricalReceipt: false,
    frozenAt: null,
    snapshotHash: null,
    note: 'Live mission telemetry. Numbers update in real time until drawing ledger is frozen upon Mission close.',
  };
}

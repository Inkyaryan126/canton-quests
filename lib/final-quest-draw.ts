/**
 * Canton Quests — Final Quest Draw System
 *
 * A human-readable, deterministic winner-selection layer operating on top of
 * the transparent, frozen drawing entry ledger.
 *
 * PERMANENT CANTON QUESTS NUMBER:
 * Derived from converting CANTON QUESTS with A=1..Z=26:
 * C=3, A=1, N=14, T=20, O=15, N=14, Q=17, U=21, E=5, S=19, T=20, S=19
 * Concatenated: 311420151417215192019
 */

import {
  CanonicalSnapshot,
  CanonicalSnapshotPlayer,
  FinalQuestDrawReceipt,
  FinalQuestEventMetrics,
  FinalQuestTicketRange,
  FinalQuestTrailStep,
} from './types';
import {
  PERMANENT_CANTON_QUESTS_NUMBER,
  PERMANENT_CANTON_QUESTS_BIGINT,
  assignTicketsToSnapshot,
  getFrozenEventMetrics,
  computeFinalQuestNumber,
  followTheTrail,
} from './game-engine';

export {
  PERMANENT_CANTON_QUESTS_NUMBER,
  PERMANENT_CANTON_QUESTS_BIGINT,
  assignTicketsToSnapshot,
  getFrozenEventMetrics,
  computeFinalQuestNumber,
  followTheTrail,
};

export interface FinalQuestEventNumbersInput {
  totalPlayers: number;
  totalValidEntries?: number;
  totalValidTickets?: number;
  totalCompletedQuests: number;
  totalFinishers?: number;
  flagshipQuestCompletions?: number;
}

export interface FinalQuestCalculationDetail {
  totalTickets: number;
  ticketWidth: number;
  eventMetrics: FinalQuestEventMetrics;
  permanentNumber: string;
  productFormula: string;
  finalQuestNumber: string;
  trailSteps: FinalQuestTrailStep[];
  winningTicket: number;
  winningPublicPlayerLabel: string;
  winningPublicParticipantId: string;
  winningPlayerTicketRange: { start: number; end: number };
  allTicketRanges: FinalQuestTicketRange[];
  resolutionMethod: 'forward_trail' | 'reverse_trail' | 'deterministic_modulo_fallback';
  isFallback: boolean;
  fallbackReason?: string;
}

/**
 * Calculate the ticket number width (number of digits in totalValidTickets).
 * Examples: 356 -> 3, 87 -> 2, 4812 -> 4, 9 -> 1.
 */
export function getTicketNumberWidth(totalValidTickets: number): number {
  if (totalValidTickets <= 0) return 1;
  return Math.max(1, String(totalValidTickets).length);
}

/**
 * Deterministically assign ticket numbers (1..N) to players from the canonical snapshot.
 * Preserves the exact deterministic ordering of the canonical snapshot.
 */
export function assignTicketRanges(players: CanonicalSnapshotPlayer[]): FinalQuestTicketRange[] {
  return assignTicketsToSnapshot({ eventId: '', players }).ticketRanges;
}

/**
 * Find the player assigned to a specific ticket number.
 */
export function findPlayerByTicketNumber(
  assignedRanges: FinalQuestTicketRange[],
  ticketNumber: number
): FinalQuestTicketRange | undefined {
  return assignedRanges.find(
    (range) => ticketNumber >= range.startTicket && ticketNumber <= range.endTicket
  );
}

/**
 * Standardize predetermined event metrics into structured metric items.
 */
export function standardizeEventMetrics(metrics: FinalQuestEventNumbersInput): FinalQuestEventMetrics {
  const totalPlayers = Math.max(1, Math.floor(metrics.totalPlayers || 1));
  const totalValidEntries = Math.max(
    1,
    Math.floor(metrics.totalValidEntries || metrics.totalValidTickets || 1)
  );
  const totalCompletedQuests = Math.max(1, Math.floor(metrics.totalCompletedQuests || 1));
  const totalFinishers = Math.max(
    1,
    Math.floor(metrics.totalFinishers || metrics.flagshipQuestCompletions || 1)
  );

  return {
    totalPlayers,
    totalValidEntries,
    totalCompletedQuests,
    totalFinishers,
  };
}

/**
 * Calculate the Final Quest Number from predetermined event metrics and the permanent constant.
 */
export function calculateFinalQuestNumber(metrics: FinalQuestEventNumbersInput): {
  eventMetrics: FinalQuestEventMetrics;
  eventProduct: bigint;
  finalQuestNumber: bigint;
  finalQuestNumberString: string;
  productFormula: string;
} {
  const standardized = standardizeEventMetrics(metrics);
  const { finalQuestNumber, productFormula, rawProduct } = computeFinalQuestNumber(standardized);

  return {
    eventMetrics: standardized,
    eventProduct: rawProduct,
    finalQuestNumber: BigInt(finalQuestNumber),
    finalQuestNumberString: finalQuestNumber,
    productFormula,
  };
}

/**
 * Execute the Final Quest Draw algorithm.
 */
export function executeFinalQuestDraw(options: {
  totalTickets: number;
  finalQuestNumber: bigint | string;
  snapshotPlayers?: CanonicalSnapshotPlayer[];
  assignedRanges?: FinalQuestTicketRange[];
  excludedPlayerLabels?: string[];
  eventMetrics: FinalQuestEventMetrics;
  eventId?: string;
  eventTitle?: string;
  lockedLedgerHash?: string;
}): FinalQuestCalculationDetail {
  const totalTickets = Math.max(1, Math.floor(options.totalTickets));
  const assignedRanges =
    options.assignedRanges ||
    (options.snapshotPlayers ? assignTicketRanges(options.snapshotPlayers) : []);

  const numStr =
    typeof options.finalQuestNumber === 'bigint'
      ? options.finalQuestNumber.toString()
      : String(options.finalQuestNumber);

  const trailResult = followTheTrail(
    numStr,
    totalTickets,
    assignedRanges
  );

  const winningHolder = trailResult.winningRange;
  const isFallback = trailResult.resolutionMethod !== 'forward_trail';
  const fallbackReason =
    trailResult.resolutionMethod === 'reverse_trail'
      ? 'Forward scan found no eligible ticket. Won on reverse fallback trail.'
      : trailResult.resolutionMethod === 'deterministic_modulo_fallback'
      ? 'Forward and reverse scans found no eligible ticket. Won on deterministic modulo fallback.'
      : undefined;

  const formula = computeFinalQuestNumber(options.eventMetrics).productFormula;

  return {
    totalTickets,
    ticketWidth: getTicketNumberWidth(totalTickets),
    eventMetrics: options.eventMetrics,
    permanentNumber: PERMANENT_CANTON_QUESTS_NUMBER,
    productFormula: formula,
    finalQuestNumber: numStr,
    trailSteps: trailResult.trailSteps,
    winningTicket: trailResult.winningTicket,
    winningPublicPlayerLabel: winningHolder.publicPlayerLabel,
    winningPublicParticipantId: winningHolder.publicParticipantId || '',
    winningPlayerTicketRange: { start: winningHolder.startTicket, end: winningHolder.endTicket },
    allTicketRanges: assignedRanges,
    resolutionMethod: trailResult.resolutionMethod,
    isFallback,
    fallbackReason,
  };
}

/**
 * Generate a complete FinalQuestDrawReceipt from an executed calculation.
 */
export function createFinalQuestReceipt(
  calc: FinalQuestCalculationDetail,
  meta: { eventId: string; eventTitle: string; lockedLedgerHash: string; drawnAt?: string }
): FinalQuestDrawReceipt {
  return {
    eventId: meta.eventId,
    eventTitle: meta.eventTitle,
    totalTickets: calc.totalTickets,
    ticketWidth: calc.ticketWidth,
    eventMetrics: calc.eventMetrics,
    permanentNumber: calc.permanentNumber,
    productFormula: calc.productFormula,
    finalQuestNumber: calc.finalQuestNumber,
    trailSteps: calc.trailSteps,
    winningTicket: calc.winningTicket,
    winningPublicPlayerLabel: calc.winningPublicPlayerLabel,
    winningPublicParticipantId: calc.winningPublicParticipantId,
    winningPlayerTicketRange: calc.winningPlayerTicketRange,
    allTicketRanges: calc.allTicketRanges,
    resolutionMethod: calc.resolutionMethod,
    lockedLedgerHash: meta.lockedLedgerHash,
    drawnAt: meta.drawnAt || new Date().toISOString(),
  };
}

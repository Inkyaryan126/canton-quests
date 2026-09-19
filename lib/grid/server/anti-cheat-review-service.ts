import type { GridAntiCheatSignal } from '../core/anti-cheat-types';
import type {
  GridAntiCheatReviewCommand,
  GridAntiCheatReviewPort,
  GridAntiCheatReviewQueueItem,
  GridAntiCheatReviewStateCommand,
  GridAntiCheatReviewStatus,
  GridAntiCheatReviewResult,
} from './anti-cheat-review-port';

function requireNonBlank(value: string, label: string): void {
  if (!value.trim()) throw new Error(`Grid anti-cheat review requires ${label}`);
}

function requireTimestamp(value: string): void {
  if (!Number.isFinite(Date.parse(value))) {
    throw new Error('Grid anti-cheat review requires a valid createdAt timestamp');
  }
}

function assertSortedUnique(ids: readonly string[], label: string): void {
  for (let index = 0; index < ids.length; index += 1) {
    requireNonBlank(ids[index], `${label} entries`);
    if (index > 0 && ids[index - 1].localeCompare(ids[index]) >= 0) {
      throw new Error(`${label} must be sorted and unique`);
    }
  }
}

function assertAssessmentEvidence(command: GridAntiCheatReviewCommand): void {
  const { assessment, signals } = command;
  if (!Number.isSafeInteger(assessment.riskScoreBps) || assessment.riskScoreBps < 0 || assessment.riskScoreBps > 10000) {
    throw new Error('Grid anti-cheat review requires riskScoreBps between 0 and 10000');
  }
  if (!['allow', 'monitor', 'review', 'reject-command'].includes(assessment.disposition)) {
    throw new Error('Grid anti-cheat review requires a valid disposition');
  }
  const signalIds = signals.map((signal) => signal.id);
  assertSortedUnique(signalIds, 'signal evidence IDs');
  assertSortedUnique(assessment.signalIds, 'assessment signalIds');
  assertSortedUnique(assessment.hardRejectSignalIds, 'assessment hardRejectSignalIds');
  if (JSON.stringify(assessment.signalIds) !== JSON.stringify(signalIds)) {
    throw new Error('signalIds must match ordered signal evidence');
  }
  if (assessment.hardRejectSignalIds.some((id) => !signalIds.includes(id))) {
    throw new Error('hardRejectSignalIds must refer to signal evidence');
  }
  if (assessment.disposition === 'allow' && (signalIds.length > 0 || assessment.hardRejectSignalIds.length > 0)) {
    throw new Error('allow assessments cannot contain anti-cheat evidence');
  }
  for (const signal of signals) {
    requireNonBlank(signal.reasonCode, 'signal reasonCode');
    if (!Number.isSafeInteger(signal.confidenceBps) || signal.confidenceBps < 0 || signal.confidenceBps > 10000) {
      throw new Error(`invalid confidenceBps for signal ${signal.id}`);
    }
  }
}

function validateAssessmentCommand(command: GridAntiCheatReviewCommand): void {
  requireNonBlank(command.cityId, 'cityId');
  requireNonBlank(command.seasonId, 'seasonId');
  requireNonBlank(command.playerId, 'playerId');
  requireNonBlank(command.actionId, 'actionId');
  requireNonBlank(command.assessmentKey, 'assessmentKey');
  requireTimestamp(command.createdAt);
  assertAssessmentEvidence(command);
}

export async function recordGridAntiCheatAssessment(
  port: GridAntiCheatReviewPort,
  command: GridAntiCheatReviewCommand,
): Promise<GridAntiCheatReviewResult> {
  validateAssessmentCommand(command);
  return port.recordAssessment(command);
}

export async function listGridAntiCheatReviewQueue(
  port: GridAntiCheatReviewPort,
  limit?: number,
): Promise<GridAntiCheatReviewQueueItem[]> {
  if (limit !== undefined && (!Number.isSafeInteger(limit) || limit < 1 || limit > 500)) {
    throw new Error('Grid anti-cheat review queue limit must be between 1 and 500');
  }
  return port.listReviewQueue(limit);
}

export async function recordGridAntiCheatReview(
  port: GridAntiCheatReviewPort,
  command: GridAntiCheatReviewStateCommand,
): Promise<GridAntiCheatReviewQueueItem> {
  requireNonBlank(command.assessmentId, 'assessmentId');
  const statuses: GridAntiCheatReviewStatus[] = ['pending', 'in-review', 'resolved'];
  if (!statuses.includes(command.status)) throw new Error('Grid anti-cheat review requires a valid status');
  if (command.status === 'resolved' && (!command.resolution || Object.keys(command.resolution).length === 0)) {
    throw new Error('resolved review requires resolution metadata');
  }
  return port.recordReview(command);
}

export function cloneAntiCheatSignals(signals: readonly GridAntiCheatSignal[]): GridAntiCheatSignal[] {
  return signals.map((signal) => ({ ...signal }));
}

// Canton Quests — Proof Integrity & Suspicious Flagging Engine (Phase 4)

import { Quest, QuestSubmission, ProofReviewFlag, SubmitProofParams } from './types';
import { checkProximity } from './geo';

function proofDigest(value: string): string | undefined {
  if (typeof window !== 'undefined') return undefined;
  const nodeRequire = eval('require') as (id: string) => any;
  return nodeRequire('crypto').createHash('sha256').update(value.trim().toUpperCase()).digest('hex');
}

function proofMatches(inputValue: string | undefined, targetValue: string | undefined): boolean {
  const input = (inputValue || '').trim().toUpperCase();
  const target = (targetValue || '').trim();
  if (!input || !target) return false;
  if (target.toLowerCase().startsWith('sha256:')) {
    return proofDigest(input) === target.slice('sha256:'.length).toLowerCase();
  }
  return input === target.toUpperCase();
}

/**
 * Analyzes a proposed submission for suspicious patterns and returns automated review flags.
 */
export function evaluateProofIntegrity(
  params: SubmitProofParams,
  quest: Quest,
  existingSubmissions: QuestSubmission[],
  isEventPaused: boolean = false
): ProofReviewFlag[] {
  const flags: ProofReviewFlag[] = [];

  // 1. Paused Event Flag
  if (isEventPaused) {
    flags.push('PAUSED_EVENT');
  }

  // 2. Duplicate Proof Detection
  if (params.submittedContent || params.proofUrl) {
    const isDuplicateContent = existingSubmissions.some((s) => {
      if (s.playerId === params.playerId && s.questId === params.questId) return false;
      if (params.proofUrl && s.proofUrl === params.proofUrl) return true;
      if (params.submittedContent && params.submittedContent.length > 5 && s.submittedContent === params.submittedContent) return true;
      return false;
    });

    if (isDuplicateContent) {
      flags.push('DUPLICATE_PROOF');
    }
  }

  // 3. Location Boundary Flag
  if (
    (quest.requireLocationVerification || quest.requireQrAndLocation || quest.verificationType === 'checkin') &&
    quest.location &&
    quest.location.latitude &&
    quest.location.longitude
  ) {
    const radius = quest.radiusMeters || quest.location.radiusMeters || 100;
    if (params.userLat !== undefined && params.userLon !== undefined) {
      const prox = checkProximity(
        { latitude: params.userLat, longitude: params.userLon },
        quest.location.latitude,
        quest.location.longitude,
        radius
      );
      if (!prox.isWithinRadius) {
        flags.push('OUTSIDE_LOCATION');
      }
    }
  }

  // 4. Expired Quest Flag
  if (quest.expiresAt && new Date(quest.expiresAt).getTime() <= Date.now()) {
    flags.push('EXPIRED_QUEST');
  }

  // 5. High-Frequency Submission Flag (> 3 submissions in 60s)
  const now = Date.now();
  const recentPlayerSubs = existingSubmissions.filter((s) => {
    if (s.playerId !== params.playerId) return false;
    const subTime = new Date(s.submittedAt).getTime();
    return now - subTime < 60000;
  });

  if (recentPlayerSubs.length >= 3) {
    flags.push('HIGH_FREQUENCY_SUBMISSIONS');
  }

  // 6. Malformed QR Flag
  if (quest.verificationType === 'qr' && quest.targetCode) {
    if (!proofMatches(params.submittedContent, quest.targetCode)) {
      flags.push('MALFORMED_QR');
    }
  }

  return flags;
}

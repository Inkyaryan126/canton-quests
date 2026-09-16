export const GRID_CHAT_MAX_BODY_LENGTH = 1200;
export const GRID_CHAT_MAX_REPORT_DETAILS = 500;
export const GRID_CHAT_MAX_CLIENT_NONCE = 100;

export const GRID_CHAT_REPORT_REASONS = [
  'harassment',
  'spam',
  'safety',
  'cheating',
  'inappropriate',
  'other',
] as const;

export type GridChatReportReason = (typeof GRID_CHAT_REPORT_REASONS)[number];

const REPORT_REASON_SET = new Set<string>(GRID_CHAT_REPORT_REASONS);
const UNSUPPORTED_CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

export function normalizeGridChatBody(input: string): string {
  if (typeof input !== 'string') throw new Error('Chat message must be text');
  if (UNSUPPORTED_CONTROL.test(input)) {
    throw new Error('Chat message contains unsupported control characters');
  }

  const normalized = input
    .replace(/\r\n?/g, '\n')
    .replace(/\t/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();

  if (!normalized) throw new Error('Chat message cannot be empty');
  if (normalized.length > GRID_CHAT_MAX_BODY_LENGTH) {
    throw new Error(`Chat message cannot exceed ${GRID_CHAT_MAX_BODY_LENGTH} characters`);
  }
  return normalized;
}

export function buildDirectChatScopeKey(playerA: string, playerB: string): string {
  const a = playerA.trim();
  const b = playerB.trim();
  if (!a || !b) throw new Error('Direct chat requires two players');
  if (a === b) throw new Error('Direct chat requires two different players');
  const [first, second] = [a, b].sort((left, right) => left.localeCompare(right));
  return `direct:${first}:${second}`;
}

export function validateGridChatClientNonce(value: string): string {
  const nonce = typeof value === 'string' ? value.trim() : '';
  if (!nonce) throw new Error('Missing chat client nonce');
  if (nonce.length > GRID_CHAT_MAX_CLIENT_NONCE) {
    throw new Error('Chat client nonce is too long');
  }
  return nonce;
}

export function validateGridChatReport(
  reasonValue: string,
  detailsValue?: string | null,
): { reason: GridChatReportReason; details: string | null } {
  const reason = typeof reasonValue === 'string' ? reasonValue.trim() : '';
  if (!REPORT_REASON_SET.has(reason)) throw new Error('Unknown chat report reason');

  const details = typeof detailsValue === 'string' ? detailsValue.trim() : '';
  if (details.length > GRID_CHAT_MAX_REPORT_DETAILS) {
    throw new Error(`Report details cannot exceed ${GRID_CHAT_MAX_REPORT_DETAILS} characters`);
  }

  return {
    reason: reason as GridChatReportReason,
    details: details || null,
  };
}

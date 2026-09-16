import { describe, expect, it } from 'vitest';
import {
  buildDirectChatScopeKey,
  normalizeGridChatBody,
  validateGridChatClientNonce,
  validateGridChatReport,
  GRID_CHAT_MAX_BODY_LENGTH,
} from '../lib/grid/core/chat';

describe('GRID chat core', () => {
  it('normalizes surrounding whitespace while preserving intentional line breaks', () => {
    expect(normalizeGridChatBody('   Meet at the plaza  \n\n  Signal is live.   ')).toBe(
      'Meet at the plaza\n\nSignal is live.',
    );
  });

  it('rejects empty and overlong messages', () => {
    expect(() => normalizeGridChatBody('   \n  ')).toThrow('Chat message cannot be empty');
    expect(() => normalizeGridChatBody('x'.repeat(GRID_CHAT_MAX_BODY_LENGTH + 1))).toThrow(
      `Chat message cannot exceed ${GRID_CHAT_MAX_BODY_LENGTH} characters`,
    );
  });

  it('rejects dangerous ASCII control characters but permits normal newlines and tabs', () => {
    expect(() => normalizeGridChatBody('hello\u0007world')).toThrow('unsupported control characters');
    expect(normalizeGridChatBody('hello\tworld\nnext')).toBe('hello world\nnext');
  });

  it('creates the same direct scope key regardless of participant order', () => {
    expect(buildDirectChatScopeKey('player-b', 'player-a')).toBe('direct:player-a:player-b');
    expect(buildDirectChatScopeKey('player-a', 'player-b')).toBe('direct:player-a:player-b');
  });

  it('refuses self-DM scope keys', () => {
    expect(() => buildDirectChatScopeKey('same', 'same')).toThrow('Direct chat requires two different players');
  });

  it('requires compact idempotency nonces', () => {
    expect(validateGridChatClientNonce('chat:01J8ABC-123')).toBe('chat:01J8ABC-123');
    expect(() => validateGridChatClientNonce('')).toThrow('Missing chat client nonce');
    expect(() => validateGridChatClientNonce('x'.repeat(101))).toThrow('Chat client nonce is too long');
  });

  it('validates report categories and trims optional details', () => {
    expect(validateGridChatReport('harassment', '  keeps targeting me  ')).toEqual({
      reason: 'harassment',
      details: 'keeps targeting me',
    });
    expect(() => validateGridChatReport('not-real', '')).toThrow('Unknown chat report reason');
    expect(() => validateGridChatReport('spam', 'x'.repeat(501))).toThrow('Report details cannot exceed 500 characters');
  });
});

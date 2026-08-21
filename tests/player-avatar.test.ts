import { describe, it, expect } from 'vitest';
import { isImageAvatar } from '../components/PlayerAvatar';

describe('PlayerAvatar Unit Tests & Safety Invariants', () => {
  it('correctly identifies image URLs vs emoji/character fallbacks', () => {
    // Image paths and presets
    expect(isImageAvatar('/canton-quests/1.png')).toBe(true);
    expect(isImageAvatar('/canton-quests/5.png')).toBe(true);
    expect(isImageAvatar('https://storage.supabase.com/avatars/user-123.jpg')).toBe(true);
    expect(isImageAvatar('http://example.com/avatar.webp')).toBe(true);
    expect(isImageAvatar('/brand/canton-quests-mark.png')).toBe(true);
    expect(isImageAvatar('data:image/png;base64,iVBORw0KGgoAAAANS')).toBe(true);

    // Emojis and single characters
    expect(isImageAvatar('⚡')).toBe(false);
    expect(isImageAvatar('🧭')).toBe(false);
    expect(isImageAvatar('🔍')).toBe(false);
    expect(isImageAvatar('🦅')).toBe(false);

    // Falsy and empty
    expect(isImageAvatar('')).toBe(false);
    expect(isImageAvatar(null)).toBe(false);
    expect(isImageAvatar(undefined)).toBe(false);
    expect(isImageAvatar('   ')).toBe(false);
  });
});

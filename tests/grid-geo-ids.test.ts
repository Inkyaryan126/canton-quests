import { describe, expect, it } from 'vitest';
import { deterministicSlug, findDuplicateSlugs } from '../lib/grid/geo/ids';

describe('deterministicSlug', () => {
  it('lowercases, hyphenates, and strips punctuation', () => {
    expect(deterministicSlug('Market Square District')).toBe(
      'market-square-district'
    );
    expect(deterministicSlug("St. Paul's Historic Quarter")).toBe(
      'st-paul-s-historic-quarter'
    );
  });

  it('strips diacritics down to ascii base letters', () => {
    expect(deterministicSlug('Café Résumé')).toBe('cafe-resume');
  });

  it('produces ascii-only, hyphenated output for non-latin input', () => {
    expect(deterministicSlug('東京 Plaza')).toMatch(/^[a-z0-9-]*$/);
  });

  it('collapses repeated separators and trims leading/trailing hyphens', () => {
    expect(deterministicSlug('  The Downtown   Corridor!! ')).toBe(
      'the-downtown-corridor'
    );
  });

  it('is idempotent', () => {
    const once = deterministicSlug('  The Downtown   Corridor!! ');
    expect(deterministicSlug(once)).toBe(once);
  });

  it('is a pure function with no randomness', () => {
    expect(deterministicSlug('Repeatable Input')).toBe(
      deterministicSlug('Repeatable Input')
    );
    expect(deterministicSlug('Repeatable Input')).toBe(
      deterministicSlug('Repeatable Input')
    );
  });
});

describe('findDuplicateSlugs', () => {
  it('returns the distinct slugs that appear more than once, sorted', () => {
    expect(findDuplicateSlugs(['a', 'b', 'a', 'c', 'b', 'b'])).toEqual([
      'a',
      'b',
    ]);
  });

  it('returns an empty array when there are no duplicates', () => {
    expect(findDuplicateSlugs(['a', 'b', 'c'])).toEqual([]);
  });

  it('returns an empty array for empty input', () => {
    expect(findDuplicateSlugs([])).toEqual([]);
  });

  it('is a pure function of its input', () => {
    const input = ['x', 'y', 'x'];
    const result = findDuplicateSlugs(input);
    expect(input).toEqual(['x', 'y', 'x']);
    expect(result).toEqual(findDuplicateSlugs(['x', 'y', 'x']));
  });
});

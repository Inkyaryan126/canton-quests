import { describe, expect, it } from 'vitest';
import { deterministicSlug, findDuplicateSlugs } from '../lib/grid/geo/ids';

describe('deterministicSlug', () => {
  it('converts simple strings to lowercase hyphenated format', () => {
    expect(deterministicSlug('Downtown Riverside')).toBe('downtown-riverside');
    expect(deterministicSlug('Pro Football Hall of Fame')).toBe('pro-football-hall-of-fame');
  });

  it('normalizes accents and diacritics to ASCII equivalents', () => {
    expect(deterministicSlug('Café & Bistro')).toBe('cafe-bistro');
    expect(deterministicSlug('Naïve Über Façade')).toBe('naive-uber-facade');
  });

  it('collapses multiple special characters and spaces into single hyphens', () => {
    expect(deterministicSlug('Market  Ave...  North -- #101')).toBe('market-ave-north-101');
  });

  it('strips leading and trailing hyphens and whitespace', () => {
    expect(deterministicSlug('   --Leading and Trailing--   ')).toBe('leading-and-trailing');
  });

  it('is idempotent', () => {
    const rawInputs = [
      'Downtown Riverside',
      'Special #123 @ Spot!',
      'Café au Lait',
      'already-a-slug',
    ];

    for (const input of rawInputs) {
      const slugOnce = deterministicSlug(input);
      const slugTwice = deterministicSlug(slugOnce);
      expect(slugTwice).toBe(slugOnce);
    }
  });

  it('produces stable results across repeated calls (no randomness or time dependency)', () => {
    const input = 'Riverside Cultural Center for the Arts';
    const result1 = deterministicSlug(input);
    const result2 = deterministicSlug(input);
    expect(result1).toBe(result2);
    expect(result1).toBe('riverside-cultural-center-for-the-arts');
  });

  it('handles empty or symbols-only strings gracefully', () => {
    expect(deterministicSlug('')).toBe('');
    expect(deterministicSlug('   ')).toBe('');
    expect(deterministicSlug('***$$$###')).toBe('');
  });
});

describe('findDuplicateSlugs', () => {
  it('returns empty array when all slugs are unique', () => {
    const slugs = ['downtown', 'ridgewood', 'belden-village', 'harter-heights'];
    expect(findDuplicateSlugs(slugs)).toEqual([]);
  });

  it('identifies duplicate slugs in input list', () => {
    const slugs = [
      'downtown',
      'ridgewood',
      'downtown',
      'belden-village',
      'ridgewood',
      'market-district',
    ];
    expect(findDuplicateSlugs(slugs)).toEqual(['downtown', 'ridgewood']);
  });

  it('returns each duplicate slug only once even if repeated multiple times', () => {
    const slugs = ['square', 'square', 'square', 'park', 'square', 'park'];
    expect(findDuplicateSlugs(slugs)).toEqual(['square', 'park']);
  });

  it('handles empty list', () => {
    expect(findDuplicateSlugs([])).toEqual([]);
  });

  it('detects collisions caused by different strings producing the same slug', () => {
    const rawNames = [
      'Downtown Riverside',
      'Downtown-Riverside',
      'downtown riverside',
      'Unique Neighborhood',
    ];
    const generatedSlugs = rawNames.map(deterministicSlug);
    const duplicates = findDuplicateSlugs(generatedSlugs);
    expect(duplicates).toEqual(['downtown-riverside']);
  });
});

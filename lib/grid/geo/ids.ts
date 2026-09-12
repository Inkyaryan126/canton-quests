// Unicode combining diacritical marks block: code points 0x0300-0x036F.
// After NFKD normalization, an accented letter decomposes into a base
// letter followed by one or more of these combining marks; stripping them
// leaves the plain ascii base letter behind.
const COMBINING_DIACRITICAL_MARKS_START = 0x0300;
const COMBINING_DIACRITICAL_MARKS_END = 0x036f;

function stripCombiningDiacritics(value: string): string {
  let result = '';
  for (const char of value) {
    const codePoint = char.codePointAt(0) ?? 0;
    if (
      codePoint < COMBINING_DIACRITICAL_MARKS_START ||
      codePoint > COMBINING_DIACRITICAL_MARKS_END
    ) {
      result += char;
    }
  }
  return result;
}

/**
 * Lowercase, ascii, hyphenated, stable. Pure string transform -- no
 * randomness, no timestamps, no I/O.
 */
export function deterministicSlug(input: string): string {
  return stripCombiningDiacritics(input.normalize('NFKD'))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Returns the distinct slugs that appear more than once, sorted. */
export function findDuplicateSlugs(slugs: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const slug of slugs) {
    if (seen.has(slug)) {
      duplicates.add(slug);
    } else {
      seen.add(slug);
    }
  }
  return Array.from(duplicates).sort();
}

/**
 * ID and slug utilities for Grid Compiler geography assets.
 * All functions are pure, deterministic, and free of randomness or timestamps.
 */

/**
 * Converts a string into a lowercase, ASCII, hyphenated deterministic slug.
 *
 * Rules:
 * - Trims whitespace
 * - Decomposes unicode accents (e.g. é -> e) and strips non-ASCII combining marks
 * - Converts to lowercase
 * - Replaces sequences of non-alphanumeric ASCII characters with a single hyphen
 * - Strips leading and trailing hyphens
 * - Idempotent: deterministicSlug(deterministicSlug(x)) === deterministicSlug(x)
 */
export function deterministicSlug(input: string): string {
  return input
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Identifies duplicate slug strings in a list.
 *
 * Returns an array of unique slug strings that appear more than once in the input.
 * The order of returned slugs matches the order they first appeared as duplicates.
 */
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

  return Array.from(duplicates);
}

/**
 * Deterministic seeded pseudo-random number generator using Mulberry32.
 * Produces uniformly distributed 32-bit floats in the half-open interval [0, 1).
 */
export function createSeededRng(seed: number): () => number {
  if (typeof seed !== 'number' || !Number.isFinite(seed)) {
    throw new Error('Seed must be a finite number');
  }

  let value = seed >>> 0;

  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

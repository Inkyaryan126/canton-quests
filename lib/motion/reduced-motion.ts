/** Shared native preference for non-CSS effects. CSS uses the same media query. */
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

let mediaQuery: MediaQueryList | undefined;

function getMediaQuery(): MediaQueryList | undefined {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
  return mediaQuery ??= window.matchMedia(REDUCED_MOTION_QUERY);
}

/** Conservative fallback: effects stay still when the preference cannot be read. */
export function prefersReducedMotion(): boolean {
  return getMediaQuery()?.matches ?? true;
}

export function subscribeReducedMotion(notify: () => void): () => void {
  const query = getMediaQuery();
  if (!query) return () => {};
  if (typeof query.addEventListener === 'function') {
    query.addEventListener('change', notify);
    return () => query.removeEventListener('change', notify);
  }
  // Older Safari exposes the original MediaQueryList listener API.
  query.addListener(notify);
  return () => query.removeListener(notify);
}

'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

export default function VisitorTracker() {
  const pathname = usePathname();
  // Tracks only the most recently fired pathname (not a permanent set) so
  // React StrictMode's dev-only double-invoke of this effect (mount ->
  // cleanup -> mount again, same pathname both times) is deduped, while a
  // genuine later revisit of a path already seen earlier in the session
  // (e.g. Home -> Quests -> Home) still fires — a permanent Set would
  // silently drop that second, real page view.
  const lastTrackedPathRef = useRef<string | null>(null);

  useEffect(() => {
    // Don't track admin routes
    if (pathname.startsWith('/admin')) return;
    if (lastTrackedPathRef.current === pathname) return;
    lastTrackedPathRef.current = pathname;

    const payload = {
      page: pathname,
      referrer: typeof document !== 'undefined' ? document.referrer : '',
      search: typeof window !== 'undefined' ? window.location.search : '',
    };

    // Use sendBeacon when available (non-blocking, survives page unload)
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      navigator.sendBeacon('/api/track', blob);
    } else {
      fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {});
    }
  }, [pathname]);

  return null;
}

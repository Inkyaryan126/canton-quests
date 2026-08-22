'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

export default function VisitorTracker() {
  const pathname = usePathname();
  const firedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Don't track admin routes
    if (pathname.startsWith('/admin')) return;
    // Don't track twice for same path in this session
    if (firedRef.current.has(pathname)) return;
    firedRef.current.add(pathname);

    const payload = {
      page: pathname,
      referrer: typeof document !== 'undefined' ? document.referrer : '',
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

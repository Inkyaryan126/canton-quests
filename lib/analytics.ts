export function trackCqEvent(eventName: string, details: Record<string, string | number | boolean> = {}) {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent('cq:analytics', {
      detail: {
        eventName,
        details,
        path: window.location.pathname,
        timestamp: new Date().toISOString(),
      },
    })
  );

  if (process.env.NODE_ENV !== 'production') {
    console.info('[cq:analytics]', eventName, details);
  }
}

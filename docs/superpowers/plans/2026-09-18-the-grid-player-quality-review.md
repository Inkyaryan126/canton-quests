# Grid Private Player Quality Review Gate

## Goal

Add a non-invasive launch-hardening check for private Grid React client surfaces while active feature agents continue owning the UI files themselves.

## Current rules

- Discover Grid `*-client.tsx` and `grid-world-client.tsx` surfaces automatically.
- Buttons declare an explicit HTML `type`.
- Buttons include an explicit Tailwind touch-size guardrail of 40px or larger (`h/min-h/w/min-w-10+`).
- Icon-only buttons carry `aria-label` or `aria-labelledby`.
- Native images include `alt` text.
- Files with persistent `setInterval` or `requestAnimationFrame` loops include document-visibility awareness.

This is intentionally a source-level regression gate, not a replacement for browser accessibility tooling, Lighthouse, real-device testing, or visual review. It can run safely while another agent owns the player UI because it only reads those files.

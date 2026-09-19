# Grid Browser Runtime Verification Design

## Goal

Add a local-only verification harness that uses a real browser against a real local Next runtime to verify the signed-out Grid player entry shell and representative public/protected Grid surfaces.

## Scope

Only these files are changed:

- `lib/grid/ops/browser-runtime-verification.ts` — browser/server orchestration, evidence collection, evaluation, and cleanup primitives.
- `scripts/grid-browser-runtime.ts` — human and `--json` CLI output.
- `tests/grid-browser-runtime.test.ts` — focused unit tests that do not need a browser or server.
- This design document and its implementation plan.

The existing `player-entry-runtime.ts` remains the source of entry-route semantics. This harness extends its local-runtime approach with real browser navigation; it does not introduce gameplay, authentication, or player-data mutations.

## Runtime journey

The harness starts one Next development server on a reserved loopback port with Grid world reads disabled and all Supabase URL/key variables blank in the child environment. It does not inherit a remote Supabase target and does not create auth cookies.

It launches Playwright using its already-installed browser executable when present, otherwise an already-installed local Google Chrome/Chromium executable. It never downloads a browser. A mobile viewport (`390x844`) is used for every navigation.

The cases are:

1. `/grid/play` must resolve through the real signed-out entry route to `/grid`, with a successful final response and `THE GRID` heading.
2. `/grid` must render the public entry/navigation shell with a successful response and `THE GRID` heading.
3. `/grid/contracts` must render the protected contracts shell without fabricated auth, with a successful response, `CONTRACTS` heading, and the server-derived `PLAYER AUTHENTICATION REQUIRED` state.

Each case records requested and final URL/path, final HTTP status, title, first heading, console errors, page errors, Next error-overlay count, viewport, and timestamps. A browser/page failure is `FAILED`; missing browser prerequisites are `SKIPPED`, never green.

## Safety and cleanup

The only process started is the child local Next dev server. It is terminated in a `finally` block, with SIGTERM followed by a bounded wait and SIGKILL fallback. Browser context and browser are also closed in `finally` blocks. No production URL is navigated and no production Supabase environment is used.

## Evaluation contract

`evaluateGridBrowserRuntimeReport` returns `VERIFIED` only when every required case is present and has a successful status, expected final path/heading, zero console/page errors, and zero Next overlay elements. It returns `SKIPPED` only when a prerequisite was unavailable, and `FAILED` for actual runtime/page evidence failures.


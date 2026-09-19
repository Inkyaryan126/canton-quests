# Grid Boss Panel — Finish Checkpoint

## Goal
Finish the local Empire/Boss Panel as a truthful, self-contained control plane for the CLI build crew without weakening Control Tower, Definition-of-Done, or production safety.

## Scope
- Make the visible crew match the installed CLI stack: Codex, Claude, Gemini.
- Add an in-panel live crew-health action instead of requiring a terminal command.
- Persist health-check run state in git-common coordination storage so the UI can show working/finished/attention truthfully.
- Keep all agent-start and health actions authenticated and local-development-only.
- Route Builder OS worker orchestration toward Claude and Gemini with Codex as lead/high-level fallback.
- Add a double-clickable macOS launcher that opens the local Boss Panel and starts the dev server only when needed.
- Preserve the existing gold command-center UI and mobile behavior.

## Verification
1. Focused Builder OS unit tests.
2. TypeScript check.
3. Live CLI health probe for Codex, Claude, and Gemini.
4. Lint.
5. Git diff check.
6. Local browser smoke test at desktop and narrow/mobile widths.
7. Control Tower check before commit and release.

## Non-goals
- No production deployment.
- No production database changes.
- No Alliance reconciliation edits.
- No arbitrary shell input exposed through the panel.

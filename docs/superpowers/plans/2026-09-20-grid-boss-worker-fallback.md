# Boss worker fallback and evidence progress

## Problem
The Boss Machine could select a valid task but still stop empty when Claude was logged out, Gemini had no API key, and nested Codex could not initialize inside the Codex lead sandbox. Verification tasks were also being treated as implementation tasks even when their harness already existed.

## Fix
- Treat Claude and Gemini as optional accelerators, not prerequisites.
- Never spawn nested Codex from a Codex lead; the lead itself is the Codex fallback.
- When external workers are unavailable, the lead must execute one safe bounded claimed task directly in its isolated worker worktree.
- Before creating a verification implementation lane, search for the existing harness and current shared evidence. If the harness exists, run its local-only record mode instead of rebuilding it.
- Include shared git-common evidence files in the Builder OS progress fingerprint so successful evidence refreshes count as real progress.

## Safety
Lead self-execution remains confined to claimed /private/tmp worker worktrees. Canonical remains protected. Verification-only refreshes may update shared coordination evidence only and must remain local-only with no production access.

## Acceptance
A cycle must no longer stop solely because Claude/Gemini authentication is unavailable. Existing verification harnesses should run directly, and a changed evidence snapshot must allow the cycle to finish successfully.

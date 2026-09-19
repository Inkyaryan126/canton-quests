# Grid Empire Panel health messages

## Goal

Keep cached CLI health failures concise, actionable, and safe for operators.

## TDD plan

1. Add focused tests for Claude authentication, Codex version, account/quota, and unknown-failure mappings, including raw-text redaction.
2. Add a pure formatter in `grid-builder-os.ts` with allowlisted operator messages.
3. Route nonzero live probe exits through the formatter while preserving success, timeout, and spawn behavior.
4. Verify the focused Vitest file and `git diff --check`.

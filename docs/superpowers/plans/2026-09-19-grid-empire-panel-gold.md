# The Grid Empire Panel — Gold visual checkpoint

## Scope

Visual-only refinement of the existing `/admin/grid-builder` control surface. The live status fetch, guarded start-cycle action, polling, server-derived snapshot, crew-health evidence, and responsive layout remain unchanged.

## Gold checkpoint

- Preserve the operator title `THE GRID / EMPIRE PANEL` and the primary `BUILD THE GRID` action.
- Use an obsidian/charcoal command-room surface with champagne-gold dividers, progress, score, and restrained warm glow.
- Make the hero action the strongest visual anchor while keeping disabled/working states truthful.
- Treat builder cards as operator stations with visible working, checkpoint, and attention states.
- Keep CLI crew-health cards legible and evidence-based; only live attention states receive stronger emphasis.
- Present recent progress as a readable command ledger and keep `NEEDS YOU` visually quiet when empty.
- Preserve touch-friendly mobile stacking and avoid decorative controls or external assets/dependencies.

## Verification checkpoint

- Focused check: `npx vitest run tests/grid-builder-os.test.ts`
- Formatting check: `git diff --check`
- Parent-owned follow-up: lint and browser verification at desktop and mobile sizes.

No APIs, orchestration, package files, shared globals, or files outside the lane scope are changed.

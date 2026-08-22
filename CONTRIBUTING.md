# Contributing to Canton Quests

Thank you for contributing to Canton Quests! This document outlines guidelines for human developers, quest designers, and AI coding agents working on the codebase.

---

## 1. Prerequisites & Principles

1. **Read Core Docs First**: Before contributing, review [`PROJECT-BRAIN.md`](file:///Users/inkyaryan126/Desktop/canton-quests/PROJECT-BRAIN.md), [`AGENTS.md`](file:///Users/inkyaryan126/Desktop/canton-quests/AGENTS.md), and [`DECISIONS.md`](file:///Users/inkyaryan126/Desktop/canton-quests/DECISIONS.md).
2. **Preserve Product Identity**: Features must enhance real-world city gameplay. Generic SaaS form builders or pay-to-win mechanics are strictly forbidden.
3. **Safety First**: Never create or modify quests that encourage trespassing, dangerous physical maneuvers, or traffic hazards.

---

## 2. Development Workflow

### Branch Strategy
- `main`: Production-ready, stable codebase.
- `feat/<feature-name>`: Feature branches for new functionality.
- `fix/<bug-name>`: Bug fix branches.
- `docs/<doc-name>`: Documentation updates.

### Commit Conventions
Use Conventional Commit messages:
- `feat(quest): add QR HMAC verification endpoint`
- `fix(leaderboard): resolve score calculation race condition`
- `docs(brain): update partial-weekend scoring explanation`
- `chore: update dependencies`

---

## 3. Testing & Verification Requirements

No pull request or commit will be merged without running:
```bash
# Run lint checks
npm run lint

# Run type check
npm run typecheck

# Run test suite
npm test
```

---

## 4. Architectural Decision Logs (ADRs)

If your contribution introduces a major structural change (e.g. changing database ORMs, introducing a new auth provider, altering scoring rules):
1. Create a new entry in [`DECISIONS.md`](file:///Users/inkyaryan126/Desktop/canton-quests/DECISIONS.md).
2. Record the date, rationale, alternatives evaluated, and downstream consequences.

---

## 5. Frontend Styling Standards — No Tailwind CSS

> **CRITICAL**: Canton Quests does **NOT** use Tailwind CSS utility generation.
- Never write Tailwind utility classes (`w-7`, `h-7`, `flex`, `grid`, `absolute`, `relative`, `inset-0`, `rounded-*`, `object-cover`, `shrink-0`, `text-*`, `bg-*`, `border-*`, `ring-*`, `p-*`, `m-*`, `gap-*`, etc.) unless defined in `app/globals.css`.
- Use custom CSS in `app/globals.css` with scoped `.cq-*` class naming.
- Always provide explicit `width` and `height` attributes and CSS constraints on `<img>` elements to prevent natural image blowout.

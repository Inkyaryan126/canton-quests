# Instructions & Operating Rules for AI Coding Agents

> **Mandatory Reading**: All AI coding agents (Claude, Gemini, Antigravity, GPT, Cursor, etc.) operating in this repository **MUST** read and adhere to these 20 non-negotiable rules.

---

## 20 Mandatory Agent Rules

1. **Read `PROJECT-BRAIN.md` First**: Before undertaking any non-trivial task or feature implementation, read [`PROJECT-BRAIN.md`](file:///Users/inkyaryan126/Desktop/canton-quests/PROJECT-BRAIN.md) to align with the canonical product vision.
2. **Consult Domain Guidance**: Read the specific domain documents (`GAME-SYSTEM.md`, `TECH-ARCHITECTURE.md`, `DATABASE.md`, `SAFETY-AND-RULES.md`) and specialized skills in `skills/` relevant to your active task.
3. **Do Not Silently Change Decisions**: Never modify confirmed product or technical decisions without explicit user approval.
4. **Record Architecture Changes in `DECISIONS.md`**: If a new technical or product trade-off is accepted, log it immediately in [`DECISIONS.md`](file:///Users/inkyaryan126/Desktop/canton-quests/DECISIONS.md).
5. **No Speculative Features**: Do not build hypothetical, unused abstractions or unrequested features. Build only what is needed for the active phase.
6. **Preserve Working Functionality**: Inspect existing tests and code to prevent regressions. Never break pre-existing working code.
7. **Inspect Architecture Before Modifying**: Never edit a component, API route, or database query without inspecting its surrounding context and type definitions first.
8. **Search Before Duplicating**: Always search the codebase for existing utilities, components, helper functions, or constants before writing new ones from scratch.
9. **Verify With Tests**: Always run linting, typechecking, and unit test suites (`npm run lint`, `npm test`) after modifying code.
10. **No False Claims**: Never state that a feature, test, or build is working without concrete empirical proof (logs, test outputs, execution results).
11. **Fix Root Causes**: Never patch symptoms, swallow exceptions silently, return dummy fallbacks, or comment out failing assertions to make a build pass. Fix the underlying bug.
12. **Pivot Strategy After 2 Failures**: If a fix attempt fails twice using essentially the same approach, **STOP**. Do not retry a third time. Step back, re-read logs, and execute a meaningfully different debugging strategy.
13. **Prioritize Security**: Enforce strict input validation, Row Level Security (RLS) policies, rate limiting, and authorization checks on all endpoints handling auth, submissions, location, scores, admin controls, or prizes.
14. **Never Expose Secrets**: Never hardcode API keys, service role JWTs, database credentials, or secret tokens in code or commit logs. Use `.env.example` and environment variables.
15. **Maintain Mobile-First Design**: Canton Quests is played primarily on smartphones outdoors. Every UI component must be responsive, touch-friendly, fast, and readable in bright sunlight.
16. **Avoid Premature Optimization**: Write simple, clear, readable TypeScript first. Optimize only when empirical performance metrics warrant it.
17. **Explain Changes Clearly**: Provide clear summaries of altered files, rationale, known risks, and verification evidence in completion reports.
18. **Protect Core Code & Docs**: Do not delete large systems, configuration files, or documentation without understanding their complete purpose and dependency graph.
19. **Boring Infrastructure, Creative Experience**: Build rock-solid, predictable, standard infrastructure (auth, DB, routing) where reliability matters, and unleash high creativity where player experience, story, and fun matter.
20. **FUN Is a Hard Requirement**: The fun, mystery, and excitement of Canton Quests is a core product requirement, not an optional visual decoration. If a feature feels boring or bureaucratic, refine it.
21. **CRITICAL FRONTEND RULE — CANTON QUESTS DOES NOT USE TAILWIND**:
    Never use Tailwind utility classes such as:
    `w-*`, `h-*`, `flex`, `grid`, `absolute`, `relative`, `inset-*`, `rounded-*`, `object-*`, `shrink-*`, `text-*`, `bg-*`, `border-*`, `ring-*`, `p-*`, `m-*`, `gap-*`
    unless the exact class is already defined in the project's compiled/custom CSS.

    Canton Quests uses custom CSS in `app/globals.css` and scoped CQ-prefixed classes (`.cq-*`).

    For new visual elements:
    - Create explicit CQ-prefixed CSS classes
    - Use real CSS properties in `app/globals.css`
    - Provide explicit `width`/`height` attributes and min/max constraints on images when dimensions matter
    - Do not assume Tailwind exists
    - Do not introduce Tailwind without an explicit project-wide migration decision

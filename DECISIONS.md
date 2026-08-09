# Canton Quests — Architecture & Product Decision Log (ADRs)

---

## Decision Record Format

Each entry follows the standard ADR structure:
- **Date**: YYYY-MM-DD
- **Decision**: Concise title of the decision.
- **Reason**: Rationale and underlying problem being addressed.
- **Alternatives Evaluated**: Options considered before deciding.
- **Consequences**: Downstream impacts, trade-offs, or constraints created.
- **Status**: `PROPOSED`, `ACCEPTED`, `SUPERSEDED`, or `REJECTED`.

---

## ADR-001: Launch Location Selection
- **Date**: 2026-08-09
- **Decision**: Canton, Ohio is confirmed as the initial launch city and testing ground for Canton Quests.
- **Reason**: Canton provides a rich mix of walkable downtown arts districts, historic landmarks (McKinley Monument, Pro Football Hall of Fame heritage), active local business networks, and manageable geographic scale ideal for refining a real-world game engine.
- **Alternatives Evaluated**: Generic virtual sandbox, large metropolis (Chicago/NYC) with high noise/cost barriers.
- **Consequences**: Initial quest content, spatial bounding boxes, and merchant partnerships will focus exclusively on Canton.
- **Status**: **ACCEPTED**

---

## ADR-002: Product Identity — City Game vs. Scavenger Hunt SaaS
- **Date**: 2026-08-09
- **Decision**: Canton Quests is engineered and branded as an immersive, real-world city game layered over Canton, NOT as a white-label B2B scavenger hunt SaaS application.
- **Reason**: Scavenger hunt software is a commoditized, sterile utility. Canton Quests succeeds by creating excitement, mystery, community events, and real-world urban adventure.
- **Alternatives Evaluated**: Building a white-label SaaS form builder for corporate retreats.
- **Consequences**: All UX patterns, copy, visual styling, and event features must maintain an urban adventure feel. Generic SaaS templates are prohibited.
- **Status**: **ACCEPTED**

---

## ADR-003: Multi-Category Scoring for Partial-Weekend Player Equity
- **Date**: 2026-08-09
- **Decision**: Implement a multi-category scoring engine (e.g. Single-Day Saturday Sprint, Master Decoder, Local Explorer) alongside overall weekend point totals.
- **Reason**: Awarding victory strictly to whoever plays for 48 consecutive hours alienates casual players, couples, families, and players available for only one day.
- **Alternatives Evaluated**: Single cumulative weekend points leaderboard.
- **Consequences**: Leaderboard backend and UI must present category rankings clearly so partial-weekend players have meaningful, achievable goals.
- **Status**: **ACCEPTED**

---

## ADR-004: Architecture Prepared for Eventual Multi-City Expansion
- **Date**: 2026-08-09
- **Decision**: Architect database schemas and API routes to isolate city-specific configuration (`cities` table, spatial boundaries) from core game engine logic.
- **Reason**: Prevents technical debt and hardcoded assumptions when expanding to future cities (*Akron*, *Cleveland*, etc.) after Canton's launch.
- **Alternatives Evaluated**: Hardcoding Canton geography directly in application code.
- **Consequences**: All database tables require `city_id` or `event_id` foreign keys; map view components accept dynamic spatial boundary parameters.
- **Status**: **ACCEPTED**

---

## ADR-005: Safety Embedded Into Quest Architecture
- **Date**: 2026-08-09
- **Decision**: Safety parameters (curfew hours, speed locks, public boundary checks) are enforced programmatically in quest design and verification services.
- **Reason**: Real-world gameplay creates inherent physical risks. Disclaimers alone are insufficient; the system must actively prevent hazardous quests.
- **Alternatives Evaluated**: Relying solely on a TOS waiver signed during account creation.
- **Consequences**: Quests undergo mandatory automated and manual safety checks before publishing; app locks out verification when moving >15 mph.
- **Status**: **ACCEPTED**

---

## ADR-006: Non-Pay-To-Win Monetization Policy
- **Date**: 2026-08-09
- **Decision**: Microtransactions that sell points, leaderboard positioning, or quest skips are permanently banned. Monetization is limited to ticket passes, physical swag, sponsor quest activations, and private event packages.
- **Reason**: Pay-to-win mechanics destroy competitive integrity, community trust, and player motivation.
- **Alternatives Evaluated**: Selling hint packs or point boosters.
- **Consequences**: Revenue models focus on ticket tiers, merchant partner packages, and sponsor activations.
- **Status**: **ACCEPTED**

---

## ADR-007: Folder Naming Convention (`canton-quests`)
- **Date**: 2026-08-09
- **Decision**: Use kebab-case `canton-quests` for the physical filesystem directory and repository name, while displaying human-readable "Canton Quests" across documentation, brand titles, and UI text.
- **Reason**: Kebab-case avoids whitespace escaping issues across POSIX terminals, Git tools, npm packages, Docker build steps, and CI/CD automation pipelines.
- **Alternatives Evaluated**: Folder with spaces (`Canton Quests`).
- **Consequences**: Directory operations use `canton-quests`; code metadata (`package.json`) uses `"name": "canton-quests"`.
- **Status**: **ACCEPTED**

# Canton Quests

> **A real-world, city-scale game layered over Canton, Ohio.**

Canton Quests transforms the city of Canton into an interactive, real-world gaming playground. Blending elements of citywide treasure hunts, reality competition shows, alternate reality games (ARGs), local business partnerships, and community festivals, Canton Quests delivers exciting weekend events where the entire city becomes part of the game world.

---

## 🚦 Project Status: Phase 0 (Foundation)

This repository is currently in **Phase 0 — Foundation**. No production code, live databases, or third-party integrations have been built yet. The goal of this phase is to establish absolute clarity on game philosophy, technical architecture, safety protocols, database schemas, and AI agent instructions before writing application code.

---

## 🎯 What is Canton Quests?

Canton Quests is **NOT** merely a generic scavenger hunt SaaS product. It is a living, physical-digital game layered over Canton, Ohio.

When people hear *"Canton Quests is happening this weekend,"* they understand that:
- Hidden clues, QR codes, and mystery checkpoints are active across Canton.
- Local businesses are hosting special quest objectives and secret passphrase drops.
- Flash events, pop-up challenges, and secret storylines are unfolding in real time.
- Players of all commitment levels—from 2-hour casual explorers to full-weekend competitive teams—are out in the city participating.

---

## 📚 Project Documentation Map

All core documentation lives in the root directory and `docs/` for maximum visibility across developers and AI tools:

| Document | Description |
| :--- | :--- |
| [`PROJECT-BRAIN.md`](file:///Users/inkyaryan126/Desktop/canton-quests/PROJECT-BRAIN.md) | **Canonical source of truth**: Vision, core philosophy, non-negotiable anti-goals, terminology, and high-level product design. |
| [`GAME-SYSTEM.md`](file:///Users/inkyaryan126/Desktop/canton-quests/GAME-SYSTEM.md) | Game engine mechanics: Events, weekends, scoring systems, partial-weekend player mechanics, leaderboards, quest chains, and finales. |
| [`PLAYER-JOURNEY.md`](file:///Users/inkyaryan126/Desktop/canton-quests/PLAYER-JOURNEY.md) | 14-stage lifecycle of player experience from discovery to post-event retention across casual, hardcore, solo, and team personas. |
| [`QUEST-DESIGN.md`](file:///Users/inkyaryan126/Desktop/canton-quests/QUEST-DESIGN.md) | Quest design taxonomy, evaluation rubrics (FUN, SAFETY, CLARITY, etc.), anti-patterns, and quest templates. |
| [`WORLD-BUILDING.md`](file:///Users/inkyaryan126/Desktop/canton-quests/WORLD-BUILDING.md) | Framework for making Canton feel like a living game world: Factions, lore drops, secret symbols, and evolving mythology. |
| [`BUSINESS-MODEL.md`](file:///Users/inkyaryan126/Desktop/canton-quests/BUSINESS-MODEL.md) | Non-pay-to-win business model, local merchant integration, sponsor quest packages, event passes, and tourism partnerships. |
| [`BRAND.md`](file:///Users/inkyaryan126/Desktop/canton-quests/BRAND.md) | Brand identity, typography, visual aesthetics (mysterious, urban, adventurous), voice, tone, and visual guidelines. |
| [`SAFETY-AND-RULES.md`](file:///Users/inkyaryan126/Desktop/canton-quests/SAFETY-AND-RULES.md) | Strict real-world safety policies: Trespassing, night rules, traffic safety, minor protection, and location restrictions. |
| [`TECH-ARCHITECTURE.md`](file:///Users/inkyaryan126/Desktop/canton-quests/TECH-ARCHITECTURE.md) | Technical stack (Next.js, TypeScript, Supabase, Tailwind/CSS), PWA & mobile-first strategy, geolocation, and anti-cheat design. |
| [`DATABASE.md`](file:///Users/inkyaryan126/Desktop/canton-quests/DATABASE.md) | Comprehensive entity-relationship schema specification for Supabase/PostgreSQL. |
| [`ROADMAP.md`](file:///Users/inkyaryan126/Desktop/canton-quests/ROADMAP.md) | Multi-phase development roadmap from Phase 0 Foundation to Phase 7 Multi-City Expansion. |
| [`DECISIONS.md`](file:///Users/inkyaryan126/Desktop/canton-quests/DECISIONS.md) | Architecture & Product Decision Log (ADRs) tracking rationale, trade-offs, and status. |
| [`CONTRIBUTING.md`](file:///Users/inkyaryan126/Desktop/canton-quests/CONTRIBUTING.md) | Developer guidelines, code style, commit standards, and pull request procedures. |
| [`AGENTS.md`](file:///Users/inkyaryan126/Desktop/canton-quests/AGENTS.md) | **Mandatory instructions for AI coding agents** working in this repository. |

---

## 🤖 Rules for AI Coding Agents

If you are an AI assistant working on this codebase:
1. **Always read [`PROJECT-BRAIN.md`](file:///Users/inkyaryan126/Desktop/canton-quests/PROJECT-BRAIN.md) and [`AGENTS.md`](file:///Users/inkyaryan126/Desktop/canton-quests/AGENTS.md)** before performing any non-trivial code modifications.
2. **Consult domain skills** in [`skills/`](file:///Users/inkyaryan126/Desktop/canton-quests/skills) for role-specific guidance (`fullstack-engineer.md`, `quest-designer.md`, `database-engineer.md`, etc.).
3. **Never break the core vision**: Canton Quests is a real-world city adventure, not a generic SaaS scavenger hunt.
4. **Enforce safety & anti-pay-to-win**: Never generate features or quests that compromise physical safety or allow players to buy leaderboard placement.
5. **Inspect before editing**: Verify existing directory structures, components, and schema definitions before creating new files.

---

## 🚀 Getting Started (Developers)

### Prerequisites
- Node.js 20.x+
- npm 10.x+

### Setup
```bash
# Clone repository
git clone https://github.com/canton-quests/canton-quests.git
cd canton-quests

# Install dependencies
npm install

# Run local development server
npm run dev

# Run test suite
npm test
```

---

## 📄 License

Copyright © Canton Quests. All rights reserved. Proprietary software & intellectual property.

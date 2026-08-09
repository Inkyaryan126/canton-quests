# Canton Quests — Phased Product Roadmap

---

## Roadmap Overview

Development of Canton Quests follows a strictly gated, 8-phase execution methodology. Progression between phases requires meeting explicit validation gates to ensure system stability, player safety, and real-world game fun.

```
[Phase 0: Foundation] ──> [Phase 1: Playable MVP] ──> [Phase 2: Internal Test Game]
          │
[Phase 3: Small Beta] ──> [Phase 4: 1st Public Event] ──> [Phase 5: Sponsor Expansion]
          │
[Phase 6: Advanced Systems] ──> [Phase 7: Multi-City Platform]
```

---

## 🚩 Phase 0 — Foundation (CURRENT PHASE)
- **Primary Focus**: Architectural specification, documentation brain, game philosophy, AI agent guidelines, and repository shell setup.
- **Key Outcomes**:
  - ✅ Repository initialized with complete documentation matrix.
  - ✅ Core game engine philosophy & non-punitive scoring model defined.
  - ✅ Safety protocols and trespassing guidelines established.
  - ✅ Database entity schema specified for Supabase/PostgreSQL.
  - ✅ AI Agent instructions configured in `AGENTS.md` and `skills/`.
  - ✅ Starter Next.js/TypeScript app shell established.

---

## 🏃 Phase 1 — Playable MVP
- **Primary Focus**: Core user authentication, simple PWA dashboard, basic quest rendering, QR code scanning, and single-category leaderboard.
- **Key Outcomes**:
  - Supabase Auth (SMS/Email magic link) working on mobile web.
  - Interactive map displaying pins for 5 sample test quests in Canton.
  - HTML5 QR camera scanner verifying target codes.
  - Basic real-time score updates and player profile display.

---

## 🧪 Phase 2 — Internal Test Game
- **Primary Focus**: Closed test run with 10–15 internal team members across downtown Canton.
- **Key Outcomes**:
  - Test 3 quest types: QR Exploration, Text Cipher, and Photo Proof submission.
  - Evaluate cellular network reliability and GPS precision near historic Canton structures.
  - Gather qualitative feedback on quest difficulty, hint clarity, and camera speed.
  - Stress-test admin submission verification dashboard.

---

## 🌇 Phase 3 — Small Canton Beta
- **Primary Focus**: Invited beta test involving 50–100 local Canton participants and 3 partner local businesses.
- **Key Outcomes**:
  - Validate team creation/join flow using 4-character invite codes.
  - Test local merchant counter passphrase verification (e.g. coffee shop quest step).
  - Verify multi-category scoring engine (Saturday Sprint vs Grand Champion).
  - Run first live Flash Quest drop via SMS/push notification.

---

## 🏆 Phase 4 — First Public Canton Quest Weekend
- **Primary Focus**: *Canton Quests: Volume 1 — The Founder's Cipher* (300+ public participants across Friday–Sunday).
- **Key Outcomes**:
  - Execute full weekend lifecycle from Friday launch to Sunday Finale.
  - Award physical category trophies, local business gift cards, and official pins.
  - Validate real-time leaderboard curtain blackout during final 2 hours.
  - Capture promotional photo/video content for social proof.

---

## 🤝 Phase 5 — Sponsor & Business Expansion
- **Primary Focus**: Formalize merchant self-service onboarding portal, corporate team-building packages, and sponsor quest integrations.
- **Key Outcomes**:
  - Merchant dashboard allowing Canton business owners to view foot-traffic analytics and issue custom perks.
  - VIP ticket tier launch with physical swag kit fulfillment.
  - Title sponsor co-branding capabilities integrated into PWA.

---

## 🔮 Phase 6 — Advanced Game Systems
- **Primary Focus**: Deep narrative features, live actor/NPC chat integration, 3D collectible viewer, and automated anti-cheat anomaly detection.
- **Key Outcomes**:
  - Interactive 3D artifact inspection in mobile browser.
  - Branching quest choices that permanently alter seasonal narrative arcs.
  - Automated GPS spoofing and speed-anomaly detection system.

---

## 🌐 Phase 7 — Multi-City Platform
- **Primary Focus**: Expand core platform to additional mid-sized cities (*Akron Quests*, *Cleveland Quests*, etc.).
- **Key Outcomes**:
  - Multi-tenant city selector interface.
  - Automated quest-building toolkit for regional event directors.
  - Global cross-city player profile ranking and hall of fame.

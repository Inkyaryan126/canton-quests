# CANTON QUESTS — FOUNDER'S CIPHER LEGACY QUEST CONTAINMENT & MIGRATION PLAN
## Phase 2 Architecture Deliverable (Task 7)

**Author**: ANTIGRAVITY (Lead Builder / AI Boardroom)  
**Date**: August 31, 2026  
**Status**: APPROVED CONTAINMENT SPECIFICATION (Zero Destructive Deletion)  
**Governing Documents**: `docs/FOUNDERS-CIPHER-GAME-ARCHITECTURE.md`, `GAME-SYSTEM.md`, `TECH-ARCHITECTURE.md`, `DECISIONS.md`

---

## 1. Executive Summary & Core Policy

Under Boardroom Safety Rules and Task 7 requirements:
1. **No Destructive Cleanup**: No database rows or historical seed records will be deleted.
2. **No Premature Deactivation**: Legacy quest rows remain in the seed data and repository until the canonical 14 field quest replacements are fully seeded with verified field parameters in Phase 3.
3. **Strict Containment Classification**: Every legacy quest in the repository is explicitly inventoried and assigned a migration disposition (`REUSED`, `SUPERSEDED`, `INACTIVE`, `ARCHIVED`, or `RETAINED_FOR_HISTORY`).
4. **Drawing Entry Preservation**: All drawing entries earned from verified field quests remain strictly intact (1 verified quest = 1 drawing entry).

---

## 2. Comprehensive Legacy Quest Inventory & Classification

| Quest ID | Current Title | Current Status / Role | Target Disposition | Target Replacement / Mapping | Rationale & Containment Action |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `qst-centennial-discovery` | The Founder's Footsteps | `active` / Family check-in | **REUSED** (as Q01) | Canonical Quest 01: Bell Cipher (Family) | Reused at Centennial Plaza; updated to Bell Cipher extraction awarding `THE WORD` Lock. |
| `qst-mckinley-cipher` | The Saxton Gallery Secret | `active` / Family cipher | **REUSED** (as Q02) | Canonical Quest 02: Canton Sign Capture | Reused for Arts Fragment 1 `[A NAME]`. |
| `qst-4th-st-mural-photo` | Fourth Street Perspective | `active` / Family photo | **REUSED** (as Q03) | Canonical Quest 03: Draft Lineup | Reused for Arts Fragment 2 `[OUTLIVES]`. |
| `qst-aura-coffee-qr` | The Barista's Signal | `active` / Family QR | **SUPERSEDED** | Canonical Quest 04: Kraken Wall | Replaced by Kraken Wall mural observation for Arts Fragment 3 `[THE MAN]`. |
| `qst-arcade-high-score-video` | Milestone Vector | `active` / Family video | **SUPERSEDED** | Canonical Quest 05: Palace Check-In | Replaced by Palace Theatre check-in (Optional Anomaly A). |
| `qst-palace-theatre-year` | Palace of Echoes | `active` / Challenge intro | **REUSED** (as Q06) | Canonical Quest 06: The Mural | Reused for Challenge Fragment 1 `[THE WORLD]`. |
| `qst-market-square-flash` | The Market Square Drop | `active` / Flash drop | **SUPERSEDED** | Retained for GM flash drops | Historical flash drop; not part of canonical 14 baseline. |
| `qst-onesto-brass-motto` | The Grand Onesto's Motto | `active` / Challenge extraction | **REUSED** (as Q07) | Canonical Quest 07: The Tower | Reused for Challenge Lock `THE CODE`. |
| `qst-hof-legend-qr` | The Legend's Gate | `active` / Challenge QR | **SUPERSEDED** | Canonical Quest 08: Skate Park Check-In | Replaced by 9th Street Skate Park check-in (Optional Anomaly B). |
| `qst-frankenstein-west-lawn` | Frankenstein's Quiet Signal | `active` / Spoiler quest | **INACTIVE / SUPERSEDED** | Canonical Master Cipher Finale Objective | **CRITICAL CONTAINMENT**: Prematurely revealed Frankenstein monument before cipher convergence. Inactivated upon Phase 3 cutover; converted to endgame objective reveal. |
| `qst-watchers-first` | The First Watchers | `active` / Linear Ch 2 | **INACTIVE / ARCHIVED** | Replaced by free-order anomalies | **CRITICAL CONTAINMENT**: Linear prerequisite chain at West Lawn Cemetery violating free-order rule and cemetery safety. Inactivated upon Phase 3 cutover; archived for October Watchers event lore. |
| `qst-watchers-silent-court` | The Watchers' Silent Court | `active` / Linear Ch 3 | **INACTIVE / ARCHIVED** | Replaced by free-order anomalies | **CRITICAL CONTAINMENT**: Linear cemetery chain awarding `THE WORD`. Inactivated upon Phase 3 cutover; archived for October event. |
| `qst-watchers-lost` | The Lost Ledger | `active` / Linear Ch 4 | **INACTIVE / ARCHIVED** | Replaced by free-order anomalies | Linear bonus chain. Inactivated upon Phase 3 cutover. |
| `qst-secret-cipher-77` | The Founder's Three Locks | `active` / Standalone endgame | **SUPERSEDED** | Canonical Master Cipher Engine (`lib/finale.ts`) | **CRITICAL CONTAINMENT**: Legacy standalone quest attempting to act as endgame. Superseded by the unified Master Cipher gate requiring 3 Locks + 3 Sigils. Inactivated upon Phase 3 cutover. |
| `qst-founders-secret-clue` | The Founder's Whisper | `active` / Secret intro | **REUSED** (as Q11) | Canonical Quest 11: The Eternal Flame | Reused for Secret Fragment 1 `[THE DEAD]`. |
| `qst-palace-flash-popup` | The Palace Intercept | `active` / Flash drop | **SUPERSEDED** | Retained for GM flash drops | GM live-event flash tool. |
| `qst-civic-seal-photo` | The Seal of Canton | `active` / Secret photo | **REUSED** (as Q12) | Canonical Quest 12: Monument Park | Reused for Secret Fragment 2 `[KEEP IT]`. |
| `qst-9th-street-opening` | 9th Street Signal | `active` / Secret QR | **REUSED** (as Q13) | Canonical Quest 13: The Golden Mark | Reused for Secret Lock `THE MARK`. |
| `qst-challenge-open-ground` | The Open Ground | `active` / Challenge | **REUSED** (as Q09) | Canonical Quest 09: The Open Ground | Reused for Challenge Fragment 2 `[GAVE A MONSTER]`. |
| `qst-challenge-the-tower` | The Tower | `active` / Challenge | **REUSED** (as Q07) | Canonical Quest 07: The Tower | Silo architectural tier extraction awarding `THE CODE`. |
| `qst-challenge-the-mural` | The Mural | `active` / Challenge | **REUSED** (as Q06) | Canonical Quest 06: The Mural | Mother Goose mural observation awarding `[THE WORLD]`. |
| `qst-goose-land-cipher` | Mother Goose Land Cipher | `active` / Challenge | **REUSED** (as Q10) | Canonical Quest 10: Willie the Whale | Reused for Challenge Fragment 3 `[HIS NAME]`. |
| `qst-challenge-blue-signal` | Blue Signal (C1) | `active` / Linear C1 | **SUPERSEDED / INACTIVE** | Canonical 14 Free-Order Roster | Prototype linear Storybook chain C1. Removed prerequisite dependency; superseded. |
| `qst-challenge-storybook-witness` | Storybook Witness (C2) | `active` / Linear C2 | **SUPERSEDED / INACTIVE** | Canonical 14 Free-Order Roster | Prototype linear Storybook chain C2. Prerequisite removed; superseded. |
| `qst-challenge-what-survived` | What Survived (C3) | `active` / Linear C3 | **SUPERSEDED / INACTIVE** | Canonical 14 Free-Order Roster | Prototype linear Storybook chain C3. Prerequisite removed; superseded. |
| `qst-challenge-the-lost-page` | The Lost Page (C4) | `active` / Linear C4 | **SUPERSEDED / INACTIVE** | Canonical 14 Free-Order Roster | Prototype linear Storybook chain C4. Prerequisite removed; superseded. |
| `qst-grand-finale-cipher` | Grand Finale Cipher | `active` / Prototype finale | **SUPERSEDED** | Canonical Master Cipher Engine | Prototype finale quest replaced by server-authoritative `/api/game/finale` endpoint. |

---

## 3. Five-Category Containment Taxonomies

### A. REUSED / ADAPTED (10 Quests)
Quests whose physical locations, landmark relevance, and gameplay assets align directly with the canonical 14:
- Adapted to the non-linear 14-quest free-order architecture.
- Re-assigned to their exact canonical role (Founder Lock, District Fragment 1–3, or Optional Anomaly).
- Field parameters verified during Section O site walk before live activation.

### B. SUPERSEDED (8 Quests)
Quests that were early drafts, duplicated concepts, or prototype chains (e.g. C1–C4 linear chain, prototype `qst-grand-finale-cipher`):
- Kept active during Phase 2 to prevent breaking current test suites.
- Replaced 1-for-1 when Phase 3 seeds the canonical 14.
- All foreign keys and historical submissions preserved.

### C. INACTIVE (4 Quests)
Quests that violate core design laws (spoilers, forced cemetery chains, competing endgame shortcuts):
- `qst-frankenstein-west-lawn` (spoils endgame destination).
- `qst-watchers-first`, `qst-watchers-silent-court`, `qst-watchers-lost` (forced cemetery chain).
- `qst-secret-cipher-77` (competing standalone lock quest).
- Transitioned to `status: 'inactive'` at the exact moment Phase 3 seeds the canonical 14.

### D. ARCHIVED (October Campaign Lore)
Content from the Watchers cemetery chain preserved in game lore files (`lib/gameplay/lore/`):
- Repurposed as background lore transmissions and narrative seeds for the October Halloween campaign.
- Never exposed as active daytime field quests for Volume 1.

### E. RETAINED FOR HISTORY (Immutable Ledgers)
All player progress, submissions, drawing entries, and reward grants:
- Retained in `quest_submissions`, `reward_grants`, and `drawing_entry_ledger`.
- Zero row deletion, preserving full auditability.

---

## 4. Phased Cutover Procedure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 2: ENGINE RECONCILIATION (CURRENT)                                    │
│ • Database schema and game engines accept ready_to_decode state             │
│ • Master Cipher gate requires 3 Locks + 3 Decoded Sigils                   │
│ • Legacy quest rows remain active in seed data to preserve existing tests   │
│ • Containment plan codified and approved                                    │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 3: CANONICAL 14 FIELD SEEDING & PHYSICAL FIELD LOCK                   │
│ • Section O physical site walk completed                                   │
│ • Canonical 14 quests seeded with verified coordinates and answers          │
│ • 9 Fragment definitions + 3 Founder Lock allocations bound                 │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 3 CUTOVER GATE: ZERO-DOWNTIME STATUS TRANSITION                       │
│ 1. Canonical 14 quests inserted as status = 'active'                        │
│ 2. Legacy conflicting quests updated to status = 'inactive'                 │
│ 3. Zero rows deleted; all existing drawing entries preserved                │
│ 4. Full test suite updated to assert 14 free-order quests                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Risk Assessment & Verification Checkpoints

1. **Foreign Key Integrity**:
   No `DELETE` statements will be executed against `quests`. All legacy quest IDs remain valid foreign keys for existing `quest_submissions` and `reward_grants`.
2. **Drawing Math Stability**:
   Every completed quest continues to grant exactly 1 drawing entry. Transitioning legacy quests to `inactive` does not alter existing ledger balances.
3. **No Unverified Hard-Coding**:
   No physical coordinates, monument inscriptions, or gate hours will be hard-coded into production until verified via the physical site-walk.

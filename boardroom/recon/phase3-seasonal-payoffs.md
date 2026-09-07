# Phase 3 Recon: Seasonal Payoffs — Frankenstein's Grave & Watchers Halloween Tease

## Executive Summary
This task applied the canonical Phase 2 presentation primitives (`TransmissionPanel`, `SystemStatusBadge`, `HudSystemState`, `TransmissionLoader`, `VerificationResult`, `CqTransition`) to two contained seasonal moments:
1. **Frankenstein's Grave Quest Payoff** (`qst-frankenstein-west-lawn` in `lib/seed-data.ts`, `components/game-effects/FrankensteinPayoffCard.tsx`)
2. **Watchers Halloween Tease** (`lib/watchers.ts`, `components/game-effects/WatcherHalloweenTeaseCard.tsx`, `components/landing/SecretLanding.tsx`)

Both implementations rely entirely on the established Phase 2 design system rather than one-off styling, preserve all underlying game rules, and maintain 100% backward compatibility with existing tests.

---

## 1. Moment 1: Frankenstein's Grave Quest Payoff (`lib/seed-data.ts`)

### Changes Applied:
- **`lib/seed-data.ts`**:
  - Configured canonical `commanderTransmission` on `qst-frankenstein-west-lawn` (`WEST LAWN ARCHIVE // PROTOCOL`), providing respectful cemetery conduct framing and mission instructions.
  - Configured canonical `completionTransmission` (`SIGNAL INTERCEPT // WATCHER W-01`), delivering the narrative climax:
    - Commander verification interrupted by an unidentified signal signature
    - Watcher W-01 transmission: *"You found the grave. We noticed, operative. You weren't the only one following the trail. WATCHER SIGNAL W-01: DORMANT // REACTIVATION: OCTOBER. We'll be watching."*
    - Canonical CTA: `ACKNOWLEDGE SIGNAL`
- **`components/game-effects/FrankensteinPayoffCard.tsx`**:
  - Reusable presentation component composing `TransmissionPanel` (tone: `purple`), `SystemStatusBadge`, `HudSystemState`, `VerificationResult`, and `CqTransition`.
  - Supports interactive toggle between the initial Commander record and the Watcher signal interrupt.

### Non-Regressive Guarantees:
- `rewardConfig` remains `undefined` on `qst-frankenstein-west-lawn`, preventing premature finale bypass.
- Verification type (`photo`), point value (200 XP, 1 entry), and safety notes remain unmodified.

---

## 2. Moment 2: Watchers Halloween Tease (`lib/watchers.ts`, `SecretLanding.tsx`)

### Changes Applied:
- **`lib/watchers.ts`**:
  - Defined `WatcherHalloweenTease` type and `WATCHER_HALLOWEEN_TEASE` payload with `signalId: 'W-01'`, status: `'DORMANT'`, reactivation: `'OCTOBER'`, headline: `'WATCHER FREQUENCY DORMANT // REACTIVATION: OCTOBER'`, and structured transmission payload.
  - Exported `getWatcherHalloweenTease()` helper function.
  - Preserved `WatcherTriggerSource`, `WatcherEligibilityRecord`, and `WatcherStatus` unchanged.
- **`components/game-effects/WatcherHalloweenTeaseCard.tsx`**:
  - New component applying Phase 2 primitives (`TransmissionPanel` with `tone="purple"`, `SystemStatusBadge`, `HudSystemState`, `TransmissionLoader`, `VerificationResult`, `CqTransition`).
  - Mobile-first, responsive, and honors OS/app `reducedMotion` settings via `useReducedMotion()`.
  - Features interactive signal testing with deterministic decode-bar loading (`TransmissionLoader`) and confirmed verification result (`VerificationResult`).
- **`components/landing/SecretLanding.tsx`**:
  - Replaced ad-hoc hero badge with `HudSystemState state="armed" label="CLASSIFIED ENTRY // UNLISTED SIGNAL"`.
  - Replaced bespoke coordinate decryption section with `TransmissionPanel tone="purple"`, `SystemStatusBadge`, `VerificationResult`, and `CqTransition`.
  - Replaced raw article containers for Dossiers 01–03 with `TransmissionPanel tone="purple"`.
  - Integrated dedicated `WatcherHalloweenTeaseCard` section under "THE OCTOBER WATCHERS PREVIEW".
  - Preserved all required evergreen landing page content, headlines, and CTAs (`/events/canton-weekend-1/quests`).

---

## 3. Verification & Test Evidence
- `tests/seasonal-payoffs-presentation.test.tsx` (12 tests passing):
  - Validates Frankenstein quest transmissions and payoff card.
  - Validates Watchers Halloween tease foundation types and constants.
  - Validates `WatcherHalloweenTeaseCard` rendering and Phase 2 primitive imports.
  - Validates `SecretLanding` integration and Phase 2 primitive composition.
- Existing regression suites:
  - `tests/evergreen-acquisition-landing-pages.test.ts` (16 tests passing).
  - `tests/watchers-foundation.test.ts` (10 tests passing).
  - `tests/hud-system-states.test.tsx` (23 tests passing).
  - `tests/transmission-presentation-primitives.test.ts` (18 tests passing).

# Canton Quests Phase 2 — HUD States, Cinematic Transitions & Interaction Feedback

**Phase:** Phase 2 · Core Experience System  
**Document Type:** Boardroom Recon Architecture & Decision Log  
**Date:** 2026-09-06  
**Status:** Implemented & Verified  

---

## 1. Executive Summary & Design Rationale

Canton Quests is played primarily on mobile devices outdoors under direct sunlight across Canton, Ohio. Prior to Phase 2, interaction feedback and loading states relied on disparate spinners and ad-hoc CSS transitions. Furthermore, particle-heavy canvas overlays were loaded eagerly on all routes, unnecessarily bloating initial bundle payloads.

Phase 2 establishes a unified, covert-ops command terminal design system:
1. **Covert-Ops HUD States**: Canonical status pills (`armed`, `scanning`, `confirmed`, `denied`) via `SystemStatusBadge` and `HudSystemState`, replacing generic loading spinners.
2. **Deterministic Motion Tokens**: Defined in `app/globals.css` with CSS custom properties (`--cq-motion-*`), providing crisp tactical feedback that automatically collapses to instant transitions under `prefers-reduced-motion`.
3. **Lazy-Loaded Cinematic Overlays**: 12 particle-intensive game moment overlays in `components/game-effects/GameMomentOverlay.tsx` are dynamically imported with `{ ssr: false }`, ensuring heavy WebGL/Canvas bundles are loaded only on demand while rendering a covert-ops scanning HUD fallback during chunk retrieval.
4. **Zero-Tailwind Rule (Rule 21)**: All newly authored styles strictly use `.cq-*` prefixed classes in `app/globals.css`, introducing zero Tailwind utility classes.
5. **Durable Audio & Haptic Synchronization**: A single reactive sound preference store via `useSyncExternalStore` on `cqSoundManager`, coupled with an opt-in, non-blocking haptic pulse (`confirmHaptic`).

---

## 2. Token Architecture & Motion System

### CSS Motion Tokens (`app/globals.css`)

CSS serves as the single source of truth for all animation timing and easings. No JavaScript animation loop or scheduler is introduced:

```css
.cq-motion-scope,
.cq-transition-reveal,
.cq-transition-settle {
  --cq-motion-instant: 0ms;
  --cq-motion-press: 100ms;
  --cq-motion-settle: 180ms;
  --cq-motion-reveal: 280ms;
  --cq-motion-ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --cq-motion-ease-enter: cubic-bezier(0, 0, 0.2, 1);
  --cq-motion-ease-exit: cubic-bezier(0.4, 0, 1, 1);
}
```

### Motion Primitives

- `.cq-transition-reveal`: Used for card and overlay entry transitions (`opacity` and `transform: translateY(10px)`). Becomes visible via `.is-visible`.
- `.cq-transition-settle`: Used for in-place state transitions (such as status badge transitions and toggle controls).
- `@media (prefers-reduced-motion: reduce)`: Automatically zeros out motion durations (`var(--cq-motion-instant)`), removes translation offsets, and stops continuous spinning animations.

### JS Motion Primitives (`lib/motion/index.ts`)

- `prefersReducedMotion()`: Safe helper for non-browser/SSR environments and reactive browser queries.
- `useReducedMotion()`: Synchronized React hook tracking OS reduced-motion state changes.
- `confirmHaptic()`: Opt-in, non-blocking 12ms haptic confirmation pulse (`navigator.vibrate(12)`), strictly suppressed when reduced motion is preferred or unsupported.

---

## 3. HUD System State Components

### `SystemStatusBadge.tsx`

Located at `components/game-effects/SystemStatusBadge.tsx`.

Implements the 4 covert-ops terminal states:
- **`armed`**: Amber badge with `Shield` icon and "ARMED" label.
- **`scanning`**: Cyan badge with `Radar` icon and "SCANNING..." label, spinning continuously (suppressed under reduced motion).
- **`confirmed`**: Emerald badge with `CheckCircle2` icon and "CONFIRMED" label.
- **`denied`**: Crimson badge with `ShieldAlert` icon and "DENIED" label.

Supports:
- `label?: string` override for specific tactical mission copy (e.g., "14 TARGETS ONLINE", "LOCKING PROTOCOL...").
- `size?: 'sm' | 'md'` for compact in-card badges versus prominent modal headers.
- `className?: string` for custom layout placement.

### `HudSystemState.tsx`

Located at `components/game-effects/HudSystemState.tsx`.

Accessible wrapper component providing:
- `role="status"` and `aria-live="polite"` for non-disruptive screen reader announcements.
- `data-state` and `data-reduced-motion` DOM attributes for CSS state binding and integration testing.
- Optional `detail` slot rendering `.cq-hud-system-state-detail`.

### `CqTransition.tsx` (re-exported as `HudTransition`)

Located at `components/game-effects/CqTransition.tsx`.

Lightweight container applying `.cq-transition-reveal` with `show` toggling `.is-visible`. When `reducedMotion` is passed, inline style overrides `transition: none` and `opacity: 1`.

---

## 4. Subsystem Integration & Call Sites

### 1. `CityScanOverlay.tsx`
- Replaced custom scanner label with `SystemStatusBadge`.
- Shows `status="scanning"` during sector grid ping, transitioning to `status="confirmed"` when objectives are acquired.
- Wraps scanner pod in `CqTransition` with `reducedMotion` prop forwarding.

### 2. `PathLockEffect.tsx`
- Employs `SystemStatusBadge` with `stage === 'locking' ? 'armed' : 'confirmed'`.
- Wraps the central HUD geometry and path description in `CqTransition` with `.cq-transition-settle`.

### 3. `QuestListScanEffect.tsx`
- Integrated `SystemStatusBadge` on the quest list overview header (`status="scanning"` while refreshing, `status="confirmed"` with dynamic target count when ready).

### 4. `GameMomentOverlay.tsx` & Next.js SWC Dynamic Imports
All 12 particle-heavy overlays are dynamically lazy-loaded:
- `PathLockEffect`
- `QuestCompleteEffect`
- `RankUpEffect`
- `FinaleQualifiedEffect`
- `FlashDropEffect`
- `AchievementEffect`
- `DistrictDecodedEffect`
- `FounderKeyUnlockedEffect`
- `FalseFinaleRevealedEffect`
- `DrawingEntryEffect`
- `VaultDoorOpeningEffect`
- `DistrictSigilEffect`

**SWC Compiler Constraint**: Next.js requires `dynamic(() => import(...), { ssr: false, loading: ... })` to be declared as an inline object literal at each call site. Passing an external variable or function options object breaks static bundle chunk analysis. Each dynamic import supplies a uniform fallback:
```tsx
const PathLockEffect = dynamic(() => import('./PathLockEffect'), {
  ssr: false,
  loading: () => (
    <div className="cq-moment-loading">
      <SystemStatusBadge status="scanning" />
    </div>
  ),
});
```

### 5. `SoundToggleControl.tsx`
- Migrated from manual event subscriptions to `useSoundPreference()`.
- Added tactile feedback via `confirmHaptic({ enabled: true })`.
- Applied `.cq-transition-settle` for smooth audio status icon flips.

---

## 5. Verification & Proof

### Unit & Integration Test Suites
1. **`tests/motion-and-sound-preference-primitives.test.ts`** (15 tests, PASS):
   - Validates `prefersReducedMotion()` in SSR and simulated browser environments.
   - Validates `confirmHaptic()` vibration invocation, safety fallbacks, and reduced-motion suppression.
   - Validates `useSoundPreference()` and external store synchronization with `cqSoundManager`.
   - Validates presence of CSS tokens (`--cq-motion-*`) and classes in `app/globals.css`.
   - Validates zero introduction of forbidden Tailwind utility classes.

2. **`tests/hud-system-states.test.tsx`** (19 tests, PASS):
   - Validates rendering of all 4 `SystemStatusBadge` states (`armed`, `scanning`, `confirmed`, `denied`).
   - Validates `HudSystemState` accessibility attributes (`role="status"`, `aria-live="polite"`, `data-state`).
   - Validates `CqTransition` visibility classes and reduced-motion style overrides.
   - Validates real call site imports and integration across `CityScanOverlay`, `PathLockEffect`, `QuestListScanEffect`, `GameMomentOverlay`, and `SoundToggleControl`.

### Production Build Validation
- Executed `NODE_ENV=production ./node_modules/.bin/next build`.
- 0 TypeScript compiler errors.
- 0 Linting errors.
- All 73 static and dynamic routes successfully compiled and prerendered.

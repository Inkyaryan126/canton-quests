import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// This repo's vitest environment is 'node' (see vitest.config.ts) — there is
// no DOM/render harness available, so component behavior is verified the
// same way the rest of tests/*.test.ts do: source-contract assertions plus
// manual simulation of the pure decision logic, not rendering.

const missionColdOpenSrc = readFileSync(
  join(process.cwd(), 'components/game-effects/MissionColdOpen.tsx'),
  'utf-8'
);
const eventPageSrc = readFileSync(join(process.cwd(), 'app/events/[slug]/page.tsx'), 'utf-8');

describe('Phase 3 — Mission entry cold open', () => {
  describe('MissionColdOpen builds only on Phase 2 shared primitives', () => {
    it('imports HudSystemState, TransmissionLoader, and CqTransition instead of inventing new HUD chrome', () => {
      expect(missionColdOpenSrc).toContain("import HudSystemState from './HudSystemState'");
      expect(missionColdOpenSrc).toContain("import TransmissionLoader from './TransmissionLoader'");
      expect(missionColdOpenSrc).toContain("import CqTransition from './CqTransition'");
    });

    it('reads the shared reduced-motion and sound primitives, not one-off equivalents', () => {
      expect(missionColdOpenSrc).toContain("import { useReducedMotion } from '@/lib/motion'");
      expect(missionColdOpenSrc).toContain("import { cqSoundManager } from '@/lib/audio'");
      expect(missionColdOpenSrc).toContain('useReducedMotion()');
    });

    it('never fabricates a signal lock on a failed fetch — denied and confirmed are distinct outcomes', () => {
      expect(missionColdOpenSrc).toContain("if (outcome === 'error')");
      expect(missionColdOpenSrc).toContain("setStage('denied')");
      expect(missionColdOpenSrc).toContain("cqSoundManager.play('ui_error'");
      expect(missionColdOpenSrc).toContain("setStage('confirmed')");
      expect(missionColdOpenSrc).toContain("cqSoundManager.play('lock_on'");
      // The confirm/deny decision must wait for the real fetch, never guess.
      expect(missionColdOpenSrc).toContain("outcome === 'pending') return;");
    });

    it('gives reduced-motion users a calmer but still real status readout, not a silent skip', () => {
      expect(missionColdOpenSrc).toContain('REDUCED_SCAN_FLOOR_MS');
      expect(missionColdOpenSrc).toContain('REDUCED_CONFIRM_HOLD_MS');
      expect(missionColdOpenSrc).toContain('reducedMotion ? REDUCED_SCAN_FLOOR_MS : SCAN_FLOOR_MS');
      expect(missionColdOpenSrc).toContain('reducedMotion ? REDUCED_CONFIRM_HOLD_MS : CONFIRM_HOLD_MS');
      // Reduced motion swaps the animated glyph loader for a static status line.
      expect(missionColdOpenSrc).toContain('{reducedMotion ? (');
      expect(missionColdOpenSrc).toContain('<TransmissionLoader label={loaderLabel} />');
    });

    it('gates once per browser tab per Operation via sessionStorage, scoped by eventSlug', () => {
      expect(missionColdOpenSrc).toContain("const SESSION_KEY_PREFIX = 'cq_cold_open_seen_';");
      expect(missionColdOpenSrc).toContain('window.sessionStorage.getItem(`${SESSION_KEY_PREFIX}${eventSlug}`)');
      expect(missionColdOpenSrc).toContain('window.sessionStorage.setItem(`${SESSION_KEY_PREFIX}${eventSlug}`, \'1\')');
      // A returning-this-session visit must render nothing and pass straight through.
      expect(missionColdOpenSrc).toContain('if (skip) return null;');
    });

    it('never blocks Mission entry if storage access throws (private browsing, etc.)', () => {
      expect(missionColdOpenSrc).toMatch(/function hasSeenColdOpen[\s\S]*?catch\s*{\s*return false;\s*}/);
      expect(missionColdOpenSrc).toMatch(/function markColdOpenSeen[\s\S]*?catch\s*{/);
    });
  });

  describe('app/events/[slug]/page.tsx integration', () => {
    it('imports and renders MissionColdOpen in place of the old bare loading spinner', () => {
      expect(eventPageSrc).toContain("import MissionColdOpen from '@/components/game-effects/MissionColdOpen';");
      expect(eventPageSrc).toContain('<MissionColdOpen');
      expect(eventPageSrc).not.toContain('Loading Mission Grid...');
    });

    it('derives the boot outcome honestly from the real fetch state (pending/error/ready)', () => {
      expect(eventPageSrc).toContain("const [coldOpenComplete, setColdOpenComplete] = useState(false);");
      expect(eventPageSrc).toContain('if (!coldOpenComplete) {');
      expect(eventPageSrc).toContain("outcome={isLoading ? 'pending' : loadError && !event ? 'error' : 'ready'}");
      expect(eventPageSrc).toContain('onDone={() => setColdOpenComplete(true)}');
    });

    it('preserves every existing status branch and real data below the cold-open gate', () => {
      // Pre-launch / not-found
      expect(eventPageSrc).toContain('MISSION UPCOMING');
      expect(eventPageSrc).toContain('EVENT NOT FOUND');
      // Auth / participation / path gates
      expect(eventPageSrc).toContain('Mission Access Required');
      expect(eventPageSrc).toContain('Entering Mission...');
      expect(eventPageSrc).toContain('event.requiresPath && participation && !authenticatedPlayer?.selectedStartingPath');
      // Real gameplay data: quest list, rules, event title
      expect(eventPageSrc).toContain('filteredQuests.map((quest)');
      expect(eventPageSrc).toContain('Canton Quests Real-World Field Guidelines');
      expect(eventPageSrc).toContain('{event.title.replace(');
    });

    it('leaves the existing Commander cipher_cold_open transmission untouched — the two cold opens are sequential, not merged', () => {
      expect(eventPageSrc).toContain("trigger: 'cipher_cold_open'");
    });
  });

  describe('Session-scoped gating logic (simulated — no DOM in this test environment)', () => {
    function makeSessionStorage() {
      const store: Record<string, string> = {};
      return {
        getItem: (k: string) => (k in store ? store[k] : null),
        setItem: (k: string, v: string) => {
          store[k] = v;
        },
      };
    }

    function hasSeenColdOpen(storage: ReturnType<typeof makeSessionStorage>, eventSlug: string): boolean {
      return storage.getItem(`cq_cold_open_seen_${eventSlug}`) === '1';
    }

    function markColdOpenSeen(storage: ReturnType<typeof makeSessionStorage>, eventSlug: string): void {
      storage.setItem(`cq_cold_open_seen_${eventSlug}`, '1');
    }

    it('a first-ever entry into a Mission is not marked seen', () => {
      const storage = makeSessionStorage();
      expect(hasSeenColdOpen(storage, 'founders-cipher')).toBe(false);
    });

    it('marking seen only affects that Operation, never a different one', () => {
      const storage = makeSessionStorage();
      markColdOpenSeen(storage, 'founders-cipher');
      expect(hasSeenColdOpen(storage, 'founders-cipher')).toBe(true);
      expect(hasSeenColdOpen(storage, 'fair-qr-hunt')).toBe(false);
    });
  });

  describe('Outcome → stage resolution (simulated)', () => {
    type Outcome = 'pending' | 'ready' | 'error';
    function resolveStage(outcome: Outcome, floorElapsed: boolean): 'scanning' | 'confirmed' | 'denied' {
      if (!floorElapsed || outcome === 'pending') return 'scanning';
      return outcome === 'error' ? 'denied' : 'confirmed';
    }

    it('never resolves before the fetch settles, even past the floor', () => {
      expect(resolveStage('pending', true)).toBe('scanning');
    });

    it('never resolves before the minimum floor beat, even if the fetch already settled', () => {
      expect(resolveStage('ready', false)).toBe('scanning');
      expect(resolveStage('error', false)).toBe('scanning');
    });

    it('resolves to confirmed only on a genuine success after the floor', () => {
      expect(resolveStage('ready', true)).toBe('confirmed');
    });

    it('resolves to denied — not confirmed — on a genuine failure after the floor', () => {
      expect(resolveStage('error', true)).toBe('denied');
    });
  });
});

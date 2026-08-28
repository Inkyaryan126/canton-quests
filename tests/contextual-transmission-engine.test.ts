/**
 * Canton Quests — Contextual Transmission Engine Tests
 *
 * Follows the same localStorage-shim convention as
 * tests/commander-transmission-and-reward-moments.test.ts (this Vitest
 * environment has no `window` by default).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  resolveContextualTransmission,
  shouldShowContextualTransmission,
  showContextualTransmission,
  ContextualTransmissionRule,
} from '../lib/contextual-transmissions';
import { gameMomentManager } from '../lib/game-effects';
import { hasViewedTransmission, hasActiveCooldown, markTransmissionViewed } from '../lib/transmission-viewed-state';

function installLocalStorageShim() {
  const store = new Map<string, string>();
  (globalThis as any).window = {
    localStorage: {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    },
  };
}
function removeLocalStorageShim() {
  delete (globalThis as any).window;
}

const CIPHER_SLUG = 'canton-weekend-1';

describe('Event scope', () => {
  it('never resolves anything for a non-Cipher/unknown event slug, regardless of trigger', () => {
    expect(resolveContextualTransmission({ trigger: 'mission_entry', eventSlug: 'fair-qr-hunt' })).toBeUndefined();
    expect(resolveContextualTransmission({ trigger: 'mission_entry', eventSlug: 'totally-unknown' })).toBeUndefined();
  });

  it('shouldShow is false for a non-Cipher event slug even for an otherwise-always-show trigger like emergency', () => {
    expect(shouldShowContextualTransmission({ trigger: 'emergency', eventSlug: 'fair-qr-hunt' })).toBe(false);
  });

  it('resolves normally for a known Cipher slug', () => {
    const result = resolveContextualTransmission({ trigger: 'mission_entry', eventSlug: CIPHER_SLUG });
    expect(result).toBeDefined();
    expect(result?.headline).toBe('Cold Open');
  });
});

describe('Path scope', () => {
  it('path_selected resolves to the matching path video and no other', () => {
    expect(resolveContextualTransmission({ trigger: 'path_selected', eventSlug: CIPHER_SLUG, path: 'family' })?.headline).toBe('Family Path');
    expect(resolveContextualTransmission({ trigger: 'path_selected', eventSlug: CIPHER_SLUG, path: 'challenge' })?.headline).toBe('Challenge Path');
    expect(resolveContextualTransmission({ trigger: 'path_selected', eventSlug: CIPHER_SLUG, path: 'secret' })?.headline).toBe('Secret Path');
  });

  it('path_selected with no path (or a mismatched one) resolves to nothing — never falls back to a wrong path video', () => {
    expect(resolveContextualTransmission({ trigger: 'path_selected', eventSlug: CIPHER_SLUG })).toBeUndefined();
  });

  it('a city-wide (no pathScope) rule ignores path entirely', () => {
    const a = resolveContextualTransmission({ trigger: 'mission_entry', eventSlug: CIPHER_SLUG, path: 'family' });
    const b = resolveContextualTransmission({ trigger: 'mission_entry', eventSlug: CIPHER_SLUG, path: 'secret' });
    expect(a?.headline).toBe('Cold Open');
    expect(b?.headline).toBe('Cold Open');
  });
});

describe('No default rule = no fabricated content', () => {
  it('quest_intro/quest_completion/final_hours/finale have no registered default (they are meant to be driven by per-quest or per-mission-stage authored content) — resolve to undefined without inlineContent', () => {
    for (const trigger of ['quest_intro', 'quest_completion', 'final_hours', 'finale'] as const) {
      expect(resolveContextualTransmission({ trigger, eventSlug: CIPHER_SLUG })).toBeUndefined();
    }
  });

  it('inlineContent always wins and works for a trigger with no registered rule at all', () => {
    const result = resolveContextualTransmission({
      trigger: 'quest_intro',
      eventSlug: CIPHER_SLUG,
      inlineContent: { headline: 'A Quest Begins', message: 'Custom per-quest copy.' },
    });
    expect(result?.headline).toBe('A Quest Begins');
    expect(result?.message).toBe('Custom per-quest copy.');
  });
});

describe('Expired / not-yet-active transmission (start/end windows)', () => {
  const futureRule: ContextualTransmissionRule = {
    id: 'test-future',
    trigger: 'city_event',
    priority: 5,
    onceParPlayer: false,
    replayable: false,
    startsAt: new Date(Date.now() + 3_600_000).toISOString(),
    content: { kind: 'text', headline: 'Not Yet', message: 'x' },
  };
  const expiredRule: ContextualTransmissionRule = {
    id: 'test-expired',
    trigger: 'city_event',
    priority: 5,
    onceParPlayer: false,
    replayable: false,
    endsAt: new Date(Date.now() - 1000).toISOString(),
    content: { kind: 'text', headline: 'Too Late', message: 'x' },
  };
  const activeRule: ContextualTransmissionRule = {
    id: 'test-active',
    trigger: 'city_event',
    priority: 5,
    onceParPlayer: false,
    replayable: false,
    startsAt: new Date(Date.now() - 1000).toISOString(),
    endsAt: new Date(Date.now() + 3_600_000).toISOString(),
    content: { kind: 'text', headline: 'Right Now', message: 'x' },
  };

  it('a rule whose startsAt is still in the future never resolves', () => {
    expect(resolveContextualTransmission({ trigger: 'city_event', eventSlug: CIPHER_SLUG, rulesOverride: [futureRule] })).toBeUndefined();
  });

  it('a rule whose endsAt has passed never resolves, even though it otherwise matches', () => {
    expect(resolveContextualTransmission({ trigger: 'city_event', eventSlug: CIPHER_SLUG, rulesOverride: [expiredRule] })).toBeUndefined();
  });

  it('a rule inside its window resolves normally', () => {
    expect(resolveContextualTransmission({ trigger: 'city_event', eventSlug: CIPHER_SLUG, rulesOverride: [activeRule] })?.headline).toBe('Right Now');
  });

  it('given a mix of an expired and an active rule for the same trigger, only the active one is ever returned', () => {
    const result = resolveContextualTransmission({ trigger: 'city_event', eventSlug: CIPHER_SLUG, rulesOverride: [expiredRule, activeRule] });
    expect(result?.headline).toBe('Right Now');
  });
});

describe('De-dupe (once-per-player) and player scope', () => {
  beforeEach(installLocalStorageShim);
  afterEach(removeLocalStorageShim);

  it('a once-per-player trigger auto-shows exactly once for a given player, then never again', () => {
    expect(shouldShowContextualTransmission({ trigger: 'mission_entry', eventSlug: CIPHER_SLUG, playerId: 'plr-1' })).toBe(true);
    markTransmissionViewed('mission_entry', 'mission_entry', 'plr-1');
    expect(shouldShowContextualTransmission({ trigger: 'mission_entry', eventSlug: CIPHER_SLUG, playerId: 'plr-1' })).toBe(false);
  });

  it('is scoped per player — a second player still gets their own first showing', () => {
    markTransmissionViewed('mission_entry', 'mission_entry', 'plr-1');
    expect(shouldShowContextualTransmission({ trigger: 'mission_entry', eventSlug: CIPHER_SLUG, playerId: 'plr-2' })).toBe(true);
  });

  it('showContextualTransmission marks it viewed and returns true exactly once, then false on a repeat call', () => {
    expect(showContextualTransmission({ trigger: 'mission_entry', eventSlug: CIPHER_SLUG, playerId: 'plr-dedupe' })).toBe(true);
    expect(showContextualTransmission({ trigger: 'mission_entry', eventSlug: CIPHER_SLUG, playerId: 'plr-dedupe' })).toBe(false);
    gameMomentManager.skipAll();
  });
});

describe('Cooldown (repeatable triggers)', () => {
  beforeEach(installLocalStorageShim);
  afterEach(removeLocalStorageShim);

  it('a repeatable trigger (badge_awarded) is due immediately the first time', () => {
    expect(shouldShowContextualTransmission({ trigger: 'badge_awarded', eventSlug: CIPHER_SLUG, playerId: 'plr-cd' })).toBe(true);
  });

  it('after showing, the same repeatable trigger is suppressed until its cooldown elapses, then becomes due again', () => {
    markTransmissionViewed('badge_awarded', 'badge_awarded', 'plr-cd-2');
    // Still within the 30s cooldown configured for badge_awarded.
    expect(shouldShowContextualTransmission({ trigger: 'badge_awarded', eventSlug: CIPHER_SLUG, playerId: 'plr-cd-2' })).toBe(false);
    expect(hasActiveCooldown('badge_awarded', 'badge_awarded', 30_000, 'plr-cd-2')).toBe(true);
  });

  it('hasActiveCooldown is false once the configured window has elapsed', () => {
    const map = { ['plr-cd-3:badge_awarded:badge_awarded']: Date.now() - 60_000 };
    window.localStorage.setItem('canton_quests_viewed_transmissions', JSON.stringify(map));
    expect(hasActiveCooldown('badge_awarded', 'badge_awarded', 30_000, 'plr-cd-3')).toBe(false);
    expect(shouldShowContextualTransmission({ trigger: 'badge_awarded', eventSlug: CIPHER_SLUG, playerId: 'plr-cd-3' })).toBe(true);
  });

  it('a once-per-player trigger is never subject to cooldown re-showing, only the permanent viewed flag', () => {
    markTransmissionViewed('mission_entry', 'mission_entry', 'plr-once');
    expect(shouldShowContextualTransmission({ trigger: 'mission_entry', eventSlug: CIPHER_SLUG, playerId: 'plr-once' })).toBe(false);
  });
});

describe('Replay vs automatic trigger', () => {
  beforeEach(installLocalStorageShim);
  afterEach(removeLocalStorageShim);

  it('resolveContextualTransmission always returns the content regardless of viewed-state — replay is a UI choice, not a resolver decision', () => {
    markTransmissionViewed('mission_entry', 'mission_entry', 'plr-replay');
    // shouldShow correctly says "don't auto-fire again"...
    expect(shouldShowContextualTransmission({ trigger: 'mission_entry', eventSlug: CIPHER_SLUG, playerId: 'plr-replay' })).toBe(false);
    // ...but the content itself is still resolvable for an explicit "Replay Transmission" control.
    expect(resolveContextualTransmission({ trigger: 'mission_entry', eventSlug: CIPHER_SLUG, playerId: 'plr-replay' })?.headline).toBe('Cold Open');
  });

  it('a replayable video transmission is marked replayable: true on the resolved payload', () => {
    const result = resolveContextualTransmission({ trigger: 'mission_entry', eventSlug: CIPHER_SLUG });
    expect(result?.replayable).toBe(true);
  });
});

describe('Emergency trigger — always bypasses de-dupe', () => {
  beforeEach(installLocalStorageShim);
  afterEach(removeLocalStorageShim);

  it('shouldShow is always true for emergency, even after being marked viewed', () => {
    markTransmissionViewed('emergency', 'emergency', 'plr-emg');
    expect(shouldShowContextualTransmission({ trigger: 'emergency', eventSlug: CIPHER_SLUG, playerId: 'plr-emg' })).toBe(true);
  });

  it('gm_announcement retains its pre-existing always-show behavior alongside the new emergency trigger', () => {
    markTransmissionViewed('gm_announcement', 'gm_announcement', 'plr-gm');
    expect(shouldShowContextualTransmission({ trigger: 'gm_announcement', eventSlug: CIPHER_SLUG, playerId: 'plr-gm' })).toBe(true);
  });

  it('emergency resolves to real content by default even with no inlineContent supplied', () => {
    expect(resolveContextualTransmission({ trigger: 'emergency', eventSlug: CIPHER_SLUG })?.headline).toBe('COMMANDER ALERT');
  });
});

describe('Live event trigger integration', () => {
  it('resolveContextualTransmission with inlineContent produces a valid transmission for a Live-City-Events-sourced trigger name', () => {
    const result = resolveContextualTransmission({
      trigger: 'flash_drop',
      eventSlug: CIPHER_SLUG,
      inlineContent: { headline: 'Market Square Signal', message: 'A flash quest just went live at Centennial Plaza.', cta: 'GO' },
      countdownEndsAt: new Date(Date.now() + 900_000).toISOString(),
    });
    expect(result?.headline).toBe('Market Square Signal');
    expect(result?.cta).toBe('GO');
    expect(result?.countdownEndsAt).toBeDefined();
  });

  it('every LiveEventType with a natural trigger mapping resolves to a real default when no inline content is configured', () => {
    for (const trigger of ['flash_drop', 'city_event', 'sector_event', 'community_milestone'] as const) {
      expect(resolveContextualTransmission({ trigger, eventSlug: CIPHER_SLUG })).toBeDefined();
    }
  });
});

describe('No reward mutation from transmission', () => {
  it('every resolved transmission is a plain display payload with no reward-shaped fields at all', () => {
    const candidates = [
      resolveContextualTransmission({ trigger: 'mission_entry', eventSlug: CIPHER_SLUG }),
      resolveContextualTransmission({ trigger: 'badge_awarded', eventSlug: CIPHER_SLUG }),
      resolveContextualTransmission({ trigger: 'flash_drop', eventSlug: CIPHER_SLUG }),
      resolveContextualTransmission({
        trigger: 'quest_intro',
        eventSlug: CIPHER_SLUG,
        inlineContent: { headline: 'X', message: 'Y' },
      }),
    ];
    for (const transmission of candidates) {
      expect(transmission).toBeDefined();
      expect(transmission).not.toHaveProperty('xpAmount');
      expect(transmission).not.toHaveProperty('entryCount');
      expect(transmission).not.toHaveProperty('reward');
      expect(transmission).not.toHaveProperty('drawingEntries');
    }
  });

  it('resolveContextualTransmission and shouldShowContextualTransmission are pure — calling them repeatedly never changes their own outcome (no hidden state mutation from resolution alone)', () => {
    installLocalStorageShim();
    const before = shouldShowContextualTransmission({ trigger: 'mission_entry', eventSlug: CIPHER_SLUG, playerId: 'plr-pure' });
    resolveContextualTransmission({ trigger: 'mission_entry', eventSlug: CIPHER_SLUG, playerId: 'plr-pure' });
    resolveContextualTransmission({ trigger: 'mission_entry', eventSlug: CIPHER_SLUG, playerId: 'plr-pure' });
    const after = shouldShowContextualTransmission({ trigger: 'mission_entry', eventSlug: CIPHER_SLUG, playerId: 'plr-pure' });
    expect(before).toBe(true);
    expect(after).toBe(true); // unchanged — only showContextualTransmission/markTransmissionViewed may change this.
    expect(hasViewedTransmission('mission_entry', 'mission_entry', 'plr-pure')).toBe(false);
    removeLocalStorageShim();
  });
});

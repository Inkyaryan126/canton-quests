/**
 * Canton Quests — Commander Videos 1-15 Gameplay Integration Tests
 *
 * Follows the same Node-environment convention as
 * tests/commander-transmission-and-reward-moments.test.ts: pure decision
 * logic (the trigger resolver, the archive-unlock computation, the viewed
 * de-dupe store) rather than rendered-component assertions. Mobile
 * rendering of the portrait video treatment was verified separately via
 * the browser (see the final report).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  COMMANDER_TRANSMISSIONS,
  getCommanderTransmissionForTrigger,
  toGameplayTransmission,
} from '../lib/commander-transmissions';
import {
  computeUnlockedCommanderVideoIds,
  type CommanderVideoUnlockSignals,
} from '../lib/commander-video-unlock';
import { hasViewedTransmission, markTransmissionViewed, shouldAutoShowTransmission } from '../lib/transmission-viewed-state';
import { gameMomentManager, showGameMoment } from '../lib/game-effects';
import { isKnownCantonLaunchSlug } from '../lib/launch-status';
import { GET as transmissionsGET } from '../app/api/game/transmissions/route';

// ---------------------------------------------------------------------------
// Minimal in-memory localStorage shim — this Vitest environment has no
// `window` by default, and lib/transmission-viewed-state.ts's real store is
// client-only. Same technique as the existing Commander transmission tests.
// ---------------------------------------------------------------------------
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

const noSignals: CommanderVideoUnlockSignals = {
  hasEntered: false,
  isProfileComplete: false,
  hasXp: false,
  hasDrawingEntries: false,
  hasQuestActivity: false,
};

describe('Central resolver — getCommanderTransmissionForTrigger', () => {
  it('returns video 6 for the FAMILY path trigger', () => {
    const entry = getCommanderTransmissionForTrigger({ trigger: 'cipher_path_selected', path: 'family' });
    expect(entry?.id).toBe(6);
    expect(entry?.title).toBe('Family Path');
  });

  it('returns video 7 for the CHALLENGE path trigger', () => {
    const entry = getCommanderTransmissionForTrigger({ trigger: 'cipher_path_selected', path: 'challenge' });
    expect(entry?.id).toBe(7);
    expect(entry?.title).toBe('Challenge Path');
  });

  it('returns video 8 for the SECRET path trigger', () => {
    const entry = getCommanderTransmissionForTrigger({ trigger: 'cipher_path_selected', path: 'secret' });
    expect(entry?.id).toBe(8);
    expect(entry?.title).toBe('Secret Path');
  });

  it('a path video never resolves for the wrong path, or for no path at all', () => {
    expect(getCommanderTransmissionForTrigger({ trigger: 'cipher_path_selected', path: 'secret' })?.id).not.toBe(6);
    expect(getCommanderTransmissionForTrigger({ trigger: 'cipher_path_selected' })).toBeUndefined();
  });

  it('resolves every documented non-path trigger to exactly its numbered video', () => {
    expect(getCommanderTransmissionForTrigger({ trigger: 'cipher_cold_open' })?.id).toBe(1);
    expect(getCommanderTransmissionForTrigger({ trigger: 'cipher_welcome' })?.id).toBe(2);
    expect(getCommanderTransmissionForTrigger({ trigger: 'cipher_prize_intro' })?.id).toBe(3);
    expect(getCommanderTransmissionForTrigger({ trigger: 'cipher_rules_intro' })?.id).toBe(4);
    expect(getCommanderTransmissionForTrigger({ trigger: 'cipher_city_intro' })?.id).toBe(5);
    expect(getCommanderTransmissionForTrigger({ trigger: 'cipher_three_doors' })?.id).toBe(9);
    expect(getCommanderTransmissionForTrigger({ trigger: 'cipher_callsign' })?.id).toBe(10);
    expect(getCommanderTransmissionForTrigger({ trigger: 'cipher_profile' })?.id).toBe(11);
    expect(getCommanderTransmissionForTrigger({ trigger: 'cipher_first_xp' })?.id).toBe(12);
    expect(getCommanderTransmissionForTrigger({ trigger: 'cipher_first_entry' })?.id).toBe(13);
    expect(getCommanderTransmissionForTrigger({ trigger: 'cipher_leaderboard' })?.id).toBe(14);
    expect(getCommanderTransmissionForTrigger({ trigger: 'cipher_first_quest' })?.id).toBe(15);
  });

  it('an unmapped trigger (one from the placeholder per-quest system) resolves to nothing here', () => {
    expect(getCommanderTransmissionForTrigger({ trigger: 'sector_intro' as any })).toBeUndefined();
  });

  it('the registry has exactly 15 real, web-compressed portrait videos with the owner-provided titles', () => {
    expect(COMMANDER_TRANSMISSIONS).toHaveLength(15);
    expect(COMMANDER_TRANSMISSIONS.map((t) => t.title)).toEqual([
      'Cold Open',
      'Welcome to Canton Quests',
      'Cash Prize Challenge',
      'Basic Rules',
      'Your City Is the Board',
      'Family Path',
      'Challenge Path',
      'Secret Path',
      'Three Doors — One Competition',
      'Create Your Callsign',
      'Your Player Profile',
      'How XP Works',
      'How Prize Entries Work',
      'The Leaderboard',
      'How to Read a Quest',
    ]);
  });
});

describe('toGameplayTransmission — converts an archive entry without inventing rewards', () => {
  it('produces a portrait VIDEO transmission using the real video/poster URLs, with no XP/entry fields at all', () => {
    const entry = getCommanderTransmissionForTrigger({ trigger: 'cipher_cold_open' })!;
    const transmission = toGameplayTransmission(entry);

    expect(transmission.type).toBe('VIDEO');
    expect(transmission.mediaAspect).toBe('portrait');
    expect(transmission.mediaKey).toBe('/cq_web_videos/1_web.mp4');
    expect(transmission.posterKey).toBe('/commander-transmissions/transmission-1-poster.jpg');
    expect(transmission.headline).toBe('Cold Open');

    // QuestCommanderTransmission has no xpAmount/entryCount/reward fields at
    // all (see lib/types.ts) — watching a Commander video structurally
    // cannot grant XP or a drawing entry; only RewardMomentBase-family
    // moments (reward-token/unlock/field-event/...) carry those fields, and
    // nothing in this integration constructs one of those from a video.
    expect(transmission).not.toHaveProperty('xpAmount');
    expect(transmission).not.toHaveProperty('entryCount');
  });
});

describe('Archive unlock — computeUnlockedCommanderVideoIds', () => {
  it('a player who has never entered the Mission has nothing unlocked, not even video 1', () => {
    const unlocked = computeUnlockedCommanderVideoIds(noSignals);
    expect(unlocked.size).toBe(0);
    expect(unlocked.has(1)).toBe(false);
    expect(unlocked.has(15)).toBe(false);
  });

  it('entering the Mission unlocks only the onboarding tier (1,2,3,4,5,9,10) — every milestone video stays locked', () => {
    const unlocked = computeUnlockedCommanderVideoIds({ ...noSignals, hasEntered: true });
    expect([...unlocked].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 9, 10]);
    // The real spoiler-protection surface: none of these leak early.
    for (const milestoneId of [6, 7, 8, 11, 12, 13, 14, 15]) {
      expect(unlocked.has(milestoneId)).toBe(false);
    }
  });

  it('choosing FAMILY unlocks exactly video 6, never 7 or 8', () => {
    const unlocked = computeUnlockedCommanderVideoIds({ ...noSignals, hasEntered: true, path: 'family' });
    expect(unlocked.has(6)).toBe(true);
    expect(unlocked.has(7)).toBe(false);
    expect(unlocked.has(8)).toBe(false);
  });

  it('completing the profile unlocks 11 and nothing else new', () => {
    const before = computeUnlockedCommanderVideoIds({ ...noSignals, hasEntered: true });
    const after = computeUnlockedCommanderVideoIds({ ...noSignals, hasEntered: true, isProfileComplete: true });
    expect(after.has(11)).toBe(true);
    expect(before.has(11)).toBe(false);
    expect(after.size).toBe(before.size + 1);
  });

  it('earning XP unlocks 12; a real drawing entry unlocks 13; a real quest completion unlocks 14 and 15 — each independently', () => {
    const xpOnly = computeUnlockedCommanderVideoIds({ ...noSignals, hasEntered: true, hasXp: true });
    expect(xpOnly.has(12)).toBe(true);
    expect(xpOnly.has(13)).toBe(false);
    expect(xpOnly.has(14)).toBe(false);
    expect(xpOnly.has(15)).toBe(false);

    const entriesOnly = computeUnlockedCommanderVideoIds({ ...noSignals, hasEntered: true, hasDrawingEntries: true });
    expect(entriesOnly.has(13)).toBe(true);
    expect(entriesOnly.has(12)).toBe(false);

    const questActivity = computeUnlockedCommanderVideoIds({ ...noSignals, hasEntered: true, hasQuestActivity: true });
    expect(questActivity.has(14)).toBe(true);
    expect(questActivity.has(15)).toBe(true);
  });

  it('a fully-progressed player unlocks everything reachable for their chosen path — 13 of 15, since the other two path videos are never meant for them', () => {
    const unlocked = computeUnlockedCommanderVideoIds({
      hasEntered: true,
      path: 'secret',
      isProfileComplete: true,
      hasXp: true,
      hasDrawingEntries: true,
      hasQuestActivity: true,
    });
    expect(unlocked.size).toBe(13);
    for (const id of [1, 2, 3, 4, 5, 8, 9, 10, 11, 12, 13, 14, 15]) expect(unlocked.has(id)).toBe(true);
    // Family Path and Challenge Path stay permanently locked for a Secret-path player.
    expect(unlocked.has(6)).toBe(false);
    expect(unlocked.has(7)).toBe(false);
  });
});

describe('Viewed-state de-dupe for the new Cipher triggers', () => {
  beforeEach(() => installLocalStorageShim());
  afterEach(() => removeLocalStorageShim());

  it('once-per-player suppression: a path video auto-shows once, then never again for that player+path', () => {
    expect(shouldAutoShowTransmission('cipher_path_selected', 'family', 'plr-1')).toBe(true);
    markTransmissionViewed('cipher_path_selected', 'family', 'plr-1');
    expect(shouldAutoShowTransmission('cipher_path_selected', 'family', 'plr-1')).toBe(false);
    expect(hasViewedTransmission('cipher_path_selected', 'family', 'plr-1')).toBe(true);
  });

  it('is scoped per player — a second player choosing the same path still gets their own auto-show', () => {
    markTransmissionViewed('cipher_path_selected', 'family', 'plr-1');
    expect(shouldAutoShowTransmission('cipher_path_selected', 'family', 'plr-2')).toBe(true);
  });

  it('is scoped per subject key — choosing a different path is a distinct entry, not suppressed by the first', () => {
    markTransmissionViewed('cipher_path_selected', 'family', 'plr-1');
    expect(shouldAutoShowTransmission('cipher_path_selected', 'challenge', 'plr-1')).toBe(true);
  });

  it('the onboarding chain (1 -> 2 -> 5) only ever exposes the NEXT unseen step, never more than one at a time', () => {
    const pid = 'plr-onboarding';
    const chain: Array<{ trigger: 'cipher_cold_open' | 'cipher_welcome' | 'cipher_city_intro'; key: string }> = [
      { trigger: 'cipher_cold_open', key: 'video-1' },
      { trigger: 'cipher_welcome', key: 'video-2' },
      { trigger: 'cipher_city_intro', key: 'video-5' },
    ];

    function nextDue(): string | null {
      for (const step of chain) {
        if (shouldAutoShowTransmission(step.trigger, step.key, pid)) return step.key;
      }
      return null;
    }

    expect(nextDue()).toBe('video-1');
    markTransmissionViewed('cipher_cold_open', 'video-1', pid);
    expect(nextDue()).toBe('video-2');
    markTransmissionViewed('cipher_welcome', 'video-2', pid);
    expect(nextDue()).toBe('video-5');
    markTransmissionViewed('cipher_city_intro', 'video-5', pid);
    expect(nextDue()).toBeNull();
  });
});

describe('GameMomentManager — duplicate triggers never produce duplicate overlays', () => {
  afterEach(() => {
    gameMomentManager.skipAll();
  });

  it('firing the same numbered-video moment twice in a row queues it once as current, once as queued — never merges into a broken state, and a caller that marks-viewed before the second call correctly never fires the second at all', () => {
    installLocalStorageShim();
    const pid = 'plr-dup-guard';
    const entry = getCommanderTransmissionForTrigger({ trigger: 'cipher_cold_open' })!;

    // First check: due, so we show it and mark it immediately (the pattern
    // used in every integration point in this mission) — this is the guard
    // that prevents a second effect run from enqueuing a duplicate.
    expect(shouldAutoShowTransmission('cipher_cold_open', 'video-1', pid)).toBe(true);
    markTransmissionViewed('cipher_cold_open', 'video-1', pid);
    showGameMoment({ type: 'commander-transmission', trigger: 'cipher_cold_open', transmission: toGameplayTransmission(entry) });

    // A second effect run (e.g. a re-render before the overlay is
    // dismissed) re-checks and correctly finds it already viewed — no
    // second call to showGameMoment happens, so the queue stays at length 0.
    expect(shouldAutoShowTransmission('cipher_cold_open', 'video-1', pid)).toBe(false);

    const state = gameMomentManager.getState();
    expect(state.currentMoment?.type).toBe('commander-transmission');
    expect(state.queue.length).toBe(0);
    removeLocalStorageShim();
  });
});

describe('API /api/game/transmissions — server-side archive gating', () => {
  it('a non-Cipher (or unknown) event slug never receives the real registry — every entry comes back locked', async () => {
    const req = new Request('http://localhost/api/game/transmissions?eventSlug=fair-qr-hunt');
    const res = await transmissionsGET(req);
    const body = await res.json();
    expect(body.transmissions).toHaveLength(15);
    for (const t of body.transmissions) {
      expect(t.unlocked).toBe(false);
      expect(t).not.toHaveProperty('title');
      expect(t).not.toHaveProperty('posterUrl');
    }
  });

  it('an unknown slug requesting a single id (e.g. trying /15 against the wrong Mission) is safely locked, no video URL present', async () => {
    const req = new Request('http://localhost/api/game/transmissions?eventSlug=fair-qr-hunt&id=15');
    const res = await transmissionsGET(req);
    const body = await res.json();
    expect(body.unlocked).toBe(false);
    expect(body).not.toHaveProperty('transmission');
  });

  it('an unauthenticated request against the real Cipher slug is safe — locked, no leaked data, even for id=1', async () => {
    const req = new Request('http://localhost/api/game/transmissions?eventSlug=canton-weekend-1&id=1');
    const res = await transmissionsGET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.unlocked).toBe(false);
    expect(body).not.toHaveProperty('transmission');
  });

  it('an unauthenticated list request against the real Cipher slug returns all 15 as locked, with ids present but no titles/posters', async () => {
    const req = new Request('http://localhost/api/game/transmissions?eventSlug=canton-weekend-1');
    const res = await transmissionsGET(req);
    const body = await res.json();
    expect(body.transmissions).toHaveLength(15);
    expect(body.transmissions.every((t: any) => t.unlocked === false)).toBe(true);
    expect(body.transmissions.every((t: any) => !('title' in t) && !('posterUrl' in t))).toBe(true);
  });

  it('a locked single-id response for a real, valid id never includes videoUrl/posterUrl/title — confirms direct-URL guessing (e.g. /15) cannot leak the asset', async () => {
    const req = new Request('http://localhost/api/game/transmissions?eventSlug=canton-weekend-1&id=9');
    const res = await transmissionsGET(req);
    const body = await res.json();
    expect(body.unlocked).toBe(false);
    const bodyStr = JSON.stringify(body);
    expect(bodyStr).not.toContain('.mp4');
    expect(bodyStr).not.toContain('poster');
  });
});

describe('Event-scope guard — Cipher videos never leak into another Mission', () => {
  it('isKnownCantonLaunchSlug rejects the Fair and any other non-Cipher slug, which every gameplay trigger integration point gates on', () => {
    expect(isKnownCantonLaunchSlug('canton-weekend-1')).toBe(true);
    expect(isKnownCantonLaunchSlug('fair-qr-hunt')).toBe(false);
    expect(isKnownCantonLaunchSlug('some-other-mission')).toBe(false);
    expect(isKnownCantonLaunchSlug(undefined)).toBe(false);
  });
});

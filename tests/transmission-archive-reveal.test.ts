/**
 * Canton Quests — Transmissions archive: reveal-only visibility.
 *
 * The Transmissions page is a player ARCHIVE, not a checklist. A
 * transmission the player hasn't actually reached in-game must be
 * completely invisible — no title, poster, timestamp, locked placeholder,
 * or count that reveals how many more exist. GET /api/game/transmissions
 * already computed real, server-derived, per-player unlock state before
 * this fix (lib/commander-video-unlock.ts — reused unchanged here, not
 * duplicated); the bug was that the route still echoed back a locked stub
 * (id + unlocked:false) for every not-yet-reached entry, and the archive
 * page rendered those stubs as numbered "Locked" cards plus an "X of 15
 * received" counter. Both leaked the existence/count/order of future
 * transmissions. The fix simply omits not-yet-unlocked entries from the
 * list response entirely.
 *
 * DELIVERED/REVEALED vs VIEWED: this codebase already has two genuinely
 * separate concepts (documented in both source files) —
 *   - lib/commander-video-unlock.ts: "archive unlocked" — the real,
 *     server-derived DELIVERED/REVEALED state that gates this archive.
 *   - lib/transmission-viewed-state.ts: "gameplay viewed" — a client-side,
 *     per-device UX convenience that only suppresses repeat auto-play; it
 *     never gates anything and is not consulted by the archive route at
 *     all. A transmission the player has never manually replayed still
 *     shows in the archive once delivered — proven below.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GET as transmissionsGET } from '../app/api/game/transmissions/route';
import {
  registerPlayer,
  resetGameEngineStore,
  initializeGameEngine,
  getOrCreateEventParticipation,
  updatePlayerProfile,
  submitQuestProof,
} from '../lib/game-engine';
import { SEED_EVENT } from '../lib/seed-data';
import { hasViewedTransmission } from '../lib/transmission-viewed-state';

function authedRequest(url: string, userId: string): Request {
  return new Request(url, { headers: { Authorization: `Bearer mock-jwt-${userId}` } });
}

/**
 * Enters the Mission AND sets the player's universal path
 * (players.selected_starting_path) — mirroring what the real
 * POST /api/game/operations/[slug]/enter route now does in one call. Video
 * 6/7/8 unlock reads the universal path (lib/commander-video-unlock.ts),
 * not the legacy event_players.path this function also sets for realism.
 */
function enterWithPath(playerId: string, path: 'family' | 'challenge' | 'secret') {
  getOrCreateEventParticipation(SEED_EVENT.id, playerId, path);
  updatePlayerProfile(playerId, { selectedStartingPath: path });
}

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

async function fetchArchive(userId: string): Promise<{ transmissions: Array<{ id: number; order: number; title: string; posterUrl: string }> }> {
  const req = authedRequest(`http://localhost/api/game/transmissions?eventSlug=${SEED_EVENT.slug}`, userId);
  const res = await transmissionsGET(req);
  return res.json();
}

describe('Transmissions archive — reveal-only visibility (real persisted player state)', () => {
  beforeEach(() => {
    resetGameEngineStore();
    initializeGameEngine();
  });

  it('a future (not-yet-unlocked) transmission is entirely absent from the archive — no id, title, or placeholder', async () => {
    registerPlayer({ displayName: 'ArchiveFresh', email: 'archivefresh@example.com', userId: 'usr-archive-fresh' });
    // Deliberately never joins the Mission (no getOrCreateEventParticipation
    // call) — nothing should be unlocked at all.

    const body = await fetchArchive('usr-archive-fresh');
    expect(body.transmissions).toEqual([]);
  });

  it('once a real reveal condition fires (Mission entry), the eligible transmission appears with its real title/poster', async () => {
    const player = registerPlayer({ displayName: 'ArchiveEntered', email: 'archiveentered@example.com', userId: 'usr-archive-entered' });
    enterWithPath(player.id, 'family');

    const body = await fetchArchive('usr-archive-entered');
    const ids = body.transmissions.map((t) => t.id).sort((a, b) => a - b);

    // Onboarding tier unlocks on entry; the "Family Path" video (6) does
    // too since this player chose family — but the OTHER path videos
    // (7, 8) and every milestone-gated video stay locked and absent.
    expect(ids).toEqual([1, 2, 3, 4, 5, 6, 9, 10]);
    const coldOpen = body.transmissions.find((t) => t.id === 1);
    expect(coldOpen?.title).toBe('Cold Open');
    expect(coldOpen?.posterUrl).toBeTruthy();
  });

  it('unrevealed titles never appear anywhere in the raw response body — not just missing from the array', async () => {
    const player = registerPlayer({ displayName: 'ArchiveNoLeak', email: 'archivenoleak@example.com', userId: 'usr-archive-no-leak' });
    enterWithPath(player.id, 'family');

    const req = authedRequest(`http://localhost/api/game/transmissions?eventSlug=${SEED_EVENT.slug}`, 'usr-archive-no-leak');
    const res = await transmissionsGET(req);
    const bodyText = await res.text();

    // These titles belong to milestone-gated videos (7 Challenge Path, 11
    // Your Player Profile, 12 How XP Works, 13 How Prize Entries Work, 14
    // The Leaderboard, 15 How to Read a Quest) — none reached yet.
    for (const lockedTitle of ['Challenge Path', 'Secret Path', 'Your Player Profile', 'How XP Works', 'How Prize Entries Work', 'The Leaderboard', 'How to Read a Quest']) {
      expect(bodyText).not.toContain(lockedTitle);
    }
  });

  it('viewed state does not control reveal visibility — a delivered transmission the player never manually replayed still shows', async () => {
    installLocalStorageShim();
    const player = registerPlayer({ displayName: 'ArchiveUnviewed', email: 'archiveunviewed@example.com', userId: 'usr-archive-unviewed' });
    enterWithPath(player.id, 'family');

    // Never replayed/marked viewed from the archive — this is the DELIVERED
    // vs VIEWED distinction: hasViewedTransmission tracks a separate,
    // client-only UX convenience the archive route never reads.
    expect(hasViewedTransmission('cipher_cold_open', 'video-1', player.id)).toBe(false);

    const body = await fetchArchive('usr-archive-unviewed');
    expect(body.transmissions.some((t) => t.id === 1)).toBe(true);
    removeLocalStorageShim();
  });

  it('revealed state persists across repeated fetches (refresh) with no drift', async () => {
    const player = registerPlayer({ displayName: 'ArchivePersist', email: 'archivepersist@example.com', userId: 'usr-archive-persist' });
    enterWithPath(player.id, 'secret');

    const first = await fetchArchive('usr-archive-persist');
    const second = await fetchArchive('usr-archive-persist');
    const third = await fetchArchive('usr-archive-persist'); // simulates a third refresh/logout-login cycle

    const idsOf = (b: typeof first) => b.transmissions.map((t) => t.id).sort((a, b2) => a - b2);
    expect(idsOf(first)).toEqual(idsOf(second));
    expect(idsOf(second)).toEqual(idsOf(third));
  });

  it('archive grows monotonically and correctly after refresh once new progress is made — never shrinks, never skips ahead early', async () => {
    const player = registerPlayer({ displayName: 'ArchiveGrows', email: 'archivegrows@example.com', userId: 'usr-archive-grows' });
    enterWithPath(player.id, 'challenge');

    const before = await fetchArchive('usr-archive-grows');
    const beforeIds = before.transmissions.map((t) => t.id).sort((a, b) => a - b);
    expect(beforeIds).toEqual([1, 2, 3, 4, 5, 7, 9, 10]); // onboarding + Challenge Path (7)
    expect(beforeIds).not.toContain(11); // profile not complete yet

    updatePlayerProfile(player.id, { avatarPresetKey: '2' }); // completes identity -> unlocks 11

    const after = await fetchArchive('usr-archive-grows');
    const afterIds = after.transmissions.map((t) => t.id).sort((a, b) => a - b);
    expect(afterIds).toEqual([...beforeIds, 11].sort((a, b) => a - b));
    // Nothing that was already revealed disappears.
    for (const id of beforeIds) expect(afterIds).toContain(id);
  });

  it('a player-specific transmission unlocked for one player never leaks into another player\'s archive', async () => {
    const playerA = registerPlayer({ displayName: 'ArchivePlayerA', email: 'archiveplayera@example.com', userId: 'usr-archive-player-a' });
    enterWithPath(playerA.id, 'family');
    updatePlayerProfile(playerA.id, { avatarPresetKey: '3' }); // unlocks 11 for A only
    submitQuestProof({
      playerId: playerA.id,
      questId: 'qst-centennial-discovery',
      eventId: SEED_EVENT.id,
      proofType: 'checkin',
      submittedContent: 'GPS Checkin Confirmed',
      userLat: 40.7989,
      userLon: -81.3748,
    }); // real verified quest -> unlocks 12 (hasXp) and 14/15 (hasQuestActivity) for A only

    const playerB = registerPlayer({ displayName: 'ArchivePlayerB', email: 'archiveplayerb@example.com', userId: 'usr-archive-player-b' });
    enterWithPath(playerB.id, 'family');
    // Player B has entered but done nothing else — same onboarding tier only.

    const archiveA = await fetchArchive('usr-archive-player-a');
    const archiveB = await fetchArchive('usr-archive-player-b');
    const idsA = archiveA.transmissions.map((t) => t.id).sort((a, b) => a - b);
    const idsB = archiveB.transmissions.map((t) => t.id).sort((a, b) => a - b);

    expect(idsA).toEqual(expect.arrayContaining([11, 12, 14, 15]));
    for (const milestoneId of [11, 12, 13, 14, 15]) {
      expect(idsB).not.toContain(milestoneId);
    }
    // Both share the identical onboarding tier though.
    for (const onboardingId of [1, 2, 3, 4, 5, 9, 10]) {
      expect(idsA).toContain(onboardingId);
      expect(idsB).toContain(onboardingId);
    }
  });

  it('the onboarding tier reveals uniformly for every eligible player (global-like: gated on Mission entry, not individual milestones)', async () => {
    const playerC = registerPlayer({ displayName: 'ArchiveGlobalC', email: 'archiveglobalc@example.com', userId: 'usr-archive-global-c' });
    enterWithPath(playerC.id, 'secret');
    const playerD = registerPlayer({ displayName: 'ArchiveGlobalD', email: 'archiveglobald@example.com', userId: 'usr-archive-global-d' });
    enterWithPath(playerD.id, 'secret');

    const archiveC = await fetchArchive('usr-archive-global-c');
    const archiveD = await fetchArchive('usr-archive-global-d');
    const idsC = archiveC.transmissions.map((t) => t.id).sort((a, b) => a - b);
    const idsD = archiveD.transmissions.map((t) => t.id).sort((a, b) => a - b);

    // Two players with identical (minimal) progress reveal the identical
    // onboarding + path-video set — the reveal condition here is "have you
    // entered the Mission", true for every eligible player, not a
    // per-player milestone that could differ.
    expect(idsC).toEqual(idsD);
    expect(idsC).toEqual([1, 2, 3, 4, 5, 8, 9, 10]); // 8 = Secret Path
  });

  it('a not-yet-entered player receives an empty archive, never the un-entered slug\'s locked count', async () => {
    registerPlayer({ displayName: 'ArchiveNeverEntered', email: 'archiveneverentered@example.com', userId: 'usr-archive-never-entered' });
    // Deliberately never calls getOrCreateEventParticipation.
    const body = await fetchArchive('usr-archive-never-entered');
    expect(body.transmissions).toEqual([]);
  });

  it('the archive never contains a duplicate id for the same transmission', async () => {
    const player = registerPlayer({ displayName: 'ArchiveNoDupe', email: 'archivenodupe@example.com', userId: 'usr-archive-no-dupe' });
    enterWithPath(player.id, 'family');
    updatePlayerProfile(player.id, { avatarPresetKey: '1' });

    const body = await fetchArchive('usr-archive-no-dupe');
    const ids = body.transmissions.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

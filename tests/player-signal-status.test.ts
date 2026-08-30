/**
 * Canton Quests — Player Card PLAYER SIGNAL activity/status.
 *
 * PLAYER SIGNAL used to display `LEVEL ${player.level}` (an XP-derived
 * value) plus a `// startingDistrict.label` suffix — both conceptually
 * redundant with TOTAL XP and the new PLAYER LEVEL participation bar, and
 * the district suffix leaked a Mission-specific attribute onto the
 * permanent card. PLAYER SIGNAL now shows the player's current
 * activity/status for the active Mission, computed by the pure helper
 * getPlayerSignalStatus (lib/player-command-center.ts) from real
 * persisted state:
 *
 *   STANDBY    — no currently-active Mission, or the player hasn't joined it
 *   ACTIVE     — joined a currently-active Mission, no submission yet
 *   ON MISSION — has a submission (any status) in that Mission
 *
 * This never touches players.level or its floor(totalXp/250)+1 formula —
 * that value still exists, is still correct, and is simply no longer
 * rendered on the card.
 */

import fs from 'fs';
import path from 'path';
import { describe, expect, it, beforeEach } from 'vitest';
import { getPlayerSignalStatus } from '../lib/player-command-center';
import {
  registerPlayer,
  resetGameEngineStore,
  initializeGameEngine,
  getOrCreateEventParticipation,
  submitQuestProof,
} from '../lib/game-engine';
import { SEED_EVENT } from '../lib/seed-data';
import { GET as commandCenterRoute } from '../app/api/player/command-center/route';
import { POST as profilePostRoute } from '../app/api/player/profile/route';

function authedRequest(url: string, userId: string, init: RequestInit = {}): Request {
  return new Request(url, {
    ...init,
    headers: {
      ...(init.headers as Record<string, string> | undefined),
      Authorization: `Bearer mock-jwt-${userId}`,
    },
  });
}

async function grantProfileCompletion(userId: string) {
  const req = authedRequest('http://localhost:3000/api/player/profile', userId, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ avatarPresetKey: '1' }),
  });
  const res = await profilePostRoute(req);
  return res.json();
}

describe('getPlayerSignalStatus — pure decision table', () => {
  it('no active Mission at all → STANDBY, regardless of join/submission state', () => {
    expect(
      getPlayerSignalStatus({
        hasActiveMission: false,
        hasJoinedActiveMission: false,
        hasSubmissionInActiveMission: false,
      })
    ).toBe('STANDBY');
    // Even fabricated join/submission flags can't override "no active Mission".
    expect(
      getPlayerSignalStatus({
        hasActiveMission: false,
        hasJoinedActiveMission: true,
        hasSubmissionInActiveMission: true,
      })
    ).toBe('STANDBY');
  });

  it('active Mission exists but player has not joined it → STANDBY', () => {
    expect(
      getPlayerSignalStatus({
        hasActiveMission: true,
        hasJoinedActiveMission: false,
        hasSubmissionInActiveMission: false,
      })
    ).toBe('STANDBY');
  });

  it('joined an active Mission, no quest participation yet → ACTIVE', () => {
    expect(
      getPlayerSignalStatus({
        hasActiveMission: true,
        hasJoinedActiveMission: true,
        hasSubmissionInActiveMission: false,
      })
    ).toBe('ACTIVE');
  });

  it('joined an active Mission and has submission evidence → ON MISSION', () => {
    expect(
      getPlayerSignalStatus({
        hasActiveMission: true,
        hasJoinedActiveMission: true,
        hasSubmissionInActiveMission: true,
      })
    ).toBe('ON MISSION');
  });
});

describe('PLAYER SIGNAL — end-to-end via /api/player/command-center (real persisted state)', () => {
  beforeEach(() => {
    resetGameEngineStore();
    initializeGameEngine();
  });

  it('a brand-new player who has not joined the active Mission gets STANDBY', async () => {
    registerPlayer({ displayName: 'SignalFresh', email: 'signalfresh@example.com', userId: 'usr-signal-fresh' });

    const res = await commandCenterRoute(authedRequest('http://localhost:3000/api/player/command-center', 'usr-signal-fresh'));
    const payload = await res.json();

    expect(payload.playerSignalStatus).toBe('STANDBY');
  });

  it('joining the active Mission with no quest submissions gets ACTIVE', async () => {
    registerPlayer({ displayName: 'SignalJoiner', email: 'signaljoiner@example.com', userId: 'usr-signal-joiner' });
    const before = await commandCenterRoute(authedRequest('http://localhost:3000/api/player/command-center', 'usr-signal-joiner'));
    const beforePayload = await before.json();

    getOrCreateEventParticipation(SEED_EVENT.id, beforePayload.player.id, 'family');

    const after = await commandCenterRoute(authedRequest('http://localhost:3000/api/player/command-center', 'usr-signal-joiner'));
    const afterPayload = await after.json();

    expect(afterPayload.playerSignalStatus).toBe('ACTIVE');
  });

  it('participating in at least one quest in the active Mission gets ON MISSION', async () => {
    registerPlayer({ displayName: 'SignalParticipant', email: 'signalparticipant@example.com', userId: 'usr-signal-participant' });
    const before = await commandCenterRoute(authedRequest('http://localhost:3000/api/player/command-center', 'usr-signal-participant'));
    const beforePayload = await before.json();
    const playerId = beforePayload.player.id;

    getOrCreateEventParticipation(SEED_EVENT.id, playerId, 'secret');
    // A rejected submission still counts as engagement — same "any status"
    // definition used for PLAYER LEVEL participation. qst-palace-theatre-year
    // has no GPS requirement, so a wrong passphrase is persisted as
    // 'rejected' rather than short-circuiting on an unrelated location check.
    submitQuestProof({
      playerId,
      questId: 'qst-palace-theatre-year',
      eventId: SEED_EVENT.id,
      proofType: 'passphrase',
      submittedContent: 'wrong-answer',
    });

    const after = await commandCenterRoute(authedRequest('http://localhost:3000/api/player/command-center', 'usr-signal-participant'));
    const afterPayload = await after.json();

    expect(afterPayload.playerSignalStatus).toBe('ON MISSION');
  });

  it('changing XP alone (profile-completion +100) does not change PLAYER SIGNAL', async () => {
    registerPlayer({ displayName: 'SignalXpAgent', email: 'signalxpagent@example.com', userId: 'usr-signal-xp' });

    const before = await commandCenterRoute(authedRequest('http://localhost:3000/api/player/command-center', 'usr-signal-xp'));
    const beforePayload = await before.json();
    expect(beforePayload.playerSignalStatus).toBe('STANDBY');
    expect(beforePayload.player.totalXp).toBe(0);

    const savePayload = await grantProfileCompletion('usr-signal-xp');
    expect(savePayload.player.totalXp).toBe(100);

    const after = await commandCenterRoute(authedRequest('http://localhost:3000/api/player/command-center', 'usr-signal-xp'));
    const afterPayload = await after.json();

    // XP moved from 0 to 100, but the player still hasn't joined the
    // Mission — status must stay STANDBY, not flip because XP changed.
    expect(afterPayload.player.totalXp).toBe(100);
    expect(afterPayload.playerSignalStatus).toBe('STANDBY');
  });
});

describe('PLAYER SIGNAL — old XP/level and district text are gone from the card', () => {
  it('the old LEVEL-N display logic is removed from the profile page', () => {
    const profilePageSource = fs.readFileSync(path.join(process.cwd(), 'app/profile/page.tsx'), 'utf8');
    expect(profilePageSource).not.toMatch(/LEVEL \$\{Math\.max\(1, ?data\.player\.level/);
    expect(profilePageSource).not.toContain('data.player.level');
  });

  it('the Starting District suffix is removed from the Player Signal wiring', () => {
    const profilePageSource = fs.readFileSync(path.join(process.cwd(), 'app/profile/page.tsx'), 'utf8');
    expect(profilePageSource).not.toMatch(/startingDistrict\.label/);
    expect(profilePageSource).toContain('signalStatusText={data.playerSignalStatus}');
  });

  it('PlayerCard.tsx no longer exposes a playerLevelText prop feeding the signal field', () => {
    const cardSource = fs.readFileSync(path.join(process.cwd(), 'components/PlayerCard.tsx'), 'utf8');
    expect(cardSource).not.toContain('playerLevelText');
    expect(cardSource).toContain('signalStatusText');
  });
});

describe('players.level DB calculation is untouched by this change', () => {
  it('the floor(totalXp/250)+1 formula still exists verbatim at both write sites', () => {
    const gameEngineSource = fs.readFileSync(path.join(process.cwd(), 'lib/game-engine.ts'), 'utf8');
    const supabaseDbSource = fs.readFileSync(path.join(process.cwd(), 'lib/supabase-db.ts'), 'utf8');

    expect(gameEngineSource).toMatch(/Math\.floor\(\s*(player\.)?totalXp\s*\/\s*250\)\s*\+\s*1/);
    expect(supabaseDbSource).toMatch(/Math\.floor\(nextTotalXp\s*\/\s*250\)\s*\+\s*1/);
  });

  it('no migration was introduced — players.level remains the same column, same formula', async () => {
    resetGameEngineStore();
    initializeGameEngine();
    registerPlayer({ displayName: 'LevelUnchangedAgent', email: 'levelunchanged@example.com', userId: 'usr-level-unchanged' });

    const req = authedRequest('http://localhost:3000/api/player/profile', 'usr-level-unchanged', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatarPresetKey: '2' }),
    });
    const savePayload = await (await profilePostRoute(req)).json();

    expect(savePayload.player.totalXp).toBe(100);
    expect(savePayload.player.level).toBe(Math.floor(100 / 250) + 1);
  });
});

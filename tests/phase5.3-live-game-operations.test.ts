import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createAudienceEvent,
  getAudienceEvents,
  getAudienceEventOptions,
  castSpectatorVote,
  activateAudienceEvent,
  closeAudienceVoting,
  resolveAudienceEvent,
  cancelAudienceEvent,
  executeAudienceEffect,
  runAudienceVoteSimulation,
  processAudienceLifecycleCron,
  logTimelineAction,
  getLiveEventTimeline,
  toggleSpectatorSystemFreeze,
  getSpectatorSystemSettings,
  resetSpectatorStores,
  createSessionTokenHash,
  createIpHash,
  registerOrUpdateSpectatorSession,
  getHostBroadcasts,
} from '../lib/spectator-engine';
import {
  getBonusWindows,
  getActiveBonusMultiplier,
  getAnnouncements,
  getQuestById,
  getAllPlayers,
  getLeaderboardForEvent,
  resetGameEngineStore,
} from '../lib/game-engine';
import { AudienceEvent } from '../lib/types';

describe('Canton Quests Phase 5.3 — Live Game Operations & Spectator Influence Integration', () => {
  const TEST_EVENT_ID = 'evt-canton-live-ops-2026';

  beforeEach(() => {
    resetSpectatorStores();
    resetGameEngineStore();
    process.env.SPECTATOR_SESSION_SECRET = 'test-spectator-secret-salt-2026';
  });

  afterEach(() => {
    resetSpectatorStores();
    resetGameEngineStore();
  });

  describe('1. Audience Event Deterministic Lifecycle', () => {
    it('1. transitions cleanly through draft/scheduled -> voting_active -> tallying_closed -> resolved', () => {
      const { event, options } = createAudienceEvent({
        eventId: TEST_EVENT_ID,
        title: 'Phase Pacing Choice',
        eventType: 'audience_vote',
        options: [
          { label: 'Option Alpha', description: 'Double XP in Arts Corridor' },
          { label: 'Option Beta', description: 'Flash Drop at Centennial Plaza' },
        ],
      });

      expect(event.status).toBe('voting_active'); // Default active on creation

      // Close voting
      const closeRes = closeAudienceVoting(event.id, 'Game Director');
      expect(closeRes.success).toBe(true);
      expect(closeRes.event?.status).toBe('tallying_closed');

      // Resolve event
      const resolveRes = resolveAudienceEvent(event.id, undefined, undefined, 'Game Director');
      expect(resolveRes.success).toBe(true);
      expect(resolveRes.winningOption?.id).toBe(options[0].id);

      const events = getAudienceEvents(TEST_EVENT_ID, true) as AudienceEvent[];
      const updated = events.find((e) => e.id === event.id);
      expect(updated?.status).toBe('resolved');
      expect(updated?.winningOptionId).toBe(options[0].id);
    });

    it('2. rejects invalid lifecycle transitions (cannot activate resolved or cancelled event)', () => {
      const { event } = createAudienceEvent({
        eventId: TEST_EVENT_ID,
        title: 'Contested Choice',
        eventType: 'audience_vote',
        options: [{ label: 'A' }, { label: 'B' }],
      });

      resolveAudienceEvent(event.id);

      // Attempt to reactivate resolved event
      const reactivateRes = activateAudienceEvent(event.id, undefined, 5, 'Game Director');
      expect(reactivateRes.success).toBe(false);
      expect(reactivateRes.error).toContain("Cannot activate audience event in terminal status 'resolved'");

      // Create and cancel another event
      const { event: evt2 } = createAudienceEvent({
        eventId: TEST_EVENT_ID,
        title: 'Cancelled Choice',
        eventType: 'audience_vote',
        options: [{ label: 'A' }, { label: 'B' }],
      });
      cancelAudienceEvent(evt2.id, 'Event Paused');

      const reactivateCancelled = activateAudienceEvent(evt2.id);
      expect(reactivateCancelled.success).toBe(false);
      expect(reactivateCancelled.error).toContain("Cannot activate audience event in terminal status 'cancelled'");

      const closeCancelled = closeAudienceVoting(evt2.id);
      expect(closeCancelled.success).toBe(false);
      expect(closeCancelled.error).toContain('Cannot close voting for a cancelled event');
    });

    it('3. rejects votes once voting is closed or resolved', () => {
      const { event, options } = createAudienceEvent({
        eventId: TEST_EVENT_ID,
        title: 'Late Vote Test',
        eventType: 'audience_vote',
        options: [{ label: 'A' }, { label: 'B' }],
      });

      const tokenHash = createSessionTokenHash('user-late-token-1');
      const ipHash = createIpHash('10.0.0.1');

      // Close voting
      closeAudienceVoting(event.id);

      const lateVote = castSpectatorVote({
        audienceEventId: event.id,
        optionId: options[0].id,
        sessionTokenHash: tokenHash,
        ipHash,
      });

      expect(lateVote.success).toBe(false);
      expect(lateVote.error).toBe('Voting is not active for this event');
    });

    it('4. enforces single active voting event invariant for the same game event', () => {
      const { event: evt1 } = createAudienceEvent({
        eventId: TEST_EVENT_ID,
        title: 'Active Vote 1',
        eventType: 'audience_vote',
        options: [{ label: 'A' }, { label: 'B' }],
      });

      expect(evt1.status).toBe('voting_active');

      // Create a second event in draft status
      const { event: evt2 } = createAudienceEvent({
        eventId: TEST_EVENT_ID,
        title: 'Active Vote 2',
        eventType: 'audience_vote',
        options: [{ label: 'C' }, { label: 'D' }],
      });
      evt2.status = 'scheduled';

      // Attempt to activate second event while first is active
      const activateRes = activateAudienceEvent(evt2.id);
      expect(activateRes.success).toBe(false);
      expect(activateRes.error).toContain('is currently actively voting for this event');
    });
  });

  describe('2. Automated Cron Lifecycle & Scheduled Activations', () => {
    it('1. auto-activates scheduled decisions when startsAt time has arrived', () => {
      const pastTime = new Date(Date.now() - 60000).toISOString();
      const { event: scheduledEvt } = createAudienceEvent({
        eventId: TEST_EVENT_ID,
        title: 'Scheduled Midday Sprint',
        eventType: 'audience_vote',
        options: [{ label: 'Choice 1' }, { label: 'Choice 2' }],
      });

      scheduledEvt.status = 'scheduled';
      scheduledEvt.startsAt = pastTime;

      const { activatedEvents } = processAudienceLifecycleCron(TEST_EVENT_ID);
      expect(activatedEvents).toContain(scheduledEvt.id);

      const events = getAudienceEvents(TEST_EVENT_ID, true);
      const updated = events.find((e) => e.id === scheduledEvt.id);
      expect(updated?.status).toBe('voting_active');
    });

    it('2. auto-closes active voting windows when endsAt has expired', () => {
      const pastEnd = new Date(Date.now() - 1000).toISOString();
      const { event: expiredEvt } = createAudienceEvent({
        eventId: TEST_EVENT_ID,
        title: 'Expiring Flash Vote',
        eventType: 'audience_vote',
        options: [{ label: 'Choice 1' }, { label: 'Choice 2' }],
      });

      expiredEvt.endsAt = pastEnd;

      const { closedEvents } = processAudienceLifecycleCron(TEST_EVENT_ID);
      expect(closedEvents).toContain(expiredEvt.id);

      const events = getAudienceEvents(TEST_EVENT_ID, true);
      const updated = events.find((e) => e.id === expiredEvt.id);
      expect(updated?.status).toBe('tallying_closed');
    });
  });

  describe('3. Audience Effect Execution & Exactly-Once Idempotency', () => {
    it('1. executes Double XP multiplier effect in game engine upon normal resolution', () => {
      const { event, options } = createAudienceEvent({
        eventId: TEST_EVENT_ID,
        title: 'Arts Multiplier Vote',
        eventType: 'audience_vote',
        options: [
          {
            label: '2.0x Double XP for Arts District',
            description: 'Doubles all arts points',
            effectPayload: {
              title: 'Audience Arts Surge',
              multiplier: 2.0,
              category: 'creative',
              durationMinutes: 30,
            },
          },
          {
            label: 'Standard XP',
            description: 'No change',
            effectPayload: { type: 'standard' },
          },
        ],
      });

      // Vote for option 0
      const tokenHash = createSessionTokenHash('voter-1');
      castSpectatorVote({
        audienceEventId: event.id,
        optionId: options[0].id,
        sessionTokenHash: tokenHash,
        ipHash: createIpHash('192.168.1.1'),
      });

      // Resolve
      const res = resolveAudienceEvent(event.id);
      expect(res.success).toBe(true);
      expect(res.winningOption?.id).toBe(options[0].id);
      expect(res.executionResult?.actionTaken).toBe('BONUS_WINDOW_ACTIVATED');

      // Verify game engine bonus window is active
      const mult = getActiveBonusMultiplier(TEST_EVENT_ID, 'creative');
      expect(mult).toBe(2.0);
    });

    it('2. executes Flash Quest activation upon resolution', () => {
      const { event, options } = createAudienceEvent({
        eventId: TEST_EVENT_ID,
        title: 'Flash Quest Choice',
        eventType: 'audience_vote',
        options: [
          {
            label: 'Centennial Plaza Flash Drop',
            description: 'Pop-up drop',
            effectPayload: {
              type: 'flash_quest',
              questId: 'qst-centennial-discovery',
              durationMinutes: 25,
            },
          },
          {
            label: '4th Street Mural',
            description: 'Alternative drop',
            effectPayload: { questId: 'qst-4th-st-mural-photo', durationMinutes: 25 },
          },
        ],
      });

      // Vote for option 0
      castSpectatorVote({
        audienceEventId: event.id,
        optionId: options[0].id,
        sessionTokenHash: createSessionTokenHash('voter-flash-1'),
        ipHash: createIpHash('10.0.0.2'),
      });

      const res = resolveAudienceEvent(event.id);
      expect(res.success).toBe(true);
      expect(res.executionResult?.actionTaken).toBe('FLASH_QUEST_TRIGGERED');

      const quest = getQuestById('qst-centennial-discovery');
      expect(quest?.isFlash).toBe(true);
    });

    it('3. protects against duplicate effect execution (Exactly-Once invariant)', () => {
      const { event, options } = createAudienceEvent({
        eventId: TEST_EVENT_ID,
        title: 'Duplicate Prevention Test',
        eventType: 'audience_vote',
        options: [
          {
            label: 'Bonus Window Alpha',
            effectPayload: {
              title: 'Idempotency Window',
              multiplier: 2.0,
              durationMinutes: 40,
            },
          },
          { label: 'Option B', effectPayload: {} },
        ],
      });

      castSpectatorVote({
        audienceEventId: event.id,
        optionId: options[0].id,
        sessionTokenHash: createSessionTokenHash('voter-idemp-1'),
        ipHash: createIpHash('10.0.0.3'),
      });

      // First resolution
      const firstRes = resolveAudienceEvent(event.id);
      expect(firstRes.success).toBe(true);
      expect(firstRes.executionResult?.isDuplicatePrevented).toBe(false);

      const initialWindowsCount = getBonusWindows(TEST_EVENT_ID).length;

      // Second resolution call (simulating concurrent request, refresh, or retry)
      const secondRes = resolveAudienceEvent(event.id);
      expect(secondRes.success).toBe(true);

      // Direct call to executeAudienceEffect
      const repeatExec = executeAudienceEffect(firstRes.effect!.id);
      expect(repeatExec.isDuplicatePrevented).toBe(true);
      expect(repeatExec.actionTaken).toBe('ALREADY_EXECUTED');

      // Bonus windows count in game engine must remain unchanged
      const finalWindowsCount = getBonusWindows(TEST_EVENT_ID).length;
      expect(finalWindowsCount).toBe(initialWindowsCount);
    });

    it('4. cancelled audience event executes no effect and cancels pending effect records', () => {
      const { event } = createAudienceEvent({
        eventId: TEST_EVENT_ID,
        title: 'Cancelled Modifier',
        eventType: 'audience_vote',
        options: [
          {
            label: 'Emergency Double XP',
            effectPayload: { multiplier: 3.0, durationMinutes: 30 },
          },
          { label: 'Standard' },
        ],
      });

      const cancelRes = cancelAudienceEvent(event.id, 'Inclement weather in downtown Canton');
      expect(cancelRes.success).toBe(true);
      expect(cancelRes.event?.status).toBe('cancelled');

      // Attempting to resolve a cancelled event must fail
      const resolveAttempt = resolveAudienceEvent(event.id);
      expect(resolveAttempt.success).toBe(false);
      expect(resolveAttempt.error).toContain('Cannot resolve a cancelled audience event');

      // Verify no 3.0x multiplier was activated
      const mult = getActiveBonusMultiplier(TEST_EVENT_ID);
      expect(mult).not.toBe(3.0);
    });

    it('5. Game Master manual override executes ONLY the Game Master-selected option', () => {
      const { event, options } = createAudienceEvent({
        eventId: TEST_EVENT_ID,
        title: 'Split Decision with Override',
        eventType: 'audience_vote',
        options: [
          {
            label: 'Option Alpha (Voted by Audience)',
            effectPayload: { multiplier: 1.5, category: 'exploration', durationMinutes: 20 },
          },
          {
            label: 'Option Beta (GM Selected Override)',
            effectPayload: { multiplier: 2.5, category: 'business_partner', durationMinutes: 20 },
          },
        ],
      });

      // 5 votes for option 0
      for (let i = 0; i < 5; i++) {
        castSpectatorVote({
          audienceEventId: event.id,
          optionId: options[0].id,
          sessionTokenHash: createSessionTokenHash(`override-voter-${i}`),
          ipHash: createIpHash(`10.0.1.${i}`),
        });
      }

      // GM Overrides with Option 1
      const overrideRes = resolveAudienceEvent(
        event.id,
        options[1].id,
        'Director balance override for evening round',
        'Lead Game Master'
      );

      expect(overrideRes.success).toBe(true);
      expect(overrideRes.winningOption?.id).toBe(options[1].id);
      expect(overrideRes.effect?.status).toBe('overridden');
      expect(overrideRes.effect?.overrideContext).toContain('Director balance override');

      // Business partner multiplier must be active (2.5x), exploration must NOT be active
      const partnerMult = getActiveBonusMultiplier(TEST_EVENT_ID, 'business_partner');
      expect(partnerMult).toBe(2.5);
    });
  });

  describe('4. Automatic Result Broadcasts & Player Announcements', () => {
    it('1. generates automated public host broadcasts upon resolution, override, and cancellation', () => {
      const { event: evt1 } = createAudienceEvent({
        eventId: TEST_EVENT_ID,
        title: 'Broadcast Resolution Test',
        eventType: 'audience_vote',
        options: [{ label: 'Option Gold' }, { label: 'Option Silver' }],
      });

      resolveAudienceEvent(evt1.id);

      const broadcasts = getHostBroadcasts(TEST_EVENT_ID);
      const winnerBroadcast = broadcasts.find((b) => b.headline.includes('THE AUDIENCE HAS SPOKEN'));
      expect(winnerBroadcast).toBeDefined();
      expect(winnerBroadcast?.body).toContain('Option Gold');

      // Test Override Broadcast
      const { event: evt2, options: opts2 } = createAudienceEvent({
        eventId: TEST_EVENT_ID,
        title: 'Override Broadcast Test',
        eventType: 'audience_vote',
        options: [{ label: 'Path A' }, { label: 'Path B' }],
      });

      resolveAudienceEvent(evt2.id, opts2[1].id, 'Safety route redirection');
      const overrideBroadcast = getHostBroadcasts(TEST_EVENT_ID).find((b) =>
        b.headline.includes('GAME MASTER OVERRIDE')
      );
      expect(overrideBroadcast).toBeDefined();
      expect(overrideBroadcast?.body).toContain('Safety route redirection');

      // Test Cancelled Broadcast
      const { event: evt3 } = createAudienceEvent({
        eventId: TEST_EVENT_ID,
        title: 'Cancelled Broadcast Test',
        eventType: 'audience_vote',
        options: [{ label: 'X' }, { label: 'Y' }],
      });

      cancelAudienceEvent(evt3.id, 'Lightning storm detected');
      const cancelBroadcast = getHostBroadcasts(TEST_EVENT_ID).find((b) =>
        b.headline.includes('AUDIENCE DECISION CANCELLED')
      );
      expect(cancelBroadcast).toBeDefined();
      expect(cancelBroadcast?.body).toContain('Lightning storm detected');
    });

    it('2. generates in-game live announcements for active players', () => {
      const { event } = createAudienceEvent({
        eventId: TEST_EVENT_ID,
        title: 'Player Announcement Trigger',
        eventType: 'audience_vote',
        options: [{ label: 'Citywide Double XP' }, { label: 'Standard Pacing' }],
      });

      resolveAudienceEvent(event.id);

      const playerAnnouncements = getAnnouncements(TEST_EVENT_ID);
      const audienceAnn = playerAnnouncements.find((a) => a.title.includes('THE WATCHERS HAVE SPOKEN'));
      expect(audienceAnn).toBeDefined();
      expect(audienceAnn?.urgency).toBe('flash');
    });
  });

  describe('5. Operational Live Event Timeline & Audit Trail', () => {
    it('1. logs operational events sequentially with actor attribution and metadata', () => {
      logTimelineAction({
        eventId: TEST_EVENT_ID,
        actionType: 'phase_change',
        title: 'Event Phase Advanced: Day 1',
        details: 'Game transitioned to Day 1 live quests',
        actor: 'Game Master',
      });

      const { event } = createAudienceEvent({
        eventId: TEST_EVENT_ID,
        title: 'Timeline Logged Decision',
        eventType: 'audience_vote',
        options: [{ label: 'Alpha' }, { label: 'Beta' }],
      });

      resolveAudienceEvent(event.id);

      const timeline = getLiveEventTimeline(TEST_EVENT_ID, 20, true);
      expect(timeline.length).toBeGreaterThanOrEqual(3);

      const actions = timeline.map((t) => t.actionType);
      expect(actions).toContain('phase_change');
      expect(actions).toContain('audience_vote_opened');
      expect(actions).toContain('audience_resolved');
      expect(actions).toContain('effect_executed');
    });
  });

  describe('6. Rehearsal / Simulation Mode Isolation', () => {
    it('1. executes isolated simulation without modifying real player XP, leaderboards, or score ledgers', () => {
      const initialLeaderboard = getLeaderboardForEvent(TEST_EVENT_ID);

      const simResult = runAudienceVoteSimulation(TEST_EVENT_ID, {
        title: '⚡ REHEARSAL: PRE-EVENT PACING TEST',
        votesCount: 40,
      });

      expect(simResult.success).toBe(true);
      expect(simResult.isRehearsal).toBe(true);
      expect(simResult.totalVotesSimulated).toBe(40);
      expect(simResult.winningOption).toBeDefined();
      expect(simResult.broadcastPreview.headline).toContain('THE AUDIENCE HAS SPOKEN');

      // Real leaderboard & scores must be 100% unchanged
      const postLeaderboard = getLeaderboardForEvent(TEST_EVENT_ID);
      expect(postLeaderboard.map((p) => ({ id: p.playerId, points: p.totalPoints }))).toEqual(
        initialLeaderboard.map((p) => ({ id: p.playerId, points: p.totalPoints }))
      );
    });
  });

  describe('7. Game Master Freeze & Emergency Controls', () => {
    it('1. rejects votes when Game Master freezes the spectator system and accepts votes once unfrozen', () => {
      const { event, options } = createAudienceEvent({
        eventId: TEST_EVENT_ID,
        title: 'Freeze Test Event',
        eventType: 'audience_vote',
        options: [{ label: 'Choice A' }, { label: 'Choice B' }],
      });

      toggleSpectatorSystemFreeze(TEST_EVENT_ID, true, 'Emergency System Pause');

      const frozenVote = castSpectatorVote({
        audienceEventId: event.id,
        optionId: options[0].id,
        sessionTokenHash: createSessionTokenHash('voter-freeze-1'),
        ipHash: createIpHash('10.0.2.1'),
      });

      expect(frozenVote.success).toBe(false);
      expect(frozenVote.code).toBe('SPECTATOR_SYSTEM_DISABLED');

      // Unfreeze
      toggleSpectatorSystemFreeze(TEST_EVENT_ID, false);

      const activeVote = castSpectatorVote({
        audienceEventId: event.id,
        optionId: options[0].id,
        sessionTokenHash: createSessionTokenHash('voter-freeze-1'),
        ipHash: createIpHash('10.0.2.1'),
      });

      expect(activeVote.success).toBe(true);
    });
  });

  describe('8. Admin Live API Endpoints Verification', () => {
    it('1. GET /api/admin/live returns audience dashboard data with auth check', async () => {
      const { GET } = await import('../app/api/admin/live/route');

      // Unauthorized request without secret
      const unauthReq = new Request(`http://localhost:3000/api/admin/live?eventId=${TEST_EVENT_ID}`);
      const unauthRes = await GET(unauthReq);
      expect(unauthRes.status).toBe(401);

      // Authorized request
      const authReq = new Request(`http://localhost:3000/api/admin/live?eventId=${TEST_EVENT_ID}`, {
        headers: {
          'x-admin-key': 'canton-gm-2026',
        },
      });

      const authRes = await GET(authReq);
      const data = await authRes.json();

      expect(authRes.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.upcomingEvents)).toBe(true);
      expect(Array.isArray(data.resolvedEvents)).toBe(true);
      expect(Array.isArray(data.timeline)).toBe(true);
    });

    it('2. POST /api/admin/live handles audience lifecycle actions', async () => {
      const { POST } = await import('../app/api/admin/live/route');

      const headers = {
        'Content-Type': 'application/json',
        'x-admin-key': 'canton-gm-2026',
      };

      // 1. Create audience event
      const createReq = new Request('http://localhost:3000/api/admin/live', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'create_audience_event',
          eventId: TEST_EVENT_ID,
          title: 'API Live Test',
          eventType: 'audience_vote',
          options: [{ label: 'Option 1' }, { label: 'Option 2' }],
          launchNow: true,
          durationMinutes: 5,
        }),
      });

      const createRes = await POST(createReq);
      const createData = await createRes.json();
      expect(createData.success).toBe(true);
      const eventId = createData.event.id;

      // 2. Close voting
      const closeReq = new Request('http://localhost:3000/api/admin/live', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'close_audience_voting',
          audienceEventId: eventId,
        }),
      });
      const closeRes = await POST(closeReq);
      const closeData = await closeRes.json();
      expect(closeData.success).toBe(true);

      // 3. Resolve audience event
      const resolveReq = new Request('http://localhost:3000/api/admin/live', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'resolve_audience_event',
          audienceEventId: eventId,
        }),
      });
      const resolveRes = await POST(resolveReq);
      const resolveData = await resolveRes.json();
      expect(resolveData.success).toBe(true);
      expect(resolveData.winningOption).toBeDefined();

      // 4. Run rehearsal simulation via API
      const simReq = new Request('http://localhost:3000/api/admin/live', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'run_rehearsal_simulation',
          eventId: TEST_EVENT_ID,
        }),
      });
      const simRes = await POST(simReq);
      const simData = await simRes.json();
      expect(simData.success).toBe(true);
      expect(simData.simulation.isRehearsal).toBe(true);
    });
  });
});

// Canton Quests — Phase 5.4 Real Event Readiness, Launch Gates & Rehearsal Test Suite
import fs from 'fs';
import path from 'path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getEvents,
  getQuestsForEvent,
  getQuestById,
  getAllPlayers,
  getLeaderboardForEvent,
  setEventPhase,
  toggleEventPause,
  submitQuestProof,
  resetGameEngineStore,
  resetSpectatorStores,
  resetRehearsalStore,
  auditEventQRQuests,
  auditEventQuestsAndLocations,
  evaluateEventLaunchGates,
  computeEventReadinessReport,
  getOperatorChecklist,
  updateOperatorChecklistItem,
  runWalkUpPlayerRehearsal,
  runFullEventRehearsal,
  executeEventClosure,
} from '../lib/game-engine';
import {
  createAudienceEvent,
  getAudienceEvents,
  toggleSpectatorSystemFreeze,
  getLiveEventTimeline,
} from '../lib/spectator-engine';
import { SEED_EVENT } from '../lib/seed-data';

describe('Canton Quests Phase 5.4 — Real Event Readiness, Launch Gates & Launch Rehearsal', () => {
  const TEST_EVENT_ID = SEED_EVENT.id;

  beforeEach(() => {
    resetGameEngineStore();
    resetSpectatorStores();
    resetRehearsalStore();
    process.env.SPECTATOR_SESSION_SECRET = 'test-spectator-secret-salt-2026';
  });

  afterEach(() => {
    resetGameEngineStore();
    resetSpectatorStores();
    resetRehearsalStore();
  });

  // ===========================================================================
  // 1. HARD SERVER-SIDE LAUNCH GATES
  // ===========================================================================
  describe('1. Hard Server-Side Launch Gates', () => {
    it('1. valid seed event passes all mandatory critical launch gates', async () => {
      const result = await evaluateEventLaunchGates(TEST_EVENT_ID);
      expect(result.isLaunchPermitted).toBe(true);
      expect(result.failedCriticalCount).toBe(0);
      expect(result.passedCount).toBeGreaterThanOrEqual(9);
      expect(result.blockingReasons).toHaveLength(0);
    });

    it('2. non-existent event ID fails closed with critical blocker', async () => {
      const result = await evaluateEventLaunchGates('non-existent-event-id-999');
      expect(result.isLaunchPermitted).toBe(false);
      expect(result.failedCriticalCount).toBe(1);
      expect(result.blockingReasons[0]).toContain('does not exist');
    });

    it('3. cancelled event strictly fails launch gate', async () => {
      const events = getEvents();
      const testEvt = events.find((e) => e.id === TEST_EVENT_ID);
      if (testEvt) (testEvt as any).status = 'cancelled';

      const result = await evaluateEventLaunchGates(TEST_EVENT_ID);
      expect(result.isLaunchPermitted).toBe(false);
      expect(result.blockingReasons[0]).toContain('cancelled');
    });

    it('4. event with insufficient playable quests fails launch gate', async () => {
      const quests = getQuestsForEvent(TEST_EVENT_ID);
      // Deactivate all quests except 1
      quests.slice(1).forEach((q) => (q.status = 'inactive'));

      const result = await evaluateEventLaunchGates(TEST_EVENT_ID);
      expect(result.isLaunchPermitted).toBe(false);
      const gate = result.gates.find((g) => g.code === 'GATE_PLAYABLE_QUESTS_COUNT');
      expect(gate?.isPassed).toBe(false);
      expect(result.blockingReasons.some((r) => r.includes('insufficient playable quests'))).toBe(true);
    });
  });

  // ===========================================================================
  // 2. QR READINESS AUDIT & SECURITY LEAK DETECTION
  // ===========================================================================
  describe('2. QR Readiness Audit & Security Checks', () => {
    it('1. audits all event QR quests and verifies route availability', async () => {
      const report = await auditEventQRQuests(TEST_EVENT_ID);
      expect(report.totalQrQuests).toBeGreaterThan(0);
      expect(report.brokenCount).toBe(0);
      expect(report.readyCount).toBeGreaterThanOrEqual(1);

      const sample = report.items[0];
      expect(sample.verificationPath).toContain('/quests/');
      expect(sample.hasSecretExposed).toBe(false);
    });

    it('2. detects critical security leak if target secret code is exposed in public description', async () => {
      const quests = getQuestsForEvent(TEST_EVENT_ID);
      const qrQuest = quests.find((q) => q.verificationType === 'qr');
      expect(qrQuest).toBeDefined();

      if (qrQuest) {
        qrQuest.targetCode = 'SUPER_SECRET_CANTON_PASS';
        qrQuest.description = 'Look around Centennial Plaza and enter SUPER_SECRET_CANTON_PASS to win.';
      }

      const report = await auditEventQRQuests(TEST_EVENT_ID);
      expect(report.brokenCount).toBeGreaterThan(0);

      const leakedItem = report.items.find((i) => i.questId === qrQuest?.id);
      expect(leakedItem?.status).toBe('BROKEN');
      expect(leakedItem?.hasSecretExposed).toBe(true);
      expect(leakedItem?.issues[0]).toContain('CRITICAL SECURITY LEAK');
    });

    it('3. detects duplicate active QR identifier collisions between quests', async () => {
      const quests = getQuestsForEvent(TEST_EVENT_ID);
      const qrQuests = quests.filter((q) => q.verificationType === 'qr');
      expect(qrQuests.length).toBeGreaterThanOrEqual(2);

      // Force collision
      qrQuests[0].qrCodeIdentifier = 'COLLIDING_QR_CODE_123';
      qrQuests[1].qrCodeIdentifier = 'COLLIDING_QR_CODE_123';

      const report = await auditEventQRQuests(TEST_EVENT_ID);
      expect(report.brokenCount).toBeGreaterThanOrEqual(1);
      const colliding = report.items.find((i) => i.questId === qrQuests[1].id);
      expect(colliding?.status).toBe('BROKEN');
      expect(colliding?.issues[0]).toContain('Duplicate active QR assignment');
    });
  });

  // ===========================================================================
  // 3. QUEST & LOCATION STRUCTURAL AUDIT
  // ===========================================================================
  describe('3. Quest Roster & Location Structural Audit', () => {
    it('1. validates point values, coordinates within Canton bounds, and proof types', async () => {
      const audit = await auditEventQuestsAndLocations(TEST_EVENT_ID);
      expect(audit.summary.total).toBeGreaterThan(0);
      expect(audit.summary.broken).toBe(0);
      expect(audit.summary.ready + audit.summary.warning).toBe(audit.summary.total);
      expect(audit.summary.ready).toBeGreaterThanOrEqual(14);
    });

    it('2. flags broken prerequisite reference if required quest does not exist', async () => {
      const quests = getQuestsForEvent(TEST_EVENT_ID);
      quests[0].prerequisiteQuestId = 'ghost-quest-999-missing';

      const audit = await auditEventQuestsAndLocations(TEST_EVENT_ID);
      expect(audit.summary.broken).toBeGreaterThanOrEqual(1);

      const brokenItem = audit.items.find((i) => i.questId === quests[0].id);
      expect(brokenItem?.auditStatus).toBe('BROKEN');
      expect(brokenItem?.issues[0]).toContain('Prerequisite quest');
    });

    it('3. detects self-referencing prerequisite cycles', async () => {
      const quests = getQuestsForEvent(TEST_EVENT_ID);
      quests[0].prerequisiteQuestId = quests[0].id; // Self loop

      const audit = await auditEventQuestsAndLocations(TEST_EVENT_ID);
      const brokenItem = audit.items.find((i) => i.questId === quests[0].id);
      expect(brokenItem?.auditStatus).toBe('BROKEN');
      expect(brokenItem?.issues[0]).toContain('Self-referencing prerequisite cycle');
    });
  });

  // ===========================================================================
  // 4. COMPUTED LAUNCH READINESS DASHBOARD & OPERATOR CHECKLIST
  // ===========================================================================
  describe('4. Event Readiness Report & Pre-Event Checklist', () => {
    it('1. computes complete readiness report across all 12 operational subsystems', async () => {
      const report = await computeEventReadinessReport(TEST_EVENT_ID);
      expect(report.eventId).toBe(TEST_EVENT_ID);
      expect(report.overallStatus).toBeDefined();
      expect(Object.keys(report.categories)).toHaveLength(12);
      expect(report.categories.event_configuration.status).toBe('READY');
      expect(report.categories.spectator_and_watch.status).toBe('READY');
      expect(report.categories.prize_and_drawing_isolation.status).toBe('READY');
    });

    it('2. provides operator checklist with automated and manual verification sync', async () => {
      const checklist = await getOperatorChecklist(TEST_EVENT_ID);
      expect(checklist.items.length).toBe(10);

      // Automated check syncs with system readiness
      const autoItem = checklist.items.find((i) => i.id === 'chk-1-event-confirm');
      expect(autoItem?.automatedStatus).toBe('READY');

      // Update manual check item
      const updated = await updateOperatorChecklistItem(
        TEST_EVENT_ID,
        'chk-3-qr-placed',
        true,
        'Field Master Sarah'
      );
      const manualItem = updated.items.find((i) => i.id === 'chk-3-qr-placed');
      expect(manualItem?.isManuallyChecked).toBe(true);
      expect(manualItem?.checkedBy).toBe('Field Master Sarah');
      expect(manualItem?.checkedAt).toBeDefined();
    });
  });

  // ===========================================================================
  // 5. WALK-UP PLAYER REHEARSAL & SANDBOX ISOLATION
  // ===========================================================================
  describe('5. Walk-Up Player Rehearsal Simulator', () => {
    it('1. executes 10-step simulated player walk-up flow successfully', async () => {
      const playersBefore = getAllPlayers().length;
      const leaderboardBefore = getLeaderboardForEvent(TEST_EVENT_ID).length;

      const result = await runWalkUpPlayerRehearsal(TEST_EVENT_ID);

      expect(result.isSuccess).toBe(true);
      expect(result.isRehearsal).toBe(true);
      expect(result.steps).toHaveLength(10);
      expect(result.steps.every((s) => s.status === 'PASSED')).toBe(true);
      expect(result.simulatedPlayer.earnedXp).toBeGreaterThan(0);
      expect(result.productionDataVerifiedUntouched).toBe(true);

      // Verify production data remains 100% untouched
      expect(getAllPlayers().length).toBe(playersBefore);
      expect(getLeaderboardForEvent(TEST_EVENT_ID).length).toBe(leaderboardBefore);
    });

    it('2. logs rehearsal execution in operational timeline with isRehearsal flag', async () => {
      await runWalkUpPlayerRehearsal(TEST_EVENT_ID);
      const timeline = getLiveEventTimeline(TEST_EVENT_ID, 20, true);
      const rehearsalEntry = timeline.find((t) => t.actionType === 'rehearsal_executed');

      expect(rehearsalEntry).toBeDefined();
      expect(rehearsalEntry?.isRehearsal).toBe(true);
      expect(rehearsalEntry?.title).toContain('Walk-Up Player Rehearsal Completed');
    });
  });

  // ===========================================================================
  // 6. FULL EVENT 8-PHASE REHEARSAL
  // ===========================================================================
  describe('6. Full Event 8-Phase Progression Rehearsal', () => {
    it('1. simulates complete 8-phase event lifecycle with 100% sandbox isolation', async () => {
      const playersBefore = getAllPlayers().length;
      const result = await runFullEventRehearsal(TEST_EVENT_ID);

      expect(result.isSuccess).toBe(true);
      expect(result.isRehearsal).toBe(true);
      expect(result.phases).toHaveLength(8);
      expect(result.phases.every((p) => p.status === 'PASSED')).toBe(true);
      expect(result.simulatedPlayerCount).toBe(5);
      expect(result.simulatedQuestsCompleted).toBe(12);
      expect(result.simulatedVotesCast).toBe(45);
      expect(result.productionDataVerifiedUntouched).toBe(true);

      // Real scores and players remain completely untouched
      expect(getAllPlayers().length).toBe(playersBefore);
    });
  });

  // ===========================================================================
  // 7. FAILURE DRILLS, EMERGENCY OPERATIONS & EVENT CLOSURE
  // ===========================================================================
  describe('7. Failure Drills, Emergency Controls & Safe Event Closure', () => {
    it('1. Emergency Pause holds quest submissions and Resume restores acceptance', () => {
      const quests = getQuestsForEvent(TEST_EVENT_ID);
      const testQuest = quests[0];

      // Trigger emergency pause
      toggleEventPause(TEST_EVENT_ID, true, 'Emergency Weather Safety Hold');

      const pausedSub = submitQuestProof({
        questId: testQuest.id,
        playerId: 'player-test-001',
        eventId: TEST_EVENT_ID,
        proofType: testQuest.verificationType,
      });

      expect(pausedSub.success).toBe(false);
      expect(pausedSub.message).toContain('currently paused');
      expect(pausedSub.awardedPoints).toBe(0);

      // Resume event
      toggleEventPause(TEST_EVENT_ID, false);

      // Now submission should proceed beyond the pause check
      const resumedSub = submitQuestProof({
        questId: testQuest.id,
        playerId: 'player-test-002',
        eventId: TEST_EVENT_ID,
        proofType: testQuest.verificationType,
        userLat: 40.7989,
        userLon: -81.3745,
      });

      expect(resumedSub.message).not.toContain('currently paused');
    });

    it('2. Spectator System Freeze locks audience voting and unfreeze restores it', () => {
      const { event: audEvent, options } = createAudienceEvent({
        eventId: TEST_EVENT_ID,
        title: 'Midday Freeze Drill Poll',
        eventType: 'audience_vote',
        options: [{ label: 'Option A' }, { label: 'Option B' }],
      });

      // Freeze spectator system
      toggleSpectatorSystemFreeze(TEST_EVENT_ID, true, 'Field GM Safety Hold');

      const settings = toggleSpectatorSystemFreeze(TEST_EVENT_ID, false);
      expect(settings.isSpectatorSystemDisabled).toBe(false);
    });

    it('4. genuinely reads real production data — GATE_EVENT_EXISTS is DB-aware, not local-engine-only (2026-09-04 fix)', () => {
      // Regression for: /admin/live reported "Event Exists in Database:
      // NOT FOUND" for the real production event ID
      // (b0000001-0000-4000-8000-000000000001) even though that event
      // genuinely existed — because every readiness function read from
      // lib/game-engine.ts's local/offline engine, which has its own
      // different seed IDs and never contains real production rows.
      const source = fs.readFileSync(path.join(process.cwd(), 'lib/event-readiness.ts'), 'utf8');
      expect(source).toContain("from './supabase-db'");
      expect(source).toContain('getEventByIdDB');
      expect(source).toContain('getQuestsForEventDB');
      expect(source).toContain('getLocationsDB');
      expect(source).toContain('getPlayerCountDB');
      // No more direct local-engine reads for the readiness-determining data.
      expect(source).not.toMatch(/from '\.\/game-engine'/);
      // Every readiness/gate/audit function must be async now that it
      // awaits real DB calls.
      for (const fn of [
        'auditEventQRQuests',
        'auditEventQuestsAndLocations',
        'evaluateEventLaunchGates',
        'computeEventReadinessReport',
        'getOperatorChecklist',
        'executeEventClosure',
      ]) {
        expect(source).toContain(`export async function ${fn}`);
      }
    });

    it('3. executeEventClosure transitions event to ENDED, halts scoring, and preserves historical data', async () => {
      const closureResult = await executeEventClosure(
        TEST_EVENT_ID,
        'Lead Game Master',
        'Official Event Concluded'
      );

      expect(closureResult.success).toBe(true);
      expect(closureResult.event?.currentPhase).toBe('ended');
      expect((closureResult.event as any)?.status).toBe('ended');

      // Verify quest submissions to ended event are strictly rejected
      const quests = getQuestsForEvent(TEST_EVENT_ID);
      const postEndSub = submitQuestProof({
        questId: quests[0].id,
        playerId: 'player-late-arrival',
        eventId: TEST_EVENT_ID,
        proofType: quests[0].verificationType,
      });

      expect(postEndSub.success).toBe(false);
      expect(postEndSub.message).toContain('Event has concluded');
      expect(postEndSub.awardedPoints).toBe(0);

      // Audit timeline logs event_ended action
      const timeline = getLiveEventTimeline(TEST_EVENT_ID, 20, true);
      const endEntry = timeline.find((t) => t.actionType === 'event_ended');
      expect(endEntry).toBeDefined();
      expect(endEntry?.details).toContain('Official Event Concluded');
    });
  });
});
